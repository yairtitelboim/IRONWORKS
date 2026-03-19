#!/usr/bin/env python3
"""
Create a continuous route line from Leakey → Utopia → Hondo using routing APIs.
This will create a single, continuous LineString with proper navigation coordinates.
"""

import requests
import json
import sys
import time

def get_osrm_route(waypoints):
    """Get route using OSRM (Open Source Routing Machine) - free routing API"""
    # OSRM demo server - coordinates in lon,lat format
    coordinates = ";".join([f"{lon},{lat}" for lat, lon in waypoints])
    
    # OSRM routing URL
    url = f"http://router.project-osrm.org/route/v1/driving/{coordinates}"
    params = {
        'overview': 'full',  # Get full geometry
        'geometries': 'geojson',  # Return as GeoJSON
        'steps': 'false'  # We don't need turn-by-turn
    }
    
    try:
        print(f"Requesting route from OSRM: {url}")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if data['code'] != 'Ok':
            print(f"OSRM error: {data.get('message', 'Unknown error')}")
            return None
            
        route = data['routes'][0]
        geometry = route['geometry']
        
        print(f"✅ Route found: {route['distance']/1000:.1f} km, {route['duration']/60:.1f} minutes")
        return geometry
        
    except Exception as e:
        print(f"❌ OSRM routing failed: {e}")
        return None

def get_mapbox_route(waypoints, access_token=None):
    """Get route using Mapbox Directions API (requires API key)"""
    if not access_token:
        print("⚠️  Mapbox access token not provided, skipping Mapbox routing")
        return None
    
    # Mapbox coordinates in lon,lat format
    coordinates = ";".join([f"{lon},{lat}" for lat, lon in waypoints])
    
    url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coordinates}"
    params = {
        'access_token': access_token,
        'overview': 'full',
        'geometries': 'geojson'
    }
    
    try:
        print(f"Requesting route from Mapbox...")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if 'routes' not in data or len(data['routes']) == 0:
            print(f"Mapbox error: No routes found")
            return None
            
        route = data['routes'][0]
        geometry = route['geometry']
        
        print(f"✅ Mapbox route found: {route['distance']/1000:.1f} km, {route['duration']/60:.1f} minutes")
        return geometry
        
    except Exception as e:
        print(f"❌ Mapbox routing failed: {e}")
        return None

def main():
    # Route waypoints: Leakey → Utopia → Hondo
    waypoints = [
        (29.726, -99.757),  # Leakey, TX (lat, lon)
        (29.615, -99.533),  # Utopia, TX (lat, lon)
        (29.347, -99.282)   # Hondo, TX (lat, lon)
    ]
    
    print("Creating continuous route: Leakey → Utopia → Hondo")
    print(f"Waypoints: {waypoints}")
    
    # Try OSRM first (free, no API key needed)
    route_geometry = get_osrm_route(waypoints)
    
    # If OSRM fails, could try Mapbox (requires API key)
    # mapbox_token = "your_mapbox_token_here"  # Replace with actual token
    # if not route_geometry:
    #     route_geometry = get_mapbox_route(waypoints, mapbox_token)
    
    if not route_geometry:
        print("❌ Failed to get route from any routing service")
        return False
    
    # Create GeoJSON feature
    feature = {
        "type": "Feature",
        "geometry": route_geometry,
        "properties": {
            "name": "Leakey → Utopia → Hondo Route",
            "description": "Continuous driving route through Texas towns",
            "route_type": "continuous_navigation",
            "waypoints": ["Leakey, TX", "Utopia, TX", "Hondo, TX"]
        }
    }
    
    # Create GeoJSON FeatureCollection
    geojson_data = {
        "type": "FeatureCollection",
        "features": [feature]
    }
    
    # Save to file
    output_file = '../public/data/continuous_leakey_utopia_hondo_route.geojson'
    with open(output_file, 'w') as f:
        json.dump(geojson_data, f, separators=(',', ':'))
    
    print(f"✅ Saved continuous route to: {output_file}")
    
    # Show file size and coordinate count
    import os
    file_size = os.path.getsize(output_file)
    coord_count = len(route_geometry['coordinates'])
    
    print(f"📊 File size: {file_size:,} bytes")
    print(f"📍 Route coordinates: {coord_count:,} points")
    print(f"🛣️  Route type: {route_geometry['type']}")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)