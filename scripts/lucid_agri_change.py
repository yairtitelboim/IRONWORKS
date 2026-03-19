#!/usr/bin/env python3
"""
Generate Lucid Motors site agricultural change GeoJSON layers (2017-2025) using Google Earth Engine.

Outputs:
  public/data/lucid/lucid_<year1>_<year2>.geojson
  public/data/lucid/lucid_<year1>_<year2>_stats.json

Requires Earth Engine credentials (same as alphaearth_api.initialize_gee).
"""

import argparse
import json
import os
import sys
from datetime import datetime

import ee
import requests

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.append(REPO_ROOT)

from alphaearth_api import initialize_gee  # noqa: E402

SITE_ID = "lucid_ev_campus"
SITE_NAME = "Lucid Motors EV Manufacturing Campus"
SITE_CENTER = (-111.776102, 32.852949)  # (lng, lat)
# Expanded analysis radius (~6.75 km) to cover triple the previous footprint
SITE_RADIUS_METERS = 6750

DATASET = 'COPERNICUS/S2_SR_HARMONIZED'

AG_THRESHOLD = 0.45
WATER_THRESHOLD = 0.25
INDUSTRIAL_NDBI_THRESHOLD = 0.2
INDUSTRIAL_NDVI_MAX = 0.42
BARREN_NDVI_MAX = 0.22

DEFAULT_YEAR_PAIRS = [
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
    1: 'agriculture_loss',
    2: 'agriculture_gain',
    3: 'industrial_expansion',
    4: 'water_change',
    5: 'persistent_agriculture'
}


def ensure_output_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def get_buffer_geometry():
    center = ee.Geometry.Point(SITE_CENTER)
    return center.buffer(SITE_RADIUS_METERS)


def fmt_date(year: int, end: bool = False) -> str:
    return f"{year}-12-31" if end else f"{year}-01-01"


def cloud_mask_s2_sr(image):
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
        qa.bitwiseAnd(cirrus_bit_mask).eq(0)
    )
    return image.updateMask(mask).divide(10000)


def load_composite(start: str, end: str, geometry: ee.Geometry) -> ee.Image:
    collection = (
        ee.ImageCollection(DATASET)
        .filterBounds(geometry)
        .filterDate(start, end)
        .map(cloud_mask_s2_sr)
    )
    if collection.size().getInfo() == 0:
        raise RuntimeError(f"No Sentinel-2 scenes between {start} and {end}")
    return collection.median().clip(geometry)


def classify_landcover(image: ee.Image) -> ee.Image:
    nir = image.select('B8')
    red = image.select('B4')
    green = image.select('B3')
    swir = image.select('B11')

    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI')
    ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI')

    agriculture = ndvi.gt(AG_THRESHOLD).And(ndwi.lt(WATER_THRESHOLD + 0.05))
    water = ndwi.gt(WATER_THRESHOLD)
    industrial = ndbi.gt(INDUSTRIAL_NDBI_THRESHOLD).And(ndvi.lt(INDUSTRIAL_NDVI_MAX))
    barren = ndvi.lt(BARREN_NDVI_MAX).And(ndwi.lt(WATER_THRESHOLD))

    classes = ee.Image(0)\
        .where(agriculture, 1)\
        .where(water, 2)\
        .where(industrial, 3)\
        .where(barren, 4)

    # Persistent agriculture marker
    persistent_ag = agriculture.rename('persistent_ag')

    return classes.rename('class').addBands(ndvi).addBands(ndwi).addBands(ndbi).addBands(persistent_ag)


def compute_change(class1: ee.Image, class2: ee.Image) -> ee.Image:
    base = ee.Image(0)
    agriculture_loss = class1.eq(1).And(class2.neq(1))
    agriculture_gain = class1.neq(1).And(class2.eq(1))
    industrial_expansion = class1.neq(3).And(class2.eq(3))
    water1 = class1.eq(2)
    water2 = class2.eq(2)
    water_change = water1.neq(water2)
    persistent_agriculture = class1.eq(1).And(class2.eq(1))

    change = base\
        .where(agriculture_loss, 1)\
        .where(agriculture_gain, 2)\
        .where(industrial_expansion, 3)\
        .where(water_change, 4)\
        .where(persistent_agriculture, 5)

    return change.rename('change')


def feature_collection_from_change(change_image: ee.Image, geometry: ee.Geometry, scale: int = 20) -> ee.FeatureCollection:
    masked = change_image.updateMask(change_image.gt(0))
    vectors = masked.reduceToVectors(
        geometry=geometry,
        scale=scale,
        geometryType='polygon',
        eightConnected=False,
        labelProperty='change_code',
        maxPixels=1e13
    )
    center = ee.Geometry.Point(SITE_CENTER)

    def enrich(feature):
        geom = feature.geometry()
        area_m2 = geom.area(maxError=1)
        centroid = geom.centroid(maxError=1)
        distance_m = centroid.distance(center, maxError=1)
        code = ee.Number(feature.get('change_code')).toInt()
        change_label = ee.Dictionary(CHANGE_CODE_MAP).get(code, 'unknown')
        return feature.set({
            'site_id': SITE_ID,
            'site_name': SITE_NAME,
            'change_code': code,
            'change_label': change_label,
            'area_m2': area_m2,
            'area_ha': area_m2.divide(10000),
            'distance_km': distance_m.divide(1000),
        })

    return vectors.map(enrich)


def download_feature_collection(fc: ee.FeatureCollection, output_path: str) -> None:
    geojson = fc.getInfo()
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f)


def export_stats(change_image: ee.Image, geometry: ee.Geometry) -> dict:
    area_image = change_image.gt(0).multiply(ee.Image.pixelArea())
    reducer = ee.Reducer.sum().group(groupField=1, groupName='change_code')
    stats = area_image.addBands(change_image).reduceRegion(
        reducer=reducer,
        geometry=geometry,
        scale=20,
        maxPixels=1e13
    )
    groups = stats.get('groups')
    groups = ee.List(groups)

    def transform(group):
        g = ee.Dictionary(group)
        code = ee.Number(g.get('change_code')).toInt()
        area = ee.Number(g.get('sum'))
        return ee.Dictionary({
            'change_code': code,
            'change_label': ee.Dictionary(CHANGE_CODE_MAP).get(code, 'unknown'),
            'area_m2': area,
            'area_ha': area.divide(10000)
        })

    stats_list = groups.map(transform)
    return stats_list.getInfo()


def process_period(
    year_start: int,
    year_end: int,
    out_dir: str,
    overwrite: bool = False,
    export_bucket: str = None,
    export_drive_folder: str = None,
    export_sentinel: bool = False,
    export_naip: bool = False
) -> None:
    output_geojson = os.path.join(out_dir, f"{SITE_ID}_{year_start}_{year_end}.geojson")
    output_stats = os.path.join(out_dir, f"{SITE_ID}_{year_start}_{year_end}_stats.json")

    if not overwrite and os.path.exists(output_geojson):
        print(f"✅ {output_geojson} exists, skipping (use --overwrite to regenerate)")
        return

    geometry = get_buffer_geometry()

    print(f"🛰️ Processing {year_start} → {year_end}")
    start1 = fmt_date(year_start)
    end1 = fmt_date(year_start, end=True)
    start2 = fmt_date(year_end)
    end2 = fmt_date(year_end, end=True)

    composite1 = load_composite(start1, end1, geometry)
    composite2 = load_composite(start2, end2, geometry)

    class1 = classify_landcover(composite1).select('class')
    class2 = classify_landcover(composite2).select('class')
    change_image = compute_change(class1, class2)

    if export_sentinel or export_naip:
        export_description = f"lucid_{year_start}_{year_end}"
        if export_sentinel:
            export_sentinel_composite(
                composite2,
                geometry,
                export_description,
                export_bucket,
                export_drive_folder
            )
        if export_naip:
            export_naip_mosaic(
                geometry,
                export_description,
                export_bucket,
                export_drive_folder
            )

    fc = feature_collection_from_change(change_image, geometry)
    print(f"   ↳ downloading GeoJSON to {output_geojson}")
    download_feature_collection(fc, output_geojson)

    stats = export_stats(change_image, geometry)
    meta = {
        'site_id': SITE_ID,
        'site_name': SITE_NAME,
        'year_start': year_start,
        'year_end': year_end,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'change_stats': stats,
    }
    with open(output_stats, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    print(f"   ↳ stats written to {output_stats}")


def parse_pairs(value: str):
    pairs = []
    for chunk in value.split(','):
        start, end = chunk.split('-')
        pairs.append((int(start), int(end)))
    return pairs


def export_sentinel_composite(image: ee.Image, geometry: ee.Geometry, description: str,
                              bucket: str = None, drive_folder: str = None, scale: int = 10) -> None:
    export_image = image.clip(geometry).select(['B4', 'B3', 'B2'], ['red', 'green', 'blue'])
    task_config = {
        'description': f'{description}_sentinel_rgb',
        'scale': scale,
        'region': geometry.bounds().getInfo()['coordinates'],
        'fileFormat': 'GeoTIFF'
    }
    if bucket:
        task_config['cloudStorageBucket'] = bucket
        task_config['fileNamePrefix'] = f'{description}/sentinel_rgb'
        task = ee.batch.Export.image.toCloudStorage(export_image, **task_config)
    else:
        task_config['folder'] = drive_folder or 'lucid_geoai'
        task = ee.batch.Export.image.toDrive(export_image, **task_config)
    task.start()
    print(f"   ↳ Sentinel export started ({task.status()['id']})")


def export_naip_mosaic(geometry: ee.Geometry, description: str,
                       bucket: str = None, drive_folder: str = None, scale: int = 1) -> None:
    center = ee.Geometry.Point(SITE_CENTER)
    naip_collection = (
        ee.ImageCollection('USDA/NAIP/DOQQ')
        .filterBounds(center)
        .filterDate(datetime.utcnow().date().replace(year=datetime.utcnow().year - 5).isoformat(),
                    datetime.utcnow().date().isoformat())
    )
    naip_count = naip_collection.size().getInfo()
    if not naip_count:
        print('   ↳ NAIP export skipped (no scenes)')
        return

    mosaic = naip_collection.mosaic().clip(geometry)
    task_config = {
        'description': f'{description}_naip_rgb',
        'scale': scale,
        'region': geometry.bounds().getInfo()['coordinates'],
        'fileFormat': 'GeoTIFF'
    }
    if bucket:
        task_config['cloudStorageBucket'] = bucket
        task_config['fileNamePrefix'] = f'{description}/naip_rgb'
        task = ee.batch.Export.image.toCloudStorage(mosaic.select(['R', 'G', 'B']), **task_config)
    else:
        task_config['folder'] = drive_folder or 'lucid_geoai'
        task = ee.batch.Export.image.toDrive(mosaic.select(['R', 'G', 'B']), **task_config)
    task.start()
    print(f"   ↳ NAIP export started ({task.status()['id']})")


def main():
    parser = argparse.ArgumentParser(description='Lucid agriculture change exporter')
    parser.add_argument('--out-dir', default='public/data/lucid', help='Output directory for GeoJSON files')
    parser.add_argument('--pairs', type=parse_pairs,
                        help='Year pairs as comma-separated list (e.g. 2017-2018,2018-2019)')
    parser.add_argument('--overwrite', action='store_true', help='Overwrite existing files')
    parser.add_argument('--export-sentinel', action='store_true', help='Export Sentinel RGB composite per period')
    parser.add_argument('--export-naip', action='store_true', help='Export NAIP mosaic per period')
    parser.add_argument('--export-bucket', help='Cloud Storage bucket for exports (implies GCS export)')
    parser.add_argument('--export-drive-folder', help='Drive folder for exports')
    args = parser.parse_args()

    ensure_output_dir(args.out_dir)

    if not initialize_gee():
        raise SystemExit('Failed to initialize Earth Engine credentials')

    pairs = args.pairs if args.pairs else DEFAULT_YEAR_PAIRS

    for year_start, year_end in pairs:
        process_period(
            year_start,
            year_end,
            args.out_dir,
            overwrite=args.overwrite,
            export_bucket=args.export_bucket,
            export_drive_folder=args.export_drive_folder,
            export_sentinel=args.export_sentinel,
            export_naip=args.export_naip
        )

    print('✅ Completed Lucid agriculture change exports')


if __name__ == '__main__':
    main()
