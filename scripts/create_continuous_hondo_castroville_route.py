#!/usr/bin/env python3
"""
Create a continuous route line from the exact endpoint of Leakey→Utopia→Hondo route to Castroville.
This ensures the routes connect seamlessly.
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
    # Exact endpoint from Leakey→Utopia→Hondo route (lon, lat)
    hondo_endpoint = (-99.281996, 29.346651)  # From previous route
    
    # Castroville coordinates (lon, lat)
    castroville_coords = (-98.878, 29.355)  # Castroville, TX
    
    print("Creating continuous route: Hondo endpoint → Castroville")
    print(f"Start point (Hondo endpoint): {hondo_endpoint}")
    print(f"End point (Castroville): {castroville_coords}")
    
    # Get route from OSRM
    route_geometry = get_osrm_route(hondo_endpoint, castroville_coords)
    
    if not route_geometry:
        print("❌ Failed to get route from OSRM")
        return False
    
    # Create GeoJSON feature
    feature = {
        "type": "Feature",
        "geometry": route_geometry,
        "properties": {
            "name": "Hondo → Castroville Route",
            "description": "Continuous driving route connecting to Leakey-Utopia-Hondo endpoint",
            "route_type": "continuous_navigation",
            "connects_to": "leakey_utopia_hondo_route",
            "start_point": "Hondo, TX",
            "end_point": "Castroville, TX"
        }
    }
    
    # Create GeoJSON FeatureCollection
    geojson_data = {
        "type": "FeatureCollection",
        "features": [feature]
    }
    
    # Save to file
    output_file = '../public/data/continuous_hondo_castroville_route.geojson'
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
    
    # Verify connection by checking first coordinate matches our endpoint
    first_coord = route_geometry['coordinates'][0]
    print(f"\n🔗 Connection verification:")
    print(f"Expected start: [{hondo_endpoint[0]}, {hondo_endpoint[1]}]")
    print(f"Actual start:   [{first_coord[0]}, {first_coord[1]}]")
    
    # Check if they're close (within ~10 meters)
    distance = ((first_coord[0] - hondo_endpoint[0])**2 + (first_coord[1] - hondo_endpoint[1])**2)**0.5
    if distance < 0.0001:  # roughly 10 meters
        print("✅ Routes connect properly!")
    else:
        print(f"⚠️  Small gap between routes: {distance:.6f} degrees")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)