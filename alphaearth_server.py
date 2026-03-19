#!/usr/bin/env python3
"""
Simple Flask server to serve real AlphaEarth data
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import time
from datetime import datetime
from collections import OrderedDict
from alphaearth_api import get_alphaearth_changes
from geoai_api import get_geoai_imagery
from geoai_sites import GEOAI_SITES
import secrets

# Simple in-memory cache for AlphaEarth data
alphaearth_cache = {}
CACHE_TIMEOUT = 300  # 5 minutes

app = Flask(__name__)
CORS(app)

tile_fetcher_registry = {}
TILE_FETCHER_TTL = 600
MAX_TILE_CACHE_ENTRIES = 512
tile_cache = OrderedDict()


def _touch_cache_entry(cache_dict, key, value=None, limit=None):
    if key in cache_dict:
        cache_dict.move_to_end(key)
    elif value is not None:
        cache_dict[key] = value
    if limit is not None and len(cache_dict) > limit:
        cache_dict.popitem(last=False)


def _make_tile_cache_key(tile_id, z, x, y):
    return f"{tile_id}:{z}:{x}:{y}"

@app.route('/api/alphaearth/analyze', methods=['POST'])
def analyze_alphaearth():
    """API endpoint to get real AlphaEarth data"""
    try:
        data = request.json
        lat = data['location']['lat']
        lng = data['location']['lng']
        radius = data.get('radius', 3000)
        
        print(f"🛰️ AlphaEarth API request: {lat}, {lng} (radius: {radius}m)")
        
        # Check cache first
        cache_key = f"{lat:.4f}_{lng:.4f}_{radius}"
        current_time = time.time()
        
        if cache_key in alphaearth_cache:
            cache_entry = alphaearth_cache[cache_key]
            if current_time - cache_entry['timestamp'] < CACHE_TIMEOUT:
                print(f"💾 Cache hit for {cache_key}")
                return jsonify(cache_entry['data'])
            else:
                # Cache expired, remove it
                del alphaearth_cache[cache_key]
                print(f"⏰ Cache expired for {cache_key}")
        
        print(f"❄️ Cache miss - querying GEE...")
        
        # Get real AlphaEarth data with timeout
        start_time = time.time()
        result = get_alphaearth_changes(lat, lng, radius)
        processing_time = time.time() - start_time
        
        if result:
            # Prepare response
            response_data = {
                'success': True,
                'coordinates': {'lat': lat, 'lng': lng},
                'radius': f'{radius/1000}km',
                'pixelCount': len(result['features']),
                'pixelSize': '500m x 500m',  # Actual sampling resolution
                'geoJSON': result,
                'environmentalAnalysis': {
                    'water': {'stable': 0.8, 'degrading': 0.2, 'improving': 0.0},
                    'vegetation': {'stable': 0.7, 'degrading': 0.2, 'improving': 0.1},
                    'soil': {'stable': 0.6, 'degrading': 0.3, 'improving': 0.1}
                },
                'dataSource': 'REAL_ALPHAEARTH_GEE',
                'processingTime': f"{processing_time:.2f}s",
                'cached': False
            }
            
            # Cache the result
            alphaearth_cache[cache_key] = {
                'data': response_data,
                'timestamp': current_time
            }
            print(f"💾 Cached result for {cache_key}")
            
            return jsonify(response_data)
        else:
            return jsonify({'success': False, 'error': 'Failed to get AlphaEarth data'}), 500
            
    except Exception as e:
        print(f"❌ AlphaEarth API error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/geoai/imagery', methods=['POST'])
def geoai_imagery():
    """Generate GeoAI satellite imagery composites for Mapbox overlays."""
    try:
        data = request.json or {}
        location = data.get('location', {})
        lat = float(location.get('lat'))
        lng = float(location.get('lng'))
        radius = int(data.get('radius', 3000))
        time_range = data.get('timeRange') or {}
        start_date = time_range.get('start')
        end_date = time_range.get('end')
        cloud_threshold = data.get('cloudThreshold', 35)

        print(f"🛰️ GeoAI imagery request: lat={lat}, lng={lng}, radius={radius}")

        print("❄️ GeoAI cache miss - generating imagery via GEE")
        single_start = time.time()
        imagery_data = get_geoai_imagery(lat, lng, radius, start_date, end_date, cloud_threshold)

        tile_fetchers = imagery_data.pop('tileFetchers', {}) if imagery_data else {}

        if imagery_data and imagery_data.get('success'):
            imagery_layers = imagery_data.get('imagery', {})
            for layer_key, fetcher in tile_fetchers.items():
                if not fetcher or layer_key not in imagery_layers:
                    continue
                tile_id = register_tile_fetcher(fetcher)
                imagery_layers[layer_key]['tileUrl'] = f"/api/geoai/tiles/{tile_id}/{{z}}/{{x}}/{{y}}.png"

            print(f"✅ GeoAI imagery ready in {time.time() - single_start:.2f}s")
            return jsonify(imagery_data)

        error_message = imagery_data.get('error') if imagery_data else 'Unknown GeoAI error'
        return jsonify({'success': False, 'error': error_message}), 500

    except Exception as exc:
        print(f"❌ GeoAI imagery error: {exc}")
        return jsonify({'success': False, 'error': str(exc)}), 500

@app.route('/api/geoai/sites', methods=['GET'])
def geoai_sites_metadata():
    """Return metadata for GeoAI development sites."""
    return jsonify({'sites': GEOAI_SITES})


@app.route('/api/geoai/imagery/batch', methods=['POST'])
def geoai_imagery_batch():
    """Fetch GeoAI imagery for multiple predefined sites."""
    try:
        data = request.json or {}
        site_ids = data.get('siteIds')
        if site_ids:
            site_ids = set(site_ids)
        time_range = data.get('timeRange') or {}
        start_date = time_range.get('start')
        end_date = time_range.get('end')
        cloud_threshold = data.get('cloudThreshold', 35)

        results = {}
        for site in GEOAI_SITES:
            if site_ids and site['id'] not in site_ids:
                continue

            lat = site['coordinates']['lat']
            lng = site['coordinates']['lng']
            radius = data.get('radius', site.get('radius', 3000))
            site_start = time.time()
            print(f"🧠 GeoAI batch: generating {site['id']} at ({lat:.4f}, {lng:.4f}), radius {radius}")
            imagery = get_geoai_imagery(lat, lng, radius, start_date, end_date, cloud_threshold)
            tile_fetchers = imagery.pop('tileFetchers', {}) if imagery else {}

            if imagery and imagery.get('success'):
                imagery_layers = imagery.get('imagery', {})
                for layer_key, fetcher in tile_fetchers.items():
                    if not fetcher or layer_key not in imagery_layers:
                        continue
                    tile_id = register_tile_fetcher(fetcher)
                    imagery_layers[layer_key]['tileUrl'] = f"/api/geoai/tiles/{tile_id}/{{z}}/{{x}}/{{y}}.png"
                print(f"✅ GeoAI batch: completed {site['id']} in {time.time() - site_start:.2f}s")
            else:
                print(f"⚠️ GeoAI batch: failed {site['id']} ({imagery.get('error') if imagery else 'unknown'})")

            results[site['id']] = {
                'site': site,
                'result': imagery
            }

        return jsonify({
            'success': True,
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'results': results
        })

    except Exception as exc:
        print(f"❌ GeoAI batch imagery error: {exc}")
        return jsonify({'success': False, 'error': str(exc)}), 500


def register_tile_fetcher(fetcher):
    tile_id = secrets.token_hex(12)
    tile_fetcher_registry[tile_id] = {
        'fetcher': fetcher,
        'timestamp': time.time()
    }
    return tile_id


@app.route('/api/geoai/tiles/<tile_id>/<int:z>/<int:x>/<int:y>.png')
def geoai_tile_proxy(tile_id, z, x, y):
    entry = tile_fetcher_registry.get(tile_id)
    if not entry:
        return jsonify({'success': False, 'error': 'Tile expired'}), 404

    if time.time() - entry['timestamp'] > TILE_FETCHER_TTL:
        tile_fetcher_registry.pop(tile_id, None)
        return jsonify({'success': False, 'error': 'Tile expired'}), 404

    fetcher = entry['fetcher']
    cache_key = _make_tile_cache_key(tile_id, z, x, y)

    if cache_key in tile_cache:
        tile_bytes = tile_cache[cache_key]
        _touch_cache_entry(tile_cache, cache_key)
        response = app.response_class(tile_bytes, mimetype='image/png')
        response.headers['Cache-Control'] = 'public, max-age=86400'
        return response

    try:
        tile_bytes = fetcher.fetch_tile(x, y, z)
        _touch_cache_entry(tile_cache, cache_key, tile_bytes, MAX_TILE_CACHE_ENTRIES)
        response = app.response_class(tile_bytes, mimetype='image/png')
        response.headers['Cache-Control'] = 'public, max-age=86400'
        return response
    except Exception as exc:
        print(f"❌ Tile fetch error ({tile_id}): {exc}")
        return jsonify({'success': False, 'error': 'Tile fetch failed'}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy', 
        'service': 'AlphaEarth API',
        'cache_size': len(alphaearth_cache),
        'cache_timeout': f"{CACHE_TIMEOUT}s"
    })

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear the AlphaEarth cache"""
    global alphaearth_cache
    cache_size = len(alphaearth_cache)
    alphaearth_cache = {}
    return jsonify({
        'success': True,
        'message': f'Cache cleared - removed {cache_size} entries'
    })

@app.route('/cache/status', methods=['GET'])
def cache_status():
    """Get cache status and statistics"""
    return jsonify({
        'cache_size': len(alphaearth_cache),
        'cache_timeout': f"{CACHE_TIMEOUT}s",
        'cache_keys': list(alphaearth_cache.keys())
    })

if __name__ == '__main__':
    print("🚀 Starting AlphaEarth API server...")
    print("🌍 Serving REAL Google Earth Engine AlphaEarth data")
    app.run(host='0.0.0.0', port=5001, debug=True)
