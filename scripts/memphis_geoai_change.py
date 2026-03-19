#!/usr/bin/env python3
"""memphis_geoai_change.py

Memphis / Southaven change detection exporter (GEE-first).

Goal
- Produce map-ready GeoJSON polygons representing landcover / industrial-change signals
  around one or more AOIs relevant to the Memphis hypothesis work.

AOI: Provide via --aoi-geojson (preferred) OR --center LON LAT with --radius-m.

Outputs (same filename pattern as map layer expects):
- <out-dir>/<site_id>_<start1>_<end1>__<start2>_<end2>.geojson
- <out-dir>/<site_id>_<start1>_<end1>__<start2>_<end2>_stats.json

Example – xAI Colossus at 5420 Tulane Rd (full AOI, batched to stay under GEE 5k/tile):
  python scripts/memphis_geoai_change.py \\
    --site-id memphis_colossus \\
    --site-name "xAI Colossus - Memphis" \\
    --center -90.0348674 34.9979829 \\
    --radius-m 5000 \\
    --out-dir public/data/memphis_change \\
    --pairs 2023-2024 \\
    --batch-tiles 2 \\
    --overwrite
  (--batch-tiles 2 splits AOI into 2x2 tiles, each ≤5000 features, then merges for full coverage.)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from typing import Iterable, Tuple, Optional, Dict, Any

import ee  # type: ignore

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.append(REPO_ROOT)

from alphaearth_api import initialize_gee  # noqa: E402

DATASET = "COPERNICUS/S2_SR_HARMONIZED"

# Default thresholds (tunable per phase / site)
DEFAULTS = {
    "ag_threshold": 0.45,
    "water_threshold": 0.25,
    "industrial_ndbi_threshold": 0.20,
    "industrial_ndvi_max": 0.42,
    "barren_ndvi_max": 0.22,
}

CHANGE_CODE_MAP = {
    1: "vegetation_loss",
    2: "vegetation_gain",
    3: "industrial_expansion",
    4: "water_change",
    5: "persistent_vegetation",
}

# Batching configuration
BATCH_SIZE = 2
BATCH_DELAY_SECONDS = 30
RETRY_MAX_ATTEMPTS = 3
RETRY_BASE_DELAY = 10


def ensure_output_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def retry_with_backoff(func, max_attempts: int = RETRY_MAX_ATTEMPTS, base_delay: int = RETRY_BASE_DELAY):
    last_exception = None
    for attempt in range(max_attempts):
        try:
            return func()
        except Exception as e:
            last_exception = e
            if attempt < max_attempts - 1:
                delay = base_delay * (2 ** attempt)
                print(f"⚠️ Attempt {attempt + 1}/{max_attempts} failed: {e}")
                print(f"   Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                print(f"❌ All {max_attempts} attempts failed")
                raise last_exception
    raise last_exception


def health_check_gee() -> bool:
    try:
        test_point = ee.Geometry.Point([0, 0])
        test_image = ee.Image.constant(1)
        test_result = test_image.reduceRegion(
            reducer=ee.Reducer.first(),
            geometry=test_point,
            scale=1000,
            maxPixels=1,
        )
        test_result.getInfo()
        print("✅ GEE health check passed")
        return True
    except Exception as e:
        print(f"❌ GEE health check failed: {e}")
        return False


def geojson_to_ee_geometry(path: str) -> ee.Geometry:
    """Load a GeoJSON Polygon/MultiPolygon and convert to ee.Geometry."""
    with open(path, "r", encoding="utf-8") as f:
        gj = json.load(f)

    geom = None
    if gj.get("type") == "FeatureCollection":
        feats = gj.get("features", [])
        if not feats:
            raise ValueError("AOI GeoJSON FeatureCollection has no features")
        geom = feats[0].get("geometry")
    elif gj.get("type") == "Feature":
        geom = gj.get("geometry")
    else:
        geom = gj

    if not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("AOI must be a GeoJSON Polygon or MultiPolygon (or Feature/FC containing one)")

    # Earth Engine expects coordinates in lon/lat
    if geom["type"] == "Polygon":
        return ee.Geometry.Polygon(geom["coordinates"], None, False)
    return ee.Geometry.MultiPolygon(geom["coordinates"], None, False)


def center_radius_to_geometry(lon: float, lat: float, radius_m: float) -> ee.Geometry:
    return ee.Geometry.Point([lon, lat]).buffer(radius_m)


def get_aoi_bounds(geometry: ee.Geometry) -> Tuple[float, float, float, float]:
    """Return (min_lon, min_lat, max_lon, max_lat) from geometry bounds."""
    bounds = geometry.bounds()
    info = bounds.getInfo()
    if not info or "coordinates" not in info:
        raise RuntimeError("Could not get AOI bounds")
    coords = info["coordinates"][0]
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return (min(xs), min(ys), max(xs), max(ys))


def make_tile_geometries(geometry: ee.Geometry, n_tiles_side: int) -> list:
    """Split AOI into n_tiles_side x n_tiles_side tiles (intersected with AOI). Returns list of ee.Geometry."""
    min_lon, min_lat, max_lon, max_lat = get_aoi_bounds(geometry)
    step_lon = (max_lon - min_lon) / n_tiles_side
    step_lat = (max_lat - min_lat) / n_tiles_side
    tiles = []
    for i in range(n_tiles_side):
        for j in range(n_tiles_side):
            x0 = min_lon + i * step_lon
            x1 = min_lon + (i + 1) * step_lon
            y0 = min_lat + j * step_lat
            y1 = min_lat + (j + 1) * step_lat
            rect = ee.Geometry.Rectangle([x0, y0, x1, y1])
            tile_geom = rect.intersection(geometry)
            tiles.append(tile_geom)
    return tiles


def cloud_mask_s2_sr(image):
    qa = image.select("QA60")
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask).divide(10000)


def load_composite(start: str, end: str, geometry: ee.Geometry):
    def _load():
        collection = (
            ee.ImageCollection(DATASET)
            .filterBounds(geometry)
            .filterDate(start, end)
            .map(cloud_mask_s2_sr)
        )
        size = collection.size().getInfo()
        if size == 0:
            raise RuntimeError(f"No Sentinel-2 scenes between {start} and {end}")
        print(f"   ↳ Found {size} Sentinel-2 scenes")
        return collection.median().clip(geometry)

    return retry_with_backoff(_load)


def classify_landcover(image, thresholds: Dict[str, float]):
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
    ndbi = image.normalizedDifference(["B11", "B8"]).rename("NDBI")

    veg = ndvi.gt(thresholds["ag_threshold"]).And(ndwi.lt(thresholds["water_threshold"] + 0.05))
    water = ndwi.gt(thresholds["water_threshold"])
    industrial = ndbi.gt(thresholds["industrial_ndbi_threshold"]).And(ndvi.lt(thresholds["industrial_ndvi_max"]))
    barren = ndvi.lt(thresholds["barren_ndvi_max"]).And(ndwi.lt(thresholds["water_threshold"]))

    classes = (
        ee.Image(0)
        .where(veg, 1)        # vegetation
        .where(water, 2)      # water
        .where(industrial, 3) # industrial / impervious proxy
        .where(barren, 4)     # barren / cleared
    )

    persistent_veg = veg.rename("persistent_veg")
    return (
        classes.rename("class")
        .addBands(ndvi)
        .addBands(ndwi)
        .addBands(ndbi)
        .addBands(persistent_veg)
    )


def compute_change(class1, class2):
    base = ee.Image(0)
    veg_loss = class1.eq(1).And(class2.neq(1))
    veg_gain = class1.neq(1).And(class2.eq(1))
    industrial_expansion = class1.neq(3).And(class2.eq(3))
    water_change = class1.eq(2).neq(class2.eq(2))
    persistent_veg = class1.eq(1).And(class2.eq(1))

    change = (
        base.where(veg_loss, 1)
        .where(veg_gain, 2)
        .where(industrial_expansion, 3)
        .where(water_change, 4)
        .where(persistent_veg, 5)
    )
    return change.rename("change")


def feature_collection_from_change(
    change_image,
    geometry: ee.Geometry,
    site_id: str,
    site_name: str,
    start: str,
    end: str,
    scale: int = 20,
    max_features: int = 5000,
):
    masked = change_image.updateMask(change_image.gt(0))
    vectors = masked.reduceToVectors(
        geometry=geometry,
        scale=scale,
        geometryType="polygon",
        eightConnected=False,
        labelProperty="change_code",
        maxPixels=1e13,
    ).limit(max_features)

    center = geometry.centroid(maxError=1)

    def enrich(feature):
        geom = feature.geometry()
        area_m2 = geom.area(maxError=1)
        centroid = geom.centroid(maxError=1)
        distance_m = centroid.distance(center, maxError=1)
        code = ee.Number(feature.get("change_code")).toInt()
        change_label = ee.Dictionary(CHANGE_CODE_MAP).get(code, "unknown")
        return feature.set(
            {
                "site_id": site_id,
                "site_name": site_name,
                "window_start": start,
                "window_end": end,
                "change_code": code,
                "change_label": change_label,
                "area_m2": area_m2,
                "area_ha": area_m2.divide(10000),
                "distance_km": distance_m.divide(1000),
            }
        )

    return vectors.map(enrich)


def download_feature_collection(fc, output_path: Optional[str] = None) -> dict:
    """Download FC to GeoJSON. If output_path is None, return dict without writing."""

    def _download():
        print("   ↳ Downloading GeoJSON (may take a minute)...")
        start_time = time.time()
        geojson = fc.getInfo()
        elapsed = time.time() - start_time
        feature_count = len(geojson.get("features", []))
        print(f"   ↳ Download completed in {elapsed:.1f}s ({feature_count} features)")
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(geojson, f)
        return geojson

    return retry_with_backoff(_download)


def export_stats(change_image, geometry) -> list:
    def _export():
        area_image = change_image.gt(0).multiply(ee.Image.pixelArea())
        reducer = ee.Reducer.sum().group(groupField=1, groupName="change_code")
        stats = area_image.addBands(change_image).reduceRegion(
            reducer=reducer,
            geometry=geometry,
            scale=20,
            maxPixels=1e13,
        )
        groups = ee.List(stats.get("groups"))

        def transform_group(group):
            g = ee.Dictionary(group)
            code = ee.Number(g.get("change_code")).toInt()
            area = ee.Number(g.get("sum"))
            return ee.Dictionary(
                {
                    "change_code": code,
                    "change_label": ee.Dictionary(CHANGE_CODE_MAP).get(code, "unknown"),
                    "area_m2": area,
                    "area_ha": area.divide(10000),
                }
            )

        return groups.map(transform_group).getInfo()

    return retry_with_backoff(_export)


def wrap_geojson_with_metadata(
    raw_fc: dict,
    *,
    layer_type: str,
    geography: str,
    source: str,
    source_url: str,
    data_date: str,
    notes: list,
) -> dict:
    features = raw_fc.get("features", [])
    return {
        "type": "FeatureCollection",
        "metadata": {
            "layer_type": layer_type,
            "geography": geography,
            "source": source,
            "source_url": source_url,
            "created": datetime.utcnow().date().isoformat(),
            "feature_count": len(features),
            "data_date": data_date,
            "notes": notes,
        },
        "features": features,
    }


def process_window(
    site_id: str,
    site_name: str,
    geometry: ee.Geometry,
    start: str,
    end: str,
    out_dir: str,
    thresholds: Dict[str, float],
    overwrite: bool,
) -> bool:
    slug = f"{site_id}_{start}_{end}".replace(":", "").replace("/", "-")
    out_geojson_path = os.path.join(out_dir, f"{slug}.geojson")
    out_stats_path = os.path.join(out_dir, f"{slug}_stats.json")

    if not overwrite and os.path.exists(out_geojson_path):
        print(f"✅ {out_geojson_path} exists, skipping (use --overwrite)")
        return True

    try:
        t0 = time.time()
        print(f"🛰️ Processing {site_id}: {start} → {end}")

        print("   ↳ Loading composite...")
        composite = load_composite(start, end, geometry)

        elapsed = time.time() - t0
        print(f"   ✅ Composite loaded in {elapsed:.1f}s")
        return True
    except Exception as e:
        print(f"   ❌ Failed {site_id} {start} → {end}: {e}")
        return False


def process_pair(
    site_id: str,
    site_name: str,
    geometry: ee.Geometry,
    start1: str,
    end1: str,
    start2: str,
    end2: str,
    out_dir: str,
    thresholds: Dict[str, float],
    overwrite: bool,
    scale: int = 20,
    max_features: int = 5000,
    batch_tiles: int = 1,
) -> bool:
    tag = f"{site_id}_{start1}_{end1}__{start2}_{end2}".replace(":", "").replace("/", "-")
    out_geojson_path = os.path.join(out_dir, f"{tag}.geojson")
    out_stats_path = os.path.join(out_dir, f"{tag}_stats.json")

    if not overwrite and os.path.exists(out_geojson_path):
        print(f"✅ {out_geojson_path} exists, skipping (use --overwrite)")
        return True

    try:
        t0 = time.time()
        print(f"🛰️ Processing {site_id}: [{start1}→{end1}] vs [{start2}→{end2}]")

        print("   ↳ Loading composites...")
        c1 = load_composite(start1, end1, geometry)
        c2 = load_composite(start2, end2, geometry)

        print("   ↳ Classifying...")
        class1 = classify_landcover(c1, thresholds).select("class")
        class2 = classify_landcover(c2, thresholds).select("class")

        print("   ↳ Computing change + vectorizing...")
        change_image = compute_change(class1, class2)

        if batch_tiles <= 1:
            fc = feature_collection_from_change(
                change_image, geometry, site_id, site_name, start2, end2,
                scale=scale, max_features=max_features
            )
            raw_geojson = download_feature_collection(fc, out_geojson_path)
        else:
            # Tile-based batching: stay under GEE 5k limit per request, merge for full AOI
            tile_geoms = make_tile_geometries(geometry, batch_tiles)
            total_tiles = len(tile_geoms)
            print(f"   ↳ Batched export: {batch_tiles}x{batch_tiles} = {total_tiles} tiles (max {max_features} features/tile)")
            all_features = []
            for idx, tile_geom in enumerate(tile_geoms):
                fc = feature_collection_from_change(
                    change_image, tile_geom, site_id, site_name, start2, end2,
                    scale=scale, max_features=max_features
                )
                raw = retry_with_backoff(lambda: download_feature_collection(fc, None))
                features = raw.get("features", [])
                all_features.extend(features)
                print(f"   ↳ Tile {idx + 1}/{total_tiles}: {len(features)} features (total so far: {len(all_features)})")
            raw_geojson = {"type": "FeatureCollection", "features": all_features}

        feature_count = len(raw_geojson.get("features", []))
        if batch_tiles <= 1 and feature_count >= max_features:
            print(f"   ⚠️  Retrieved {feature_count} features (at cap {max_features}); AOI may be truncated.")
            print(f"   ↳ Re-run with --batch-tiles 2 for full coverage (or --scale 40).")

        # Wrap with metadata (your map standard)
        wrapped = wrap_geojson_with_metadata(
            raw_geojson,
            layer_type="memphis_change",
            geography=site_name,
            source=f"Sentinel-2 SR (GEE: {DATASET}) + rule-based indices (NDVI/NDWI/NDBI)",
            source_url="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED",
            data_date=f"{start1}..{end1} vs {start2}..{end2}",
            notes=[
                "Polygons are derived from a threshold-based landcover proxy (tunable).",
                "Use stats JSON for area totals by change class.",
            ],
        )
        with open(out_geojson_path, "w", encoding="utf-8") as f:
            json.dump(wrapped, f)

        print("   ↳ Computing stats...")
        stats = export_stats(change_image, geometry)
        meta = {
            "site_id": site_id,
            "site_name": site_name,
            "window1": {"start": start1, "end": end1},
            "window2": {"start": start2, "end": end2},
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "thresholds": thresholds,
            "change_stats": stats,
        }
        with open(out_stats_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        elapsed = time.time() - t0
        print(f"   ✅ Completed in {elapsed:.1f}s")
        print(f"   ↳ GeoJSON: {out_geojson_path}")
        print(f"   ↳ Stats:   {out_stats_path}")
        return True

    except Exception as e:
        print(f"   ❌ Failed {site_id}: {e}")
        return False


def parse_pairs(value: str) -> Iterable[Tuple[int, int]]:
    pairs = []
    for chunk in value.split(","):
        start, end = chunk.split("-")
        pairs.append((int(start), int(end)))
    return pairs


def fmt_year_window(year: int) -> Tuple[str, str]:
    return (f"{year}-01-01", f"{year}-12-31")


def main():
    parser = argparse.ArgumentParser(description="Memphis/Southaven change detection exporter (GEE)")

    parser.add_argument("--site-id", required=True, help="Stable site id (e.g., memphis_colossus)")
    parser.add_argument("--site-name", required=True, help="Human label (e.g., xAI Colossus - Memphis)")

    aoi = parser.add_mutually_exclusive_group(required=True)
    aoi.add_argument("--aoi-geojson", help="Path to AOI GeoJSON Polygon/MultiPolygon (preferred)")
    aoi.add_argument("--center", nargs=2, type=float, metavar=("LON", "LAT"), help="AOI center lon lat")

    parser.add_argument("--radius-m", type=float, default=5000, help="Radius in meters (used with --center)")

    parser.add_argument("--out-dir", default="public/data/memphis_change", help="Output directory")

    # Two-window explicit mode
    parser.add_argument("--window1", nargs=2, metavar=("START", "END"), help="First window start end (YYYY-MM-DD)")
    parser.add_argument("--window2", nargs=2, metavar=("START", "END"), help="Second window start end (YYYY-MM-DD)")

    # Convenience year-pairs mode (like Thad Hill)
    parser.add_argument("--pairs", type=parse_pairs, help="Year pairs (e.g. 2022-2023,2023-2024)")

    # thresholds
    parser.add_argument("--ag-threshold", type=float, default=DEFAULTS["ag_threshold"])
    parser.add_argument("--water-threshold", type=float, default=DEFAULTS["water_threshold"])
    parser.add_argument("--industrial-ndbi-threshold", type=float, default=DEFAULTS["industrial_ndbi_threshold"])
    parser.add_argument("--industrial-ndvi-max", type=float, default=DEFAULTS["industrial_ndvi_max"])
    parser.add_argument("--barren-ndvi-max", type=float, default=DEFAULTS["barren_ndvi_max"])

    parser.add_argument("--scale", type=int, default=20,
                        help="Vectorization scale in m (default 20)")
    parser.add_argument("--max-features", type=int, default=5000,
                        help="Max features per tile (default 5000; GEE aborts above 5000)")
    parser.add_argument("--batch-tiles", type=int, default=1, metavar="N",
                        help="Split AOI into NxN tiles and merge (default 1; use 2 for 2x2=4 tiles, full AOI without truncation)")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--skip-health-check", action="store_true")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--batch-delay", type=int, default=BATCH_DELAY_SECONDS)

    args = parser.parse_args()

    ensure_output_dir(args.out_dir)

    print("🔧 Initializing Google Earth Engine...")
    initialize_gee()

    if not args.skip_health_check:
        if not health_check_gee():
            sys.exit(1)

    if args.aoi_geojson:
        geometry = geojson_to_ee_geometry(args.aoi_geojson)
    else:
        if not args.center:
            raise SystemExit("--center requires lon lat")
        lon, lat = args.center
        geometry = center_radius_to_geometry(lon, lat, args.radius_m)

    thresholds = {
        "ag_threshold": args.ag_threshold,
        "water_threshold": args.water_threshold,
        "industrial_ndbi_threshold": args.industrial_ndbi_threshold,
        "industrial_ndvi_max": args.industrial_ndvi_max,
        "barren_ndvi_max": args.barren_ndvi_max,
    }

    # Determine worklist
    work = []
    if args.window1 and args.window2:
        w1s, w1e = args.window1
        w2s, w2e = args.window2
        work.append((w1s, w1e, w2s, w2e))
    elif args.pairs:
        for y1, y2 in args.pairs:
            s1, e1 = fmt_year_window(y1)
            s2, e2 = fmt_year_window(y2)
            work.append((s1, e1, s2, e2))
    else:
        raise SystemExit("Provide either --window1/--window2 or --pairs")

    # Batch processing
    total_ok = 0
    for i in range(0, len(work), args.batch_size):
        batch = work[i : i + args.batch_size]
        print(f"\n📦 Batch {i//args.batch_size + 1}: {len(batch)} pair(s)")
        for (s1, e1, s2, e2) in batch:
            ok = process_pair(
                args.site_id,
                args.site_name,
                geometry,
                s1,
                e1,
                s2,
                e2,
                args.out_dir,
                thresholds,
                args.overwrite,
                scale=args.scale,
                max_features=args.max_features,
                batch_tiles=args.batch_tiles,
            )
            total_ok += 1 if ok else 0
        if i + args.batch_size < len(work):
            print(f"⏳ Sleeping {args.batch_delay}s before next batch...")
            time.sleep(args.batch_delay)

    print(f"\n✅ Done. Successful pairs: {total_ok}/{len(work)}")


if __name__ == "__main__":
    main()
