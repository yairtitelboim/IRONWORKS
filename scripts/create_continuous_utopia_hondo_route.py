#!/usr/bin/env python3
"""
Create a continuous route line from Utopia → Hondo using routing API.
This route starts from the exact endpoint of Junction → Utopia route.
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
    # Use exact endpoint from Junction → Utopia route as starting point
    utopia_endpoint_coords = (-99.532995, 29.615185)  # From Junction → Utopia endpoint
    hondo_coords = (29.347, -99.282)  # Hondo, TX (lat, lon)
    
    # Convert to (lon, lat) for OSRM API
    utopia_osrm = (utopia_endpoint_coords[0], utopia_endpoint_coords[1])  # Already in lon,lat
    hondo_osrm = (hondo_coords[1], hondo_coords[0])  # Convert lat,lon to lon,lat
    
    print("Creating continuous route: Utopia → Hondo")
    print(f"Start point (Utopia endpoint from Junction route): {utopia_endpoint_coords}")
    print(f"End point (Hondo): {hondo_coords}")
    print("This route connects with the Junction → Utopia endpoint")
    
    # Get route from OSRM
    route_geometry = get_osrm_route(utopia_osrm, hondo_osrm)
    
    if not route_geometry:
        print("❌ Failed to get route from OSRM")
        return False
    
    # Create GeoJSON feature
    feature = {
        "type": "Feature",
        "geometry": route_geometry,
        "properties": {
            "name": "Utopia → Hondo Route",
            "description": "Continuous driving route from Utopia to Hondo, connecting with Junction → Utopia",
            "route_type": "continuous_navigation",
            "start_point": "Utopia, TX",
            "end_point": "Hondo, TX",
            "connects_from": "Junction → Utopia route"
        }
    }
    
    # Create GeoJSON FeatureCollection
    geojson_data = {
        "type": "FeatureCollection",
        "features": [feature]
    }
    
    # Save to file (replacing the old Leakey → Utopia → Hondo file)
    output_file = '../public/data/continuous_utopia_hondo_route.geojson'
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
    
    # Show both endpoints
    startpoint = route_geometry['coordinates'][0]
    endpoint = route_geometry['coordinates'][-1]
    print(f"🎯 Route startpoint (Utopia): [{startpoint[0]}, {startpoint[1]}]")
    print(f"🎯 Route endpoint (Hondo): [{endpoint[0]}, {endpoint[1]}]")
    
    # Verify connection with Junction → Utopia endpoint
    junction_utopia_endpoint = [-99.532995, 29.615185]
    print(f"\n🔗 Connection verification:")
    print(f"Junction → Utopia endpoint: {junction_utopia_endpoint}")
    print(f"Utopia → Hondo startpoint:  [{startpoint[0]}, {startpoint[1]}]")
    
    distance = ((startpoint[0] - junction_utopia_endpoint[0])**2 + (startpoint[1] - junction_utopia_endpoint[1])**2)**0.5
    if distance < 0.0001:  # roughly 10 meters
        print("✅ Routes connect perfectly!")
    else:
        print(f"⚠️  Small gap between routes: {distance:.6f} degrees")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)