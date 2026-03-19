#!/usr/bin/env python3
"""
GeoAI imagery utilities built on Google Earth Engine.
"""

from datetime import datetime, timedelta

import ee

from alphaearth_api import initialize_gee


def format_date(value):
    if value is None:
        return None
    try:
        return ee.Date(value).format('YYYY-MM-dd').getInfo()
    except Exception:
        return None


def get_geoai_imagery(lat, lng, radius_meters=3000, start_date=None, end_date=None, cloud_threshold=35):
    """Generate satellite imagery composites and analysis assets for a location."""
    if not initialize_gee():
        return None

    try:
        import time as _time
        start_time = _time.time()
        center = ee.Geometry.Point([lng, lat])
        region = center.buffer(radius_meters).bounds()

        if start_date is None or end_date is None:
            today = datetime.utcnow().date()
            end_date = end_date or today.isoformat()
            start_date = start_date or (today - timedelta(days=365)).isoformat()

        collection = (
            ee.ImageCollection('COPERNICUS/S2_SR')
            .filterBounds(center)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_threshold))
        )

        # Ensure there are scenes available
        scene_count = collection.size().getInfo()
        if scene_count == 0:
            return {
                'success': False,
                'error': 'No Sentinel-2 scenes available for requested window',
            }

        median_image = collection.median()
        circle_geometry = center.buffer(radius_meters)
        circle_mask = ee.Image.constant(1).clip(circle_geometry)

        true_color_image = median_image.select(['B4', 'B3', 'B2']).visualize(
            min=0,
            max=3000,
            gamma=[1.2, 1.2, 1.2]
        ).updateMask(circle_mask)
        false_color_image = median_image.select(['B8', 'B4', 'B3']).visualize(
            min=0,
            max=5000,
            gamma=1.3
        ).updateMask(circle_mask)
        ndvi = median_image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        ndvi_image = ndvi.visualize(
            min=-0.1,
            max=0.8,
            palette=['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
            opacity=0.85
        ).updateMask(circle_mask)

        vis_zoom = {
            'min_zoom': 6,
            'max_zoom': 18
        }

        true_color_map = true_color_image.getMapId({})
        false_color_map = false_color_image.getMapId({})
        ndvi_map = ndvi_image.getMapId({})

        print(f"🧠 GeoAI Sentinel composites ready in {(_time.time() - start_time):.2f}s @ ({lat:.4f}, {lng:.4f}) radius {radius_meters}m")

        naip_start = _time.time()

        # Coordinates for Mapbox image source (top-left, top-right, bottom-right, bottom-left)
        rect_coords = region.coordinates().get(0).getInfo()
        if len(rect_coords) < 4:
            raise ValueError('Unexpected geometry coordinates for imagery bounds')

        coordinates = [
            rect_coords[0],
            rect_coords[1],
            rect_coords[2],
            rect_coords[3]
        ]

        bounds = [
            min(coord[0] for coord in rect_coords),
            min(coord[1] for coord in rect_coords),
            max(coord[0] for coord in rect_coords),
            max(coord[1] for coord in rect_coords)
        ]

        # NAIP high-resolution imagery (after bounds computed)
        naip_collection = (
            ee.ImageCollection('USDA/NAIP/DOQQ')
            .filterBounds(center)
            .filterDate(datetime.utcnow().date().replace(year=datetime.utcnow().year - 5).isoformat(), end_date)
        )

        naip_info = None
        naip_map = None
        try:
            naip_count = naip_collection.size().getInfo()
        except Exception:
            naip_count = 0

        if naip_count and naip_count > 0:
            naip_sorted = naip_collection.sort('system:time_start', False)
            naip_image = naip_sorted.mosaic()
            naip_visual = naip_image.select(['R', 'G', 'B']).visualize(
                min=0,
                max=255
            ).updateMask(circle_mask)
            naip_map = naip_visual.getMapId({})
            naip_latest = format_date(naip_sorted.first().get('system:time_start'))
            naip_info = {
                'tileUrl': None,
                'coordinates': coordinates,
                'bounds': bounds,
                'description': 'USDA NAIP high-resolution aerial imagery (1m)',
                'minZoom': 6,
                'maxZoom': 21,
                'captureDate': naip_latest,
                'sceneCount': naip_count
            }
            print(f"🛰️ GeoAI NAIP mosaic ready in {(_time.time() - naip_start):.2f}s (scenes={naip_count})")

        mean_cloud = collection.aggregate_mean('CLOUDY_PIXEL_PERCENTAGE').getInfo()
        min_cloud = collection.aggregate_min('CLOUDY_PIXEL_PERCENTAGE').getInfo()
        max_cloud = collection.aggregate_max('CLOUDY_PIXEL_PERCENTAGE').getInfo()

        chronological = collection.sort('system:time_start')
        first_scene = chronological.first()
        last_scene = chronological.sort('system:time_start', False).first()

        start_actual = format_date(first_scene.get('system:time_start'))
        end_actual = format_date(last_scene.get('system:time_start'))

        return {
            'success': True,
            'imagery': {
                'trueColor': {
                    'tileUrl': None,
                    'coordinates': coordinates,
                    'bounds': bounds,
                    'description': 'Sentinel-2 SR true color composite (B4/B3/B2)',
                'minZoom': vis_zoom['min_zoom'],
                'maxZoom': vis_zoom['max_zoom'],
                'geometryType': 'circle',
                'radiusMeters': radius_meters
            },
                'falseColor': {
                    'tileUrl': None,
                    'coordinates': coordinates,
                    'bounds': bounds,
                    'description': 'Sentinel-2 SR false color composite (B8/B4/B3)',
                'minZoom': vis_zoom['min_zoom'],
                'maxZoom': vis_zoom['max_zoom'],
                'geometryType': 'circle',
                'radiusMeters': radius_meters
            },
                'ndvi': {
                    'tileUrl': None,
                    'coordinates': coordinates,
                    'bounds': bounds,
                    'description': 'Sentinel-2 NDVI vegetation index (-0.1 to 0.8)',
                'minZoom': vis_zoom['min_zoom'],
                'maxZoom': vis_zoom['max_zoom'],
                'geometryType': 'circle',
                'radiusMeters': radius_meters
            },
                'naip': naip_info
            },
            'metadata': {
                'dataset': 'COPERNICUS/S2_SR',
                'requestedTimeRange': {'start': start_date, 'end': end_date},
                'actualTimeRange': {'start': start_actual, 'end': end_actual},
                'sceneCount': scene_count,
                'meanCloudPercentage': round(mean_cloud, 2) if mean_cloud is not None else None,
                'minCloudPercentage': round(min_cloud, 2) if min_cloud is not None else None,
                'maxCloudPercentage': round(max_cloud, 2) if max_cloud is not None else None,
                'radiusMeters': radius_meters,
                'cloudThreshold': cloud_threshold,
                'naip': {
                    'available': bool(naip_info),
                    'captureDate': naip_info.get('captureDate') if naip_info else None,
                    'sceneCount': naip_info.get('sceneCount') if naip_info else 0
                }
            },
            'tileFetchers': {
                'trueColor': true_color_map['tile_fetcher'],
                'falseColor': false_color_map['tile_fetcher'],
                'ndvi': ndvi_map['tile_fetcher'],
                'naip': naip_map['tile_fetcher'] if naip_info else None
            }
        }

    except Exception as err:
        return {
            'success': False,
            'error': str(err)
        }
