#!/usr/bin/env python3
"""
Fetch only the single main line of US-90 connecting Hondo to Castroville, 
filtering out any branches or splits.
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
    # Coordinates for Hondo and Castroville, Texas
    HONDO_COORDS = (29.347, -99.282)  # (lat, lon)
    CASTROVILLE_COORDS = (29.355, -98.878)  # (lat, lon)
    
    # Create a tight bounding box
    BUFFER = 0.015  # Very small buffer, about 1.5km
    min_lat = min(HONDO_COORDS[0], CASTROVILLE_COORDS[0]) - BUFFER
    max_lat = max(HONDO_COORDS[0], CASTROVILLE_COORDS[0]) + BUFFER
    min_lon = min(HONDO_COORDS[1], CASTROVILLE_COORDS[1]) - BUFFER
    max_lon = max(HONDO_COORDS[1], CASTROVILLE_COORDS[1]) + BUFFER
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    print(f"Tight bounding box: {bbox}")
    
    # Very targeted query for just US-90 trunk roads
    overpass_query = f"""
    [out:json][timeout:60];
    (
      // Only trunk roads with US 90 designation
      way["highway"="trunk"]["ref"~"^(US )?90"]({bbox});
      
      // US-90 relations
      relation["highway"]["ref"~"^(US )?90"]({bbox});
    );
    out geom;
    """
    
    print("Fetching US-90 trunk road data...")
    
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
                    
                    # Only include trunk roads with US 90 reference
                    if highway_type == 'trunk' and ('90' in ref or 'US 90' in ref):
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
                                "segment_name": "US-90 Main Line"
                            }
                        }
                        all_features.append(feature)
        
        print(f"Found {len(all_features)} US-90 trunk segments")
        
        # Filter out branches by keeping only segments that are close to the main line between cities
        main_line_features = []
        
        # Create a theoretical straight line between Hondo and Castroville
        direct_line_start = [HONDO_COORDS[1], HONDO_COORDS[0]]  # [lon, lat]
        direct_line_end = [CASTROVILLE_COORDS[1], CASTROVILLE_COORDS[0]]  # [lon, lat]
        
        MAX_DEVIATION = 0.01  # Maximum deviation from direct line (about 1km)
        
        for feature in all_features:
            coordinates = feature['geometry']['coordinates']
            
            # Check if this road segment stays close to the main line
            is_main_line = True
            deviation_count = 0
            
            for coord in coordinates:
                # Calculate distance from this point to the theoretical direct line
                distance = point_to_line_distance(coord, direct_line_start, direct_line_end)
                
                if distance > MAX_DEVIATION:
                    deviation_count += 1
            
            # If more than 20% of points deviate significantly, it's probably a branch
            deviation_ratio = deviation_count / len(coordinates)
            if deviation_ratio < 0.2:  # Less than 20% deviation
                main_line_features.append(feature)
                print(f"Keeping main line segment: {feature['properties']['ref']} {feature['properties']['name']} (deviation: {deviation_ratio:.2f})")
            else:
                print(f"Filtering out branch: {feature['properties']['ref']} {feature['properties']['name']} (deviation: {deviation_ratio:.2f})")
        
        print(f"Filtered to {len(main_line_features)} main line segments")
        
        # Create GeoJSON structure
        geojson_data = {
            "type": "FeatureCollection",
            "features": main_line_features
        }
        
        # Save to file
        output_file = '../public/data/single_hondo_castroville_line.geojson'
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