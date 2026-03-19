#!/usr/bin/env python3
"""
Generate Sentinel-2 change GeoJSON layers for the Wolfspeed Silicon Carbide Fab AOI.

Outputs:
  public/data/wolfspeed_nc/wolfspeed_nc_<year1>_<year2>.geojson
  public/data/wolfspeed_nc/wolfspeed_nc_<year1>_<year2>_stats.json
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

SITE_ID = "wolfspeed_nc"
SITE_NAME = "Wolfspeed Silicon Carbide Fab"
# Approximate site centroid near Chatham-Siler City Advanced Manufacturing Site (lng, lat)
SITE_CENTER = (-79.499, 35.717)
SITE_RADIUS_METERS = 6000

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
            for name in zf.namelist():
                if name.endswith(".geojson"):
                    with zf.open(name) as geojson_file, open(output_path, "wb") as out_file:
                        out_file.write(geojson_file.read())
                    break
    else:
        with open(output_path, "wb") as out_file:
            out_file.write(buffer.read())


def compute_stats(fc, output_path: str) -> None:
    stats = {}
    features = fc.getInfo()["features"]
    for feature in features:
        properties = feature["properties"]
        change_label = properties["change_label"]
        stats.setdefault(change_label, {"area_ha": 0, "count": 0})
        stats[change_label]["area_ha"] += properties["area_ha"]
        stats[change_label]["count"] += 1

    totals = {
        label: round(values["area_ha"], 3)
        for label, values in stats.items()
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "site_id": SITE_ID,
                "site_name": SITE_NAME,
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "totals": totals,
                "raw": stats,
            },
            f,
            indent=2,
        )


def process_year_pair(year1: int, year2: int, geometry, output_dir: str) -> None:
    start1, end1 = fmt_date(year1), fmt_date(year1, end=True)
    start2, end2 = fmt_date(year2), fmt_date(year2, end=True)

    print(f"[INFO] Processing {year1} → {year2}")
    composite1 = load_composite(start1, end1, geometry)
    composite2 = load_composite(start2, end2, geometry)

    classified1 = classify_landcover(composite1)
    classified2 = classify_landcover(composite2)

    change_image = compute_change(classified1.select("class"), classified2.select("class"))
    fc = feature_collection_from_change(change_image, geometry)

    fc = fc.filter(ee.Filter.neq("change_label", "persistent_agriculture"))

    geojson_path = os.path.join(
        output_dir, f"{SITE_ID}_{year1}_{year2}.geojson"
    )
    stats_path = os.path.join(
        output_dir, f"{SITE_ID}_{year1}_{year2}_stats.json"
    )

    print(f"[INFO] Exporting vectors to {geojson_path}")
    download_feature_collection(fc, geojson_path)

    print(f"[INFO] Computing stats to {stats_path}")
    compute_stats(fc, stats_path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Sentinel-2 change layers for Wolfspeed NC."
    )
    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        help="Pairs of years to process (e.g., --years 2019 2020 2021 2022)",
    )
    parser.add_argument(
        "--output",
        default=os.path.join(REPO_ROOT, "public", "data", SITE_ID),
        help="Output directory for GeoJSON and stats files",
    )
    args = parser.parse_args()

    initialize_gee()

    geometry = get_buffer_geometry()
    ensure_output_dir(args.output)

    if args.years:
        if len(args.years) % 2 != 0:
            raise ValueError("Provide an even number of years (pairs).")
        year_pairs = list(zip(args.years[::2], args.years[1::2]))
    else:
        year_pairs = list(DEFAULT_YEAR_PAIRS)

    for year1, year2 in year_pairs:
        process_year_pair(year1, year2, geometry, args.output)

    print("[INFO] Done.")


if __name__ == "__main__":
    main()
