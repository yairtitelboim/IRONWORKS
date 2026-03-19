#!/usr/bin/env python3
"""
Fetch the road segment from Hondo to Castroville, Texas using Overpass API.
"""

import requests
import json
import sys

def main():
    # Coordinates for Hondo and Castroville, Texas
    HONDO_COORDS = (29.347, -99.282)  # (lat, lon)
    CASTROVILLE_COORDS = (29.355, -98.878)  # (lat, lon)
    
    # Create bounding box with buffer
    BUFFER = 0.05  # About 5.5km buffer
    min_lat = min(HONDO_COORDS[0], CASTROVILLE_COORDS[0]) - BUFFER
    max_lat = max(HONDO_COORDS[0], CASTROVILLE_COORDS[0]) + BUFFER
    min_lon = min(HONDO_COORDS[1], CASTROVILLE_COORDS[1]) - BUFFER
    max_lon = max(HONDO_COORDS[1], CASTROVILLE_COORDS[1]) + BUFFER
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    print(f"Bounding box: {bbox}")
    
    # Overpass query for roads connecting Hondo to Castroville
    overpass_query = f"""
    [out:json][timeout:60];
    (
      // Primary highways and roads in the area
      way["highway"~"^(primary|secondary|trunk|tertiary)$"]({bbox});
      way["highway"~"^(primary_link|secondary_link|trunk_link)$"]({bbox});
      
      // US highways that might connect these cities
      way["highway"]["ref"~"^(US )?90$"]({bbox});
      way["highway"]["ref"~"^(TX )?16$"]({bbox});
      
      // Relations for complete routes
      relation["highway"]["ref"~"^(US )?90$"]({bbox});
      relation["highway"]["ref"~"^(TX )?16$"]({bbox});
    );
    out geom;
    """
    
    print("Fetching road data from Overpass API...")
    
    try:
        # Make request to Overpass API
        overpass_url = "http://overpass-api.de/api/interpreter"
        response = requests.post(overpass_url, data=overpass_query, timeout=120)
        response.raise_for_status()
        
        osm_data = response.json()
        print(f"Retrieved {len(osm_data['elements'])} OSM elements")
        
        # Convert OSM data to GeoJSON
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
                            "segment_name": "Hondo to Castroville"
                        }
                    }
                    features.append(feature)
        
        print(f"Created {len(features)} GeoJSON features")
        
        # Create GeoJSON structure
        geojson_data = {
            "type": "FeatureCollection",
            "features": features
        }
        
        # Save to file
        output_file = '../public/data/hondo_castroville_segment.geojson'
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"Saved GeoJSON file: {output_file}")
        
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