#!/usr/bin/env python3
"""
Create a route from Cibola, AZ to Phoenix-area sites using OSRM routing.
This generates a continuous LineString GeoJSON file for the route.
"""

import requests
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "public" / "data" / "cibola_phoenix"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def get_osrm_route(waypoints):
    """Get route using OSRM (Open Source Routing Machine) - free routing API"""
    # OSRM demo server - coordinates in lon,lat format
    coordinates = ";".join([f"{lon},{lat}" for lon, lat in waypoints])
    
    # OSRM routing URL
    url = f"http://router.project-osrm.org/route/v1/driving/{coordinates}"
    params = {
        'overview': 'full',  # Get full geometry
        'geometries': 'geojson',  # Return as GeoJSON
        'steps': 'false'  # We don't need turn-by-turn
    }
    
    try:
        print(f"Requesting route from OSRM: {len(waypoints)} waypoints")
        response = requests.get(url, params=params, timeout=60)
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
    # Coordinates: Cibola → Phoenix sites (lon, lat format)
    # Cibola, AZ
    cibola = (-114.665, 33.3164)
    
    # Phoenix-area sites (in order of connection)
    phoenix_sites = [
        (-112.1667, 33.7250),  # TSMC Phoenix
        (-112.0740, 33.4484),  # TSMC Phoenix Water
        (-112.2800, 33.7100),  # Amkor Technology
        (-112.1650, 33.7200),  # Linde Industrial Gas
        (-112.1600, 33.7150),  # Halo Vista
        (-111.8844, 33.2431),  # Intel Ocotillo (Chandler)
        (-111.8617, 33.3260),  # NXP Semiconductors (Chandler)
    ]
    
    # Create route from Cibola through all Phoenix sites
    waypoints = [cibola] + phoenix_sites
    
    print("Creating route: Cibola, AZ → Phoenix-area sites")
    print(f"Waypoints: {len(waypoints)}")
    
    geometry = get_osrm_route(waypoints)
    
    if not geometry:
        print("❌ Failed to generate route")
        sys.exit(1)
    
    # Create GeoJSON Feature
    feature = {
        "type": "Feature",
        "properties": {
            "name": "Cibola to Phoenix Utility Connection Route",
            "description": "Major utility connection route from Cibola, AZ to Phoenix-area semiconductor sites",
            "distance_km": None,  # Will be calculated if needed
            "route_type": "utility_connection"
        },
        "geometry": geometry
    }
    
    # Create FeatureCollection
    geojson = {
        "type": "FeatureCollection",
        "features": [feature]
    }
    
    # Save to file
    output_file = OUTPUT_DIR / "cibola_to_phoenix_route.geojson"
    with open(output_file, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"✅ Route saved to: {output_file}")
    print(f"   Coordinates: {len(geometry['coordinates'])} points")

if __name__ == "__main__":
    main()

