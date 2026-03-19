#!/usr/bin/env python3
"""Generate high-resolution GeoAI thumbnails for key Pinal County development sites."""

from pathlib import Path
from datetime import datetime, timedelta
import argparse
import sys
import json

import ee
import requests
import certifi
from ee.ee_exception import EEException

# Ensure repository root is on PYTHONPATH when script is run directly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from geoai_sites import GEOAI_SITES
from alphaearth_api import initialize_gee

# Sentinel visualization constants
SENTINEL_TRUE_COLOR_PARAMS = {
    'min': 0,
    'max': 3000,
    'gamma': [1.2, 1.2, 1.2]
}
SENTINEL_SCALE_METERS = 10  # Sentinel-2 native resolution (~10m)

NAIP_VIS_PARAMS = {
    'min': 0,
    'max': 255
}
NAIP_SCALE_METERS = 1  # NAIP native resolution (~1m)

DEFAULT_CLOUD_THRESHOLD = 35
DEFAULT_LOOKBACK_DAYS = 365
DEFAULT_RADIUS_SCALE = 1.0
DEFAULT_SENTINEL_DIMENSION = 2048
DEFAULT_NAIP_DIMENSION = 4096
OUTPUT_DIR = Path('public/geoai-sites')
METADATA_PATH = OUTPUT_DIR / 'metadata.json'


def download_image(url: str, output_path: Path) -> bool:
    """Download image from Earth Engine thumb URL with certificate verification."""
    try:
        response = requests.get(url, stream=True, timeout=120, verify=certifi.where())
        response.raise_for_status()
        with output_path.open('wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return True
    except Exception as exc:
        print(f"    ❌ Download failed for {output_path.name}: {exc}")
        if output_path.exists():
            output_path.unlink()
        return False


def build_geometry(lng: float, lat: float, radius_meters: float) -> ee.Geometry:
    """Create a circular geometry for the given point and radius."""
    center = ee.Geometry.Point([lng, lat])
    return center.buffer(radius_meters)


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def get_date_range(days_back: int):
    end = datetime.utcnow().date()
    start = end - timedelta(days=days_back)
    return start.isoformat(), end.isoformat()


def generate_thumbnails_for_site(
    site: dict,
    days_back: int,
    cloud_threshold: int,
    radius_scale: float,
    sentinel_dimension: int,
    naip_dimension: int
) -> dict:
    site_id = site['id']
    name = site['name']
    lat = site['coordinates']['lat']
    lng = site['coordinates']['lng']
    base_radius = site.get('radius', 3000)
    radius = int(base_radius * radius_scale)

    geometry = build_geometry(lng, lat, radius)
    geometry_geojson = geometry.getInfo()
    metadata_entry = {
        'id': site_id,
        'name': name,
        'center': {'lat': lat, 'lng': lng},
        'radiusMeters': radius,
        'baseRadiusMeters': base_radius,
        'radiusScaleApplied': radius_scale,
        'renderDimensions': {
            'sentinel': sentinel_dimension,
            'naip': naip_dimension
        },
        'imageCoordinates': [],
        'images': {
            'sentinel': None,
            'naip': None
        }
    }
    start_date, end_date = get_date_range(days_back)

    print(f"\n📍 Processing {name} ({site_id}) @ ({lat:.5f}, {lng:.5f}), radius {radius}m (base {base_radius}m, scale {radius_scale:.2f})")

    # Sentinel-2 true color
    sentinel_collection = (
        ee.ImageCollection('COPERNICUS/S2_SR')
        .filterBounds(geometry)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_threshold))
    )

    count = sentinel_collection.size().getInfo()
    if count == 0:
        print(f"  ⚠️ No Sentinel-2 imagery found in range {start_date} – {end_date}")
    else:
        sentinel_image = sentinel_collection.median()
        sentinel_visual = sentinel_image.select(['B4', 'B3', 'B2']).visualize(**SENTINEL_TRUE_COLOR_PARAMS)
        circle_mask = ee.Image.constant(1).clip(geometry)
        sentinel_visual = sentinel_visual.updateMask(circle_mask)

        sentinel_path = OUTPUT_DIR / f"{site_id}-sentinel.png"
        sentinel_dim_attempt = sentinel_dimension
        sentinel_downloaded = False
        while sentinel_dim_attempt >= 512 and not sentinel_downloaded:
            try:
                print(f"  ⬇️ Downloading Sentinel-2 composite (dim={sentinel_dim_attempt}, scenes={count}) -> {sentinel_path}")
                sentinel_url = sentinel_visual.getThumbURL({
                    'region': geometry_geojson,
                    'dimensions': sentinel_dim_attempt,
                    'format': 'png'
                })
                if download_image(sentinel_url, sentinel_path):
                    metadata_entry['images']['sentinel'] = f"/geoai-sites/{site_id}-sentinel.png"
                    metadata_entry['renderDimensions']['sentinel'] = sentinel_dim_attempt
                    sentinel_downloaded = True
                else:
                    sentinel_dim_attempt = int(sentinel_dim_attempt * 0.8)
                    print(f"    ⚠️ Retry Sentinel with dim={sentinel_dim_attempt}")
            except EEException as exc:
                if 'Total request size' in str(exc) and sentinel_dim_attempt > 512:
                    sentinel_dim_attempt = int(sentinel_dim_attempt * 0.8)
                    print(f"    ⚠️ Sentinel request too large, reducing dimension to {sentinel_dim_attempt}")
                else:
                    raise

        if not sentinel_downloaded:
            raise RuntimeError('Sentinel composite download failed after retries')

    # NAIP high resolution imagery (best effort)
    naip_collection = (
        ee.ImageCollection('USDA/NAIP/DOQQ')
        .filterBounds(geometry)
        .filterDate((datetime.utcnow().date() - timedelta(days=5 * 365)).isoformat(), end_date)
    )

    naip_count = naip_collection.size().getInfo()
    if naip_count == 0:
        print("  ⚠️ No NAIP imagery available in last 5 years")
    else:
        naip_image = naip_collection.sort('system:time_start', False).mosaic()
        naip_visual = naip_image.select(['R', 'G', 'B']).visualize(**NAIP_VIS_PARAMS)
        circle_mask = ee.Image.constant(1).clip(geometry)
        naip_visual = naip_visual.updateMask(circle_mask)

        naip_path = OUTPUT_DIR / f"{site_id}-naip.png"
        naip_dim_attempt = naip_dimension
        naip_downloaded = False
        while naip_dim_attempt >= 512 and not naip_downloaded:
            try:
                print(f"  ⬇️ Downloading NAIP mosaic (dim={naip_dim_attempt}, scenes={naip_count}) -> {naip_path}")
                naip_url = naip_visual.getThumbURL({
                    'region': geometry_geojson,
                    'dimensions': naip_dim_attempt,
                    'format': 'png'
                })

                if download_image(naip_url, naip_path):
                    metadata_entry['images']['naip'] = f"/geoai-sites/{site_id}-naip.png"
                    metadata_entry['renderDimensions']['naip'] = naip_dim_attempt
                    naip_downloaded = True
                else:
                    naip_dim_attempt = int(naip_dim_attempt * 0.8)
                    print(f"    ⚠️ Retry NAIP with dim={naip_dim_attempt}")
            except EEException as exc:
                if 'Total request size' in str(exc) and naip_dim_attempt > 512:
                    naip_dim_attempt = int(naip_dim_attempt * 0.8)
                    print(f"    ⚠️ NAIP request too large, reducing dimension to {naip_dim_attempt}")
                else:
                    raise

        if not naip_downloaded:
            raise RuntimeError('NAIP mosaic download failed after retries')

    bounds = geometry.bounds().coordinates().getInfo()[0]
    min_lng = min(coord[0] for coord in bounds)
    max_lng = max(coord[0] for coord in bounds)
    min_lat = min(coord[1] for coord in bounds)
    max_lat = max(coord[1] for coord in bounds)
    metadata_entry['imageCoordinates'] = [
        [min_lng, max_lat],
        [max_lng, max_lat],
        [max_lng, min_lat],
        [min_lng, min_lat]
    ]
    metadata_entry['updatedAt'] = datetime.utcnow().isoformat() + 'Z'

    has_any_imagery = bool(metadata_entry['images']['sentinel'] or metadata_entry['images']['naip'])
    metadata_entry['hasImagery'] = has_any_imagery
    return metadata_entry


def main(
    days_back: int,
    cloud_threshold: int,
    sites: list[str],
    radius_scale: float,
    sentinel_dimension: int,
    naip_dimension: int
):
    ensure_output_dir()

    if not initialize_gee():
        raise SystemExit("Failed to initialize Google Earth Engine")

    selected_sites = GEOAI_SITES
    if sites:
        selected_sites = [site for site in GEOAI_SITES if site['id'] in sites]
        if not selected_sites:
            raise SystemExit(f"No matching sites found for IDs: {sites}")

    metadata_entries = []
    for site in selected_sites:
        try:
            entry = generate_thumbnails_for_site(
                site,
                days_back,
                cloud_threshold,
                radius_scale,
                sentinel_dimension,
                naip_dimension
            )
            metadata_entries.append(entry)
        except Exception as exc:
            print(f"  ❌ Failed to generate imagery for {site['id']}: {exc}")

    metadata_payload = {
        'generatedAt': datetime.utcnow().isoformat() + 'Z',
        'sites': metadata_entries
    }
    METADATA_PATH.write_text(json.dumps(metadata_payload, indent=2))
    print(f"\n📝 Metadata saved to {METADATA_PATH}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate GeoAI site thumbnails into public folder.')
    parser.add_argument('--days-back', type=int, default=DEFAULT_LOOKBACK_DAYS,
                        help='Number of days back to include for Sentinel composites (default: 365).')
    parser.add_argument('--cloud-threshold', type=int, default=DEFAULT_CLOUD_THRESHOLD,
                        help='Maximum Sentinel cloud percentage (default: 35).')
    parser.add_argument('--sites', nargs='*', default=None,
                        help='Subset of site IDs to process (default: all).')
    parser.add_argument('--radius-scale', type=float, default=DEFAULT_RADIUS_SCALE,
                        help='Multiplier applied to each site radius before rendering (default: 1.0).')
    parser.add_argument('--sentinel-dim', type=int, default=DEFAULT_SENTINEL_DIMENSION,
                        help='Output dimension (pixels) for Sentinel composite (default: 2048).')
    parser.add_argument('--naip-dim', type=int, default=DEFAULT_NAIP_DIMENSION,
                        help='Output dimension (pixels) for NAIP mosaic (default: 4096).')

    args = parser.parse_args()
    main(
        args.days_back,
        args.cloud_threshold,
        args.sites or [],
        args.radius_scale,
        max(args.sentinel_dim, 512),
        max(args.naip_dim, 512)
    )
