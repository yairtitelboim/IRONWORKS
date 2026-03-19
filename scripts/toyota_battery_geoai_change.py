#!/usr/bin/env python3
"""
Generate Sentinel-2 change GeoJSON layers for the Toyota Battery Manufacturing NC AOI.

This mirrors the Lake Whitney Dam exporter but uses a Liberty, NC center and
dataset prefix for Toyota Battery.

Outputs:
  public/data/toyota_battery_nc/toyota_battery_nc_<year1>_<year2>.geojson
  public/data/toyota_battery_nc/toyota_battery_nc_<year1>_<year2>_stats.json
"""

import argparse
import io
import json
import os
import sys
import zipfile
from datetime import datetime
from typing import Iterable, Tuple

import ee  # type: ignore
import requests

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.append(REPO_ROOT)

from alphaearth_api import initialize_gee  # noqa: E402

SITE_ID = "toyota_battery_nc"
SITE_NAME = "Toyota Battery Manufacturing North Carolina"
# Approximate site centroid near Liberty, NC (lng, lat)
SITE_CENTER = (-79.571693, 35.85347)
SITE_RADIUS_METERS = 5000

DATASET = "COPERNICUS/S2_SR_HARMONIZED"
AG_THRESHOLD = 0.45
WATER_THRESHOLD = 0.25
INDUSTRIAL_NDBI_THRESHOLD = 0.2
INDUSTRIAL_NDVI_MAX = 0.42
BARREN_NDVI_MAX = 0.22

DEFAULT_YEAR_PAIRS: Iterable[Tuple[int, int]] = [
    (2017, 2018),
    (2018, 2019),
    (2019, 2020),
    (2020, 2021),
    (2021, 2022),
    (2022, 2023),
    (2023, 2024),
    (2024, 2025),
]

CHANGE_CODE_MAP = {
    1: "agriculture_loss",
    2: "agriculture_gain",
    3: "industrial_expansion",
    4: "water_change",
    5: "persistent_agriculture",
}

VECTOR_SCALE = 60
STATS_SCALE = 60
FEATURE_LIMIT = 3000


def ensure_output_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def get_buffer_geometry():
    center = ee.Geometry.Point(SITE_CENTER)
    return center.buffer(SITE_RADIUS_METERS)


def fmt_date(year: int, end: bool = False) -> str:
    return f"{year}-12-31" if end else f"{year}-01-01"


def cloud_mask_s2_sr(image):
    qa = image.select("QA60")
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
        qa.bitwiseAnd(cirrus_bit_mask).eq(0)
    )
    return image.updateMask(mask).divide(10000)


def load_composite(start: str, end: str, geometry):
    collection = (
        ee.ImageCollection(DATASET)
        .filterBounds(geometry)
        .filterDate(start, end)
        .map(cloud_mask_s2_sr)
    )
    if collection.size().getInfo() == 0:
        raise RuntimeError(f"No Sentinel-2 scenes between {start} and {end}")
    return collection.median().clip(geometry)


def classify_landcover(image):
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
    ndbi = image.normalizedDifference(["B11", "B8"]).rename("NDBI")

    agriculture = ndvi.gt(AG_THRESHOLD).And(ndwi.lt(WATER_THRESHOLD + 0.05))
    water = ndwi.gt(WATER_THRESHOLD)
    industrial = ndbi.gt(INDUSTRIAL_NDBI_THRESHOLD).And(ndvi.lt(INDUSTRIAL_NDVI_MAX))
    barren = ndvi.lt(BARREN_NDVI_MAX).And(ndwi.lt(WATER_THRESHOLD))

    classes = (
        ee.Image(0)
        .where(agriculture, 1)
        .where(water, 2)
        .where(industrial, 3)
        .where(barren, 4)
    )

    persistent_ag = agriculture.rename("persistent_ag")
    return (
        classes.rename("class")
        .addBands(ndvi)
        .addBands(ndwi)
        .addBands(ndbi)
        .addBands(persistent_ag)
    )


def compute_change(class1, class2):
    base = ee.Image(0)
    agriculture_loss = class1.eq(1).And(class2.neq(1))
    agriculture_gain = class1.neq(1).And(class2.eq(1))
    industrial_expansion = class1.neq(3).And(class2.eq(3))
    water1 = class1.eq(2)
    water2 = class2.eq(2)
    water_change = water1.neq(water2)
    persistent_agriculture = class1.eq(1).And(class2.eq(1))

    change = (
        base.where(agriculture_loss, 1)
        .where(agriculture_gain, 2)
        .where(industrial_expansion, 3)
        .where(water_change, 4)
        .where(persistent_agriculture, 5)
    )
    return change.rename("change")


def feature_collection_from_change(change_image, geometry, scale: int = VECTOR_SCALE):
    masked = change_image.updateMask(change_image.gt(0))
    vectors = masked.reduceToVectors(
        geometry=geometry,
        scale=scale,
        geometryType="polygon",
        eightConnected=False,
        labelProperty="change_code",
        maxPixels=1e13,
    )
    vectors = vectors.limit(FEATURE_LIMIT)
    center = ee.Geometry.Point(SITE_CENTER)

    def enrich(feature):
        geom = feature.geometry()
        area_m2 = geom.area(maxError=1)
        centroid = geom.centroid(maxError=1)
        distance_m = centroid.distance(center, maxError=1)
        code = ee.Number(feature.get("change_code")).toInt()
        change_label = ee.Dictionary(CHANGE_CODE_MAP).get(code, "unknown")
        return feature.set(
            {
                "site_id": SITE_ID,
                "site_name": SITE_NAME,
                "change_code": code,
                "change_label": change_label,
                "area_m2": area_m2,
                "area_ha": area_m2.divide(10000),
                "distance_km": distance_m.divide(1000),
            }
        )

    return vectors.map(enrich)


def download_feature_collection(fc, output_path: str) -> None:
    params = {
        "table": ee.FeatureCollection(fc),
        "format": "GeoJSON",
    }
    download_id = ee.data.getTableDownloadId(params)
    download_url = ee.data.makeTableDownloadUrl(download_id)
    response = requests.get(download_url, stream=True, timeout=300)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "").lower()
    buffer = io.BytesIO()
    for chunk in response.iter_content(chunk_size=1024 * 1024):
        if chunk:
            buffer.write(chunk)
    buffer.seek(0)

    if "zip" in content_type:
        with zipfile.ZipFile(buffer) as zf:
            geojson_files = [name for name in zf.namelist() if name.lower().endswith(".geojson")]
            if not geojson_files:
                raise RuntimeError("Downloaded archive does not contain a GeoJSON file.")
            geojson_name = geojson_files[0]
            with zf.open(geojson_name) as src, open(output_path, "wb") as dst:
                dst.write(src.read())
    else:
        data = json.loads(buffer.getvalue())
        with open(output_path, "w", encoding="utf-8") as dst:
            json.dump(data, dst)


def export_stats(change_image, geometry) -> dict:
    area_image = change_image.gt(0).multiply(ee.Image.pixelArea())
    reducer = ee.Reducer.sum().group(groupField=1, groupName="change_code")
    stats = area_image.addBands(change_image).reduceRegion(
        reducer=reducer,
        geometry=geometry,
        scale=STATS_SCALE,
        maxPixels=1e13,
    )
    groups = ee.List(stats.get("groups"))

    def transform(group):
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

    return {"groups": groups.map(transform).getInfo()}


def process_year_pair(year1: int, year2: int, output_dir: str) -> None:
    ensure_output_dir(output_dir)

    geometry = get_buffer_geometry()
    start1 = fmt_date(year1)
    end1 = fmt_date(year1, end=True)
    start2 = fmt_date(year2)
    end2 = fmt_date(year2, end=True)

    print(f"Processing {year1} → {year2}")
    image1 = load_composite(start1, end1, geometry)
    image2 = load_composite(start2, end2, geometry)

    class1 = classify_landcover(image1)
    class2 = classify_landcover(image2)

    change = compute_change(class1.select("class"), class2.select("class"))
    vectors = feature_collection_from_change(change, geometry)

    out_geojson = os.path.join(output_dir, f"{SITE_ID}_{year1}_{year2}.geojson")
    out_stats = os.path.join(output_dir, f"{SITE_ID}_{year1}_{year2}_stats.json")

    download_feature_collection(vectors, out_geojson)
    stats = export_stats(change, geometry)
    stats["site_id"] = SITE_ID
    stats["site_name"] = SITE_NAME
    stats["year_pair"] = f"{year1}-{year2}"
    stats["generated_at"] = datetime.utcnow().isoformat() + "Z"
    stats["radius_m"] = SITE_RADIUS_METERS

    with open(out_stats, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    print(f"  Saved {out_geojson}")
    print(f"  Saved {out_stats}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Toyota Battery NC change exporter")
    parser.add_argument(
        "--output-dir",
        default=os.path.join("public", "data", "toyota_battery_nc"),
        help="Directory to place exported GeoJSON/JSON files",
    )
    parser.add_argument(
        "--years",
        nargs="*",
        type=int,
        help="Optional explicit list of years (e.g., 2019 2020 2021)",
    )
    return parser.parse_args()


def determine_year_pairs(args: argparse.Namespace) -> Iterable[Tuple[int, int]]:
    if args.years:
        years = sorted(set(args.years))
        if len(years) < 2:
            raise SystemExit("Need at least two distinct years when using --years")
        return zip(years[:-1], years[1:])
    return DEFAULT_YEAR_PAIRS


def main() -> None:
    initialize_gee()
    args = parse_args()
    year_pairs = list(determine_year_pairs(args))
    if not year_pairs:
        raise SystemExit("No year pairs to process.")

    for year1, year2 in year_pairs:
        process_year_pair(year1, year2, args.output_dir)


if __name__ == "__main__":
    main()


