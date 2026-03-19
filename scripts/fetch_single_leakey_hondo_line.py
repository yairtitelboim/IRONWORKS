#!/usr/bin/env python3
"""
Fetch only the single main road connecting Leakey to Hondo, Texas.
Focus on the primary route, likely FM-337 or similar.
"""

import requests
import json
import sys
import math

def point_to_line_distance(point, line_start, line_end):
    """Calculate the shortest distance from a point to a line segment."""
    px, py = point
    x1, y1 = line_start
    x2, y2 = line_end
    
    # Vector from line start to end
    dx = x2 - x1
    dy = y2 - y1
    
    if dx == 0 and dy == 0:
        # Line is actually a point
        return math.sqrt((px - x1)**2 + (py - y1)**2)
    
    # Parameter t represents position along the line segment
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    
    if t < 0:
        # Point is closest to start of line segment
        return math.sqrt((px - x1)**2 + (py - y1)**2)
    elif t > 1:
        # Point is closest to end of line segment
        return math.sqrt((px - x2)**2 + (py - y2)**2)
    else:
        # Point projects onto the line segment
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return math.sqrt((px - proj_x)**2 + (py - proj_y)**2)

def main():
    # Coordinates for Leakey and Hondo, Texas
    LEAKEY_COORDS = (29.726, -99.757)  # (lat, lon)
    HONDO_COORDS = (29.347, -99.282)   # (lat, lon)
    
    # Create a focused bounding box
    BUFFER = 0.02  # About 2km buffer
    min_lat = min(LEAKEY_COORDS[0], HONDO_COORDS[0]) - BUFFER
    max_lat = max(LEAKEY_COORDS[0], HONDO_COORDS[0]) + BUFFER
    min_lon = min(LEAKEY_COORDS[1], HONDO_COORDS[1]) - BUFFER
    max_lon = max(LEAKEY_COORDS[1], HONDO_COORDS[1]) + BUFFER
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    print(f"Bounding box for Leakey to Hondo: {bbox}")
    
    # Targeted query for main roads connecting these cities
    overpass_query = f"""
    [out:json][timeout:60];
    (
      // Primary and secondary highways
      way["highway"~"^(primary|secondary|trunk)$"]({bbox});
      
      // Farm-to-Market roads (common in Texas rural areas)
      way["highway"]["ref"~"^(FM|RM|SH) "]({bbox});
      
      // Specific routes that might connect these areas
      way["highway"]["ref"~"^(FM )?337$"]({bbox});
      way["highway"]["ref"~"^(FM )?1050$"]({bbox});
      way["highway"]["ref"~"^(TX )?16$"]({bbox});
      
      // Relations for complete routes
      relation["highway"]["ref"~"^(FM )?337$"]({bbox});
      relation["highway"]["ref"~"^(FM )?1050$"]({bbox});
    );
    out geom;
    """
    
    print("Fetching main road data from Leakey to Hondo...")
    
    try:
        # Make request to Overpass API
        overpass_url = "http://overpass-api.de/api/interpreter"
        response = requests.post(overpass_url, data=overpass_query, timeout=120)
        response.raise_for_status()
        
        osm_data = response.json()
        print(f"Retrieved {len(osm_data['elements'])} OSM elements")
        
        # Convert OSM data to GeoJSON
        all_features = []
        
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
                    
                    # Filter for main roads
                    is_main_road = (
                        highway_type in ['primary', 'secondary', 'trunk'] or
                        'FM' in ref or 'RM' in ref or 'SH' in ref or '337' in ref or '1050' in ref or
                        any(keyword in name for keyword in ['Farm', 'Ranch', 'State', 'Highway'])
                    )
                    
                    if is_main_road:
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
                                "segment_name": "Leakey to Hondo Main Road"
                            }
                        }
                        all_features.append(feature)
                        print(f"Found road: {highway_type} {ref} {name}")
        
        print(f"Found {len(all_features)} potential road segments")
        
        if len(all_features) == 0:
            print("No main roads found! Trying broader search...")
            # Fallback to any roads
            for element in osm_data['elements']:
                if element['type'] == 'way' and 'geometry' in element:
                    coordinates = []
                    for node in element['geometry']:
                        coordinates.append([node['lon'], node['lat']])
                    
                    if len(coordinates) >= 2:
                        tags = element.get('tags', {})
                        highway_type = tags.get('highway', 'unknown')
                        
                        if highway_type not in ['footway', 'path', 'cycleway', 'steps']:
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
                                    "segment_name": "Leakey to Hondo Main Road"
                                }
                            }
                            all_features.append(feature)
        
        # Filter out branches by keeping only segments close to the direct line
        main_line_features = []
        
        # Create theoretical direct line between Leakey and Hondo
        direct_line_start = [LEAKEY_COORDS[1], LEAKEY_COORDS[0]]  # [lon, lat]
        direct_line_end = [HONDO_COORDS[1], HONDO_COORDS[0]]  # [lon, lat]
        
        MAX_DEVIATION = 0.02  # Maximum deviation from direct line (about 2km)
        
        for feature in all_features:
            coordinates = feature['geometry']['coordinates']
            
            # Check if this road segment stays reasonably close to the main line
            deviation_count = 0
            
            for coord in coordinates:
                # Calculate distance from this point to the theoretical direct line
                distance = point_to_line_distance(coord, direct_line_start, direct_line_end)
                
                if distance > MAX_DEVIATION:
                    deviation_count += 1
            
            # If less than 30% of points deviate significantly, keep it
            deviation_ratio = deviation_count / len(coordinates)
            if deviation_ratio < 0.3:  # Less than 30% deviation
                main_line_features.append(feature)
                ref_info = f"{feature['properties']['ref']} {feature['properties']['name']}".strip()
                print(f"Keeping: {feature['properties']['highway']} {ref_info} (deviation: {deviation_ratio:.2f})")
            else:
                ref_info = f"{feature['properties']['ref']} {feature['properties']['name']}".strip()
                print(f"Filtering out: {feature['properties']['highway']} {ref_info} (deviation: {deviation_ratio:.2f})")
        
        print(f"Filtered to {len(main_line_features)} main line segments")
        
        # Create GeoJSON structure
        geojson_data = {
            "type": "FeatureCollection",
            "features": main_line_features
        }
        
        # Save to file
        output_file = '../public/data/single_leakey_hondo_line.geojson'
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"Saved single line GeoJSON file: {output_file}")
        
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