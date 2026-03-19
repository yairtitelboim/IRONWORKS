#!/usr/bin/env python3
"""
Fetch just the main road connecting Hondo to Castroville, Texas using Overpass API.
Focus on the primary route, likely US-90 or TX-16.
"""

import requests
import json
import sys
import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers."""
    R = 6371  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def main():
    # Coordinates for Hondo and Castroville, Texas
    HONDO_COORDS = (29.347, -99.282)  # (lat, lon)
    CASTROVILLE_COORDS = (29.355, -98.878)  # (lat, lon)
    
    # Create a more focused bounding box
    BUFFER = 0.02  # Smaller buffer, about 2km
    min_lat = min(HONDO_COORDS[0], CASTROVILLE_COORDS[0]) - BUFFER
    max_lat = max(HONDO_COORDS[0], CASTROVILLE_COORDS[0]) + BUFFER
    min_lon = min(HONDO_COORDS[1], CASTROVILLE_COORDS[1]) - BUFFER
    max_lon = max(HONDO_COORDS[1], CASTROVILLE_COORDS[1]) + BUFFER
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    print(f"Focused bounding box: {bbox}")
    
    # More targeted Overpass query for main roads only
    overpass_query = f"""
    [out:json][timeout:60];
    (
      // Primary highways (main connections between cities)
      way["highway"="primary"]({bbox});
      way["highway"="trunk"]({bbox});
      
      // Specific named highways that connect these cities
      way["highway"]["ref"~"^(US )?90$"]({bbox});
      way["highway"]["ref"~"^(TX )?16$"]({bbox});
      
      // Relations for complete route coverage
      relation["highway"]["ref"~"^(US )?90$"]({bbox});
      relation["highway"]["ref"~"^(TX )?16$"]({bbox});
    );
    out geom;
    """
    
    print("Fetching main road data from Overpass API...")
    
    try:
        # Make request to Overpass API
        overpass_url = "http://overpass-api.de/api/interpreter"
        response = requests.post(overpass_url, data=overpass_query, timeout=120)
        response.raise_for_status()
        
        osm_data = response.json()
        print(f"Retrieved {len(osm_data['elements'])} OSM elements")
        
        # Convert OSM data to GeoJSON and filter for main roads
        features = []
        
        for element in osm_data['elements']:
            if element['type'] == 'way' and 'geometry' in element:
                # Extract coordinates
                coordinates = []
                for node in element['geometry']:
                    coordinates.append([node['lon'], node['lat']])
                
                if len(coordinates) >= 2:  # Valid LineString needs at least 2 points
                    # Get road properties
                    tags = element.get('tags', {})
                    highway_type = tags.get('highway', 'unknown')
                    ref = tags.get('ref', '')
                    name = tags.get('name', '')
                    
                    # Filter for main roads only
                    is_main_road = (
                        highway_type in ['primary', 'trunk'] or 
                        'US 90' in ref or 'TX 16' in ref or '90' in ref or '16' in ref or
                        'US' in name or 'State Highway' in name
                    )
                    
                    if is_main_road:
                        # Calculate if this road segment is roughly in the direction between cities
                        start_coord = coordinates[0]
                        end_coord = coordinates[-1]
                        
                        # Check if road segment is generally oriented east-west (Hondo to Castroville)
                        road_direction = abs(start_coord[0] - end_coord[0])  # longitude difference
                        road_north_south = abs(start_coord[1] - end_coord[1])  # latitude difference
                        
                        # Prefer roads that go more east-west than north-south
                        is_reasonable_direction = road_direction > road_north_south * 0.3
                        
                        if is_reasonable_direction:
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
                                    "segment_name": "Main Road Hondo to Castroville"
                                }
                            }
                            features.append(feature)
                            print(f"Added main road: {highway_type} {ref} {name}")
        
        print(f"Created {len(features)} main road GeoJSON features")
        
        if len(features) == 0:
            print("No main roads found! Falling back to any primary/secondary roads...")
            # Fallback: get any primary or secondary roads
            for element in osm_data['elements']:
                if element['type'] == 'way' and 'geometry' in element:
                    coordinates = []
                    for node in element['geometry']:
                        coordinates.append([node['lon'], node['lat']])
                    
                    if len(coordinates) >= 2:
                        tags = element.get('tags', {})
                        highway_type = tags.get('highway', 'unknown')
                        
                        if highway_type in ['primary', 'secondary', 'trunk']:
                            feature = {
                                "type": "Feature",
                                "geometry": {
                                    "type": "LineString",
                                    "coordinates": coordinates
                                },
                                "properties": {
                                    "osm_id": element['id'],
                                    "highway": highway_type,
                                    "ref": tags.get('ref', ''),
                                    "name": tags.get('name', ''),
                                    "segment_name": "Main Road Hondo to Castroville"
                                }
                            }
                            features.append(feature)
            
            print(f"Fallback: Created {len(features)} road features")
        
        # Create GeoJSON structure
        geojson_data = {
            "type": "FeatureCollection",
            "features": features
        }
        
        # Save to file
        output_file = '../public/data/main_hondo_castroville_road.geojson'
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"Saved main road GeoJSON file: {output_file}")
        
        # Print file size
        import os
        file_size = os.path.getsize(output_file)
        print(f"File size: {file_size:,} bytes")
        
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