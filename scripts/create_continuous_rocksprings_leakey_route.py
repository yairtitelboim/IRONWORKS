#!/usr/bin/env python3
"""
Create a continuous route line from Rocksprings → Leakey using routing API.
This will create a single, continuous LineString with proper navigation coordinates.
"""

import requests
import json
import sys

def get_osrm_route(start_coord, end_coord):
    """Get route using OSRM (Open Source Routing Machine) - free routing API"""
    # OSRM demo server - coordinates in lon,lat format
    coordinates = f"{start_coord[0]},{start_coord[1]};{end_coord[0]},{end_coord[1]}"
    
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

def main():
    # Coordinates: Rocksprings → Leakey (lat, lon format)
    rocksprings_coords = (30.015, -100.210)  # Rocksprings, TX
    leakey_coords = (29.726, -99.757)         # Leakey, TX
    
    # Convert to (lon, lat) for OSRM API
    rocksprings_osrm = (rocksprings_coords[1], rocksprings_coords[0])
    leakey_osrm = (leakey_coords[1], leakey_coords[0])
    
    print("Creating continuous route: Rocksprings → Leakey")
    print(f"Start point (Rocksprings): {rocksprings_coords}")
    print(f"End point (Leakey): {leakey_coords}")
    
    # Get route from OSRM
    route_geometry = get_osrm_route(rocksprings_osrm, leakey_osrm)
    
    if not route_geometry:
        print("❌ Failed to get route from OSRM")
        return False
    
    # Create GeoJSON feature
    feature = {
        "type": "Feature",
        "geometry": route_geometry,
        "properties": {
            "name": "Rocksprings → Leakey Route",
            "description": "Continuous driving route through Texas towns",
            "route_type": "continuous_navigation",
            "start_point": "Rocksprings, TX",
            "end_point": "Leakey, TX"
        }
    }
    
    # Create GeoJSON FeatureCollection
    geojson_data = {
        "type": "FeatureCollection",
        "features": [feature]
    }
    
    # Save to file
    output_file = '../public/data/continuous_rocksprings_leakey_route.geojson'
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
    
    # Show endpoint for potential connection to next route
    endpoint = route_geometry['coordinates'][-1]
    print(f"🎯 Route endpoint (Leakey): [{endpoint[0]}, {endpoint[1]}]")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)