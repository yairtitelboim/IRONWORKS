#!/usr/bin/env python3
"""
Fetch I-70 highway segments centered on Kansas City, Missouri.
Creates a 1000-mile corridor (500 miles west + 500 miles east) of I-70.

This script uses the Overpass API to fetch actual I-70 highway segments
from OpenStreetMap, covering the major east-west corridor through the central United States.
"""

import requests
import json
import sys
import math
import time
import os

def calculate_lat_lon_buffer(center_lat, center_lon, distance_miles):
    """
    Calculate latitude/longitude bounds for a given distance in miles.
    
    Args:
        center_lat: Center latitude (Kansas City)
        center_lon: Center longitude (Kansas City)  
        distance_miles: Distance in miles to extend in each direction
    
    Returns:
        tuple: (min_lat, min_lon, max_lat, max_lon)
    """
    # Rough conversion: 1 degree latitude ≈ 69 miles
    # 1 degree longitude varies by latitude, but at ~39°N ≈ 54 miles
    lat_degrees_per_mile = 1.0 / 69.0
    lon_degrees_per_mile = 1.0 / (69.0 * math.cos(math.radians(center_lat)))
    
    lat_buffer = distance_miles * lat_degrees_per_mile
    lon_buffer = distance_miles * lon_degrees_per_mile
    
    min_lat = center_lat - lat_buffer
    max_lat = center_lat + lat_buffer
    min_lon = center_lon - lon_buffer
    max_lon = center_lon + lon_buffer
    
    return (min_lat, min_lon, max_lat, max_lon)

def build_i70_overpass_query(bbox):
    """
    Build comprehensive Overpass query for I-70 highway segments.
    
    Args:
        bbox: Tuple of (min_lat, min_lon, max_lat, max_lon)
    
    Returns:
        str: Overpass query string
    """
    min_lat, min_lon, max_lat, max_lon = bbox
    bbox_str = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    
    query = f"""
[out:json][timeout:180];
(
  // I-70 ways with various reference formats
  way["highway"]["ref"~"^(I-?70|Interstate 70)$"]({bbox_str});
  way["highway"]["ref"~"^70$"]["highway"~"^(motorway|trunk)$"]({bbox_str});
  
  // I-70 Business routes and branches
  way["highway"]["ref"~"^I-?70[EWNS]?$"]({bbox_str});
  way["highway"]["ref"~"^I-?70 Business$"]({bbox_str});
  way["highway"]["ref"~"^I-?70 BL$"]({bbox_str});
  way["highway"]["ref"~"^I-?70 BS$"]({bbox_str});
  
  // I-70 in relations (complete route coverage)
  relation["route"="road"]["ref"~"^(I-?70|Interstate 70)$"]({bbox_str});
  way(r)["highway"];
  
  // Motorways and trunks that might be I-70 but tagged differently
  way["highway"~"^(motorway|trunk)$"]["name"~".*70.*"]({bbox_str});
  way["highway"~"^(motorway|trunk)$"]["name"~".*Interstate.*70.*"]({bbox_str});
  
  // I-70 links and ramps
  way["highway"~"^(motorway_link|trunk_link)$"]["ref"~"70"]({bbox_str});
);
out geom;
"""
    return query.strip()

def fetch_i70_segments(bbox):
    """
    Fetch I-70 segments from Overpass API.
    
    Args:
        bbox: Bounding box tuple (min_lat, min_lon, max_lat, max_lon)
    
    Returns:
        dict: OSM data or None if failed
    """
    query = build_i70_overpass_query(bbox)
    
    print("Overpass Query:")
    print("-" * 50)
    print(query)
    print("-" * 50)
    
    try:
        overpass_url = "http://overpass-api.de/api/interpreter"
        print(f"Sending request to Overpass API...")
        
        response = requests.post(overpass_url, data=query, timeout=180)
        response.raise_for_status()
        
        data = response.json()
        
        if 'elements' not in data:
            print("❌ No 'elements' field in response")
            return None
            
        element_count = len(data['elements'])
        print(f"✅ Retrieved {element_count} OSM elements")
        
        if element_count == 0:
            print("⚠️  No I-70 segments found in the specified area")
            return None
            
        return data
        
    except requests.exceptions.Timeout:
        print("❌ Request timed out - try reducing the search area")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return None

def convert_osm_to_geojson(osm_data, metadata):
    """
    Convert OSM data to GeoJSON format.
    
    Args:
        osm_data: Raw OSM data from Overpass API
        metadata: Additional metadata to include
    
    Returns:
        dict: GeoJSON FeatureCollection
    """
    if not osm_data or 'elements' not in osm_data:
        return None
    
    features = []
    
    for element in osm_data['elements']:
        if element['type'] == 'way' and 'geometry' in element:
            # Convert way to LineString
            coordinates = []
            for point in element['geometry']:
                coordinates.append([point['lon'], point['lat']])
            
            if len(coordinates) < 2:
                continue  # Skip invalid geometries
            
            # Extract properties from OSM tags
            properties = element.get('tags', {})
            
            # Add our metadata
            properties.update({
                'osm_id': element['id'],
                'osm_type': 'way',
                'route_name': 'I-70 Kansas City Corridor',
                'route_description': 'Interstate 70 highway segments in 1000-mile Kansas City corridor',
                'corridor_center': 'Kansas City, MO'
            })
            
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    'coordinates': coordinates
                },
                'properties': properties
            }
            features.append(feature)
    
    # Create GeoJSON FeatureCollection
    geojson = {
        'type': 'FeatureCollection',
        'features': features,
        'metadata': {
            'route_name': 'I-70 Kansas City Corridor',
            'description': 'Interstate 70 highway segments covering 1000-mile corridor centered on Kansas City',
            'center_point': metadata['center_coords'],
            'corridor_radius_miles': metadata['radius_miles'],
            'bounding_box': metadata['bbox'],
            'generated_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()),
            'total_features': len(features),
            'osm_elements_processed': len(osm_data['elements'])
        }
    }
    
    return geojson

def save_geojson(geojson_data, output_path):
    """
    Save GeoJSON data to file.
    
    Args:
        geojson_data: GeoJSON FeatureCollection
        output_path: File path to save to
    
    Returns:
        bool: Success status
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f, indent=2, ensure_ascii=False)
        
        file_size = os.path.getsize(output_path)
        feature_count = len(geojson_data['features'])
        
        print(f"✅ Saved I-70 route data to: {output_path}")
        print(f"📊 File size: {file_size:,} bytes")
        print(f"📍 Total features: {feature_count:,} highway segments")
        
        return True
        
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return False

def main():
    """
    Main execution function.
    """
    print("🛣️  I-70 Kansas City Corridor Fetcher")
    print("=" * 60)
    
    # Kansas City, Missouri coordinates (approximate city center)
    KC_LAT = 39.0997
    KC_LON = -94.5786
    RADIUS_MILES = 500  # 500 miles in each direction = 1000-mile total corridor
    
    print(f"Center point: Kansas City, MO ({KC_LAT}, {KC_LON})")
    print(f"Corridor radius: {RADIUS_MILES} miles (1000-mile total corridor)")
    
    # Calculate bounding box
    bbox = calculate_lat_lon_buffer(KC_LAT, KC_LON, RADIUS_MILES)
    min_lat, min_lon, max_lat, max_lon = bbox
    
    print(f"Bounding box:")
    print(f"  North: {max_lat:.4f}° (≈{RADIUS_MILES} miles north of KC)")
    print(f"  South: {min_lat:.4f}° (≈{RADIUS_MILES} miles south of KC)")
    print(f"  East:  {max_lon:.4f}° (≈{RADIUS_MILES} miles east of KC)")
    print(f"  West:  {min_lon:.4f}° (≈{RADIUS_MILES} miles west of KC)")
    print()
    
    # This covers approximately:
    # West: Denver, CO area
    # East: St. Louis, MO area  
    # North: Minneapolis, MN area
    # South: Oklahoma City, OK area
    print("Approximate coverage:")
    print("  West: Denver, CO area")
    print("  East: St. Louis, MO area")
    print("  North: Minneapolis, MN area") 
    print("  South: Oklahoma City, OK area")
    print()
    
    # Fetch I-70 segments
    print("Fetching I-70 highway segments from OpenStreetMap...")
    osm_data = fetch_i70_segments(bbox)
    
    if not osm_data:
        print("❌ Failed to fetch I-70 data")
        return False
    
    # Convert to GeoJSON
    metadata = {
        'center_coords': [KC_LON, KC_LAT],  # GeoJSON uses [lon, lat]
        'radius_miles': RADIUS_MILES,
        'bbox': bbox
    }
    
    print("Converting OSM data to GeoJSON...")
    geojson_data = convert_osm_to_geojson(osm_data, metadata)
    
    if not geojson_data or not geojson_data['features']:
        print("❌ No valid I-70 features found")
        return False
    
    # Save to file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "..", "public", "data", "i70_kansas_city_corridor.geojson")
    
    success = save_geojson(geojson_data, output_path)
    
    if success:
        print("\n🎯 SUCCESS! I-70 Kansas City corridor data ready for mapping.")
        print(f"Load this file in your map application: {os.path.basename(output_path)}")
        
        # Show some statistics
        bbox_area_sq_miles = (max_lat - min_lat) * 69 * (max_lon - min_lon) * 54
        print(f"\n📈 Coverage Statistics:")
        print(f"  Corridor length: ~1000 miles")
        print(f"  Search area: ~{bbox_area_sq_miles:,.0f} square miles")
        print(f"  Highway segments: {len(geojson_data['features']):,}")
        
        return True
    else:
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)