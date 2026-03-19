#!/usr/bin/env python3
"""
Fetch the specific route: Utopia → FM 470 → Tarpley → Hondo
Ensure it's a continuous line following this specific path.
"""

import requests
import json
import sys
import math

def main():
    # Coordinates for the route waypoints
    UTOPIA_COORDS = (29.615, -99.533)    # Utopia, TX (lat, lon)
    TARPLEY_COORDS = (29.578, -99.244)   # Tarpley, TX (lat, lon) 
    HONDO_COORDS = (29.347, -99.282)     # Hondo, TX (lat, lon)
    
    # Create a bounding box that covers all three towns
    BUFFER = 0.03  # About 3km buffer
    min_lat = min(UTOPIA_COORDS[0], TARPLEY_COORDS[0], HONDO_COORDS[0]) - BUFFER
    max_lat = max(UTOPIA_COORDS[0], TARPLEY_COORDS[0], HONDO_COORDS[0]) + BUFFER
    min_lon = min(UTOPIA_COORDS[1], TARPLEY_COORDS[1], HONDO_COORDS[1]) - BUFFER
    max_lon = max(UTOPIA_COORDS[1], TARPLEY_COORDS[1], HONDO_COORDS[1]) + BUFFER
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    print(f"Route bounding box (Utopia→Tarpley→Hondo): {bbox}")
    
    # Targeted query for FM 470 and connecting roads
    overpass_query = f"""
    [out:json][timeout:90];
    (
      // FM 470 specifically
      way["highway"]["ref"~"^(FM )?470$"]({bbox});
      
      // Secondary and primary roads in the area that might connect
      way["highway"~"^(secondary|primary)$"]["ref"~"^(FM|RM) "]({bbox});
      
      // Any road named FM 470
      way["highway"]["name"~"FM 470"]({bbox});
      way["highway"]["name"~"Farm.*470"]({bbox});
      
      // Relations for FM 470
      relation["highway"]["ref"~"^(FM )?470$"]({bbox});
      
      // Get connecting roads near each town
      way["highway"~"^(secondary|tertiary|primary)$"](around:1000,{UTOPIA_COORDS[0]},{UTOPIA_COORDS[1]});
      way["highway"~"^(secondary|tertiary|primary)$"](around:1000,{TARPLEY_COORDS[0]},{TARPLEY_COORDS[1]});
      way["highway"~"^(secondary|tertiary|primary)$"](around:1000,{HONDO_COORDS[0]},{HONDO_COORDS[1]});
    );
    out geom;
    """
    
    print("Fetching FM 470 and connecting roads...")
    
    try:
        # Make request to Overpass API
        overpass_url = "http://overpass-api.de/api/interpreter"
        response = requests.post(overpass_url, data=overpass_query, timeout=150)
        response.raise_for_status()
        
        osm_data = response.json()
        print(f"Retrieved {len(osm_data['elements'])} OSM elements")
        
        # Convert OSM data to GeoJSON
        all_features = []
        fm470_features = []
        connecting_features = []
        
        for element in osm_data['elements']:
            if element['type'] == 'way' and 'geometry' in element:
                # Extract coordinates
                coordinates = []
                for node in element['geometry']:
                    coordinates.append([node['lon'], node['lat']])
                
                if len(coordinates) >= 2:
                    tags = element.get('tags', {})
                    highway_type = tags.get('highway', 'unknown')
                    ref = tags.get('ref', '')
                    name = tags.get('name', '')
                    
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coordinates
                        },
                        "properties": {
                            "osm_id": element['id'],
                            "highway": highway_type,
                            "ref": ref,
                            "name": name,
                            "segment_name": "Utopia to Hondo via FM 470"
                        }
                    }
                    
                    # Prioritize FM 470 segments
                    if '470' in ref or 'FM 470' in name:
                        fm470_features.append(feature)
                        print(f"Found FM 470: {highway_type} {ref} {name}")
                    elif highway_type in ['secondary', 'primary', 'tertiary']:
                        connecting_features.append(feature)
                        print(f"Found connecting road: {highway_type} {ref} {name}")
        
        print(f"Found {len(fm470_features)} FM 470 segments")
        print(f"Found {len(connecting_features)} connecting road segments")
        
        # Combine FM 470 segments with key connecting roads
        route_features = fm470_features.copy()
        
        # Add connecting roads that are likely part of the main route
        for feature in connecting_features:
            coords = feature['geometry']['coordinates']
            ref = feature['properties']['ref']
            name = feature['properties']['name']
            
            # Check if this road segment is near our route waypoints
            near_waypoint = False
            for coord in coords[::5]:  # Check every 5th coordinate to speed up
                lon, lat = coord[0], coord[1]
                
                # Check distance to each waypoint (rough calculation)
                distances = [
                    abs(lat - UTOPIA_COORDS[0]) + abs(lon - UTOPIA_COORDS[1]),
                    abs(lat - TARPLEY_COORDS[0]) + abs(lon - TARPLEY_COORDS[1]),
                    abs(lat - HONDO_COORDS[0]) + abs(lon - HONDO_COORDS[1])
                ]
                
                # If close to any waypoint (within ~0.02 degrees = ~2km)
                if min(distances) < 0.02:
                    near_waypoint = True
                    break
            
            if near_waypoint:
                route_features.append(feature)
                print(f"Added connecting road: {ref} {name}")
        
        print(f"Total route segments: {len(route_features)}")
        
        if len(route_features) == 0:
            print("No route segments found! Trying fallback...")
            # Fallback: get any roads in the area
            route_features = connecting_features[:20]  # Limit to first 20
        
        # Create GeoJSON structure
        geojson_data = {
            "type": "FeatureCollection",
            "features": route_features
        }
        
        # Save to file
        output_file = '../public/data/utopia_tarpley_hondo_route.geojson'
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"Saved route GeoJSON file: {output_file}")
        
        # Print file size
        import os
        file_size = os.path.getsize(output_file)
        print(f"File size: {file_size:,} bytes")
        
        # Print summary of roads included
        refs = set()
        names = set()
        for feature in route_features:
            if feature['properties']['ref']:
                refs.add(feature['properties']['ref'])
            if feature['properties']['name']:
                names.add(feature['properties']['name'])
        
        print(f"Road references included: {', '.join(sorted(refs))}")
        if names:
            print(f"Road names included: {', '.join(sorted(names))}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from Overpass API: {e}")
        return False
    except Exception as e:
        print(f"Error processing data: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)