#!/usr/bin/env python3
"""
Fetch Class I Railroad lines from a focused region using Overpass API.
Focuses on major freight railroads in the central United States region.

This creates a more manageable dataset by focusing on a specific geographic area.
"""

import requests
import json
import sys
import math
import time
import os

def calculate_central_us_bounding_box():
    """
    Calculate bounding box covering the central United States.
    Focuses on the area around our interstate corridors.
    
    Returns:
        tuple: (min_lat, min_lon, max_lat, max_lon)
    """
    # Central US bounds - similar to our interstate coverage
    min_lat = 29.0   # Southern Texas/Louisiana
    max_lat = 47.0   # Northern Minnesota/North Dakota  
    min_lon = -106.0 # Eastern Colorado/New Mexico
    max_lon = -88.0  # Western edge of Great Lakes
    
    return (min_lat, min_lon, max_lat, max_lon)

def build_railroad_overpass_query(bbox):
    """
    Build more efficient Overpass query for Class I railroad lines.
    
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
  // Main freight rail lines - focus on major routes
  way["railway"="rail"]["usage"="main"]({bbox_str});
  way["railway"="rail"]["service"="freight"]({bbox_str});
  
  // Specific Class I operators (if tagged)
  way["railway"="rail"]["operator"~".*BNSF.*"]({bbox_str});
  way["railway"="rail"]["operator"~".*Union Pacific.*"]({bbox_str});
  way["railway"="rail"]["operator"~".*UP.*"]({bbox_str});
  way["railway"="rail"]["operator"~".*Norfolk Southern.*"]({bbox_str});
  way["railway"="rail"]["operator"~".*CSX.*"]({bbox_str});
  way["railway"="rail"]["operator"~".*Canadian Pacific.*"]({bbox_str});
  way["railway"="rail"]["operator"~".*Kansas City Southern.*"]({bbox_str});
  way["railway"="rail"]["operator"~".*CPKC.*"]({bbox_str});
  
  // Standard gauge main lines (most freight)
  way["railway"="rail"]["gauge"="1435"]["usage"="main"]({bbox_str});
);
out geom;
"""
    return query.strip()

def fetch_railroad_data(bbox):
    """
    Fetch railroad data from Overpass API.
    
    Args:
        bbox: Bounding box tuple (min_lat, min_lon, max_lat, max_lon)
    
    Returns:
        dict: OSM data or None if failed
    """
    query = build_railroad_overpass_query(bbox)
    
    print("Overpass Query:")
    print("-" * 50)
    print(query)
    print("-" * 50)
    
    try:
        overpass_url = "http://overpass-api.de/api/interpreter"
        print(f"Sending request to Overpass API...")
        print("⏳ Fetching central US railroad data...")
        
        response = requests.post(overpass_url, data=query, timeout=180)
        response.raise_for_status()
        
        data = response.json()
        
        if 'elements' not in data:
            print("❌ No 'elements' field in response")
            return None
            
        element_count = len(data['elements'])
        print(f"✅ Retrieved {element_count} OSM railroad elements")
        
        if element_count == 0:
            print("⚠️  No railroad segments found in the specified area")
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

def classify_railroad(tags):
    """
    Classify railroad based on operator and other tags.
    
    Args:
        tags: OSM tags dictionary
    
    Returns:
        dict: Classification info
    """
    operator = tags.get('operator', '').lower()
    name = tags.get('name', '').lower()
    usage = tags.get('usage', '')
    service = tags.get('service', '')
    
    # Class I Railroad classification
    if any(term in operator for term in ['bnsf', 'burlington northern', 'santa fe']):
        return {
            'class': 'Class I',
            'operator': 'BNSF Railway',
            'operator_short': 'BNSF',
            'color': '#00A651'  # BNSF Green
        }
    elif any(term in operator for term in ['union pacific', 'up']):
        return {
            'class': 'Class I',
            'operator': 'Union Pacific Railroad',
            'operator_short': 'UP',
            'color': '#004B87'  # UP Blue
        }
    elif any(term in operator for term in ['cpkc', 'canadian pacific', 'kansas city southern', 'kcs']):
        return {
            'class': 'Class I',
            'operator': 'CPKC',
            'operator_short': 'CPKC',
            'color': '#DC143C'  # CPKC Red
        }
    elif any(term in operator for term in ['norfolk southern', 'ns']):
        return {
            'class': 'Class I',
            'operator': 'Norfolk Southern',
            'operator_short': 'NS',
            'color': '#000000'  # NS Black
        }
    elif 'csx' in operator:
        return {
            'class': 'Class I',
            'operator': 'CSX Transportation',
            'operator_short': 'CSX',
            'color': '#003DA5'  # CSX Blue
        }
    else:
        # Classify by usage/service
        if usage == 'main' or service == 'freight':
            return {
                'class': 'Main Line',
                'operator': 'Main Line Railroad',
                'operator_short': 'MAIN',
                'color': '#666666'  # Dark Gray
            }
        else:
            return {
                'class': 'Other',
                'operator': 'Other Railroad',
                'operator_short': 'OTHER',
                'color': '#A0A0A0'  # Light Gray
            }

def convert_osm_to_geojson(osm_data, metadata):
    """
    Convert OSM railroad data to GeoJSON format.
    
    Args:
        osm_data: Raw OSM data from Overpass API
        metadata: Additional metadata to include
    
    Returns:
        dict: GeoJSON FeatureCollection
    """
    if not osm_data or 'elements' not in osm_data:
        return None
    
    features = []
    railroad_stats = {}
    
    for element in osm_data['elements']:
        if element['type'] == 'way' and 'geometry' in element:
            # Convert way to LineString
            coordinates = []
            for point in element['geometry']:
                coordinates.append([point['lon'], point['lat']])
            
            if len(coordinates) < 2:
                continue  # Skip invalid geometries
            
            # Extract properties from OSM tags
            tags = element.get('tags', {})
            classification = classify_railroad(tags)
            
            # Count by operator
            operator = classification['operator_short']
            if operator not in railroad_stats:
                railroad_stats[operator] = 0
            railroad_stats[operator] += 1
            
            # Build properties
            properties = tags.copy()
            properties.update({
                'osm_id': element['id'],
                'osm_type': 'way',
                'railroad_class': classification['class'],
                'railroad_operator': classification['operator'],
                'railroad_operator_short': classification['operator_short'],
                'railroad_color': classification['color'],
                'dataset_name': 'Central US Railroads',
                'dataset_description': 'Major freight railroad lines in the central United States'
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
            'dataset_name': 'Central US Railroad Lines',
            'description': 'Major freight railroad infrastructure in the central United States',
            'coverage_area': 'Central United States (Texas to Minnesota, Colorado to Great Lakes)',
            'railroads_targeted': [
                'BNSF Railway',
                'Union Pacific Railroad', 
                'CPKC (Canadian Pacific Kansas City)',
                'Norfolk Southern',
                'CSX Transportation',
                'Main Line Freight Railroads'
            ],
            'bounding_box': metadata['bbox'],
            'generated_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()),
            'total_features': len(features),
            'osm_elements_processed': len(osm_data['elements']),
            'railroad_statistics': railroad_stats
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
        
        print(f"✅ Saved central US railroad data to: {output_path}")
        print(f"📊 File size: {file_size:,} bytes")
        print(f"🚂 Total railroad segments: {feature_count:,}")
        
        # Show railroad statistics
        stats = geojson_data['metadata']['railroad_statistics']
        print(f"\n📈 Railroad Breakdown:")
        for operator, count in sorted(stats.items(), key=lambda x: x[1], reverse=True):
            print(f"   {operator}: {count:,} segments")
        
        return True
        
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return False

def main():
    """
    Main execution function.
    """
    print("🚂 Central US Railroad Lines Fetcher")
    print("=" * 60)
    
    print("Target Railroads:")
    print("  • BNSF Railway")
    print("  • Union Pacific Railroad")
    print("  • CPKC (Canadian Pacific Kansas City)")
    print("  • Norfolk Southern")
    print("  • CSX Transportation")
    print("  • Main Line Freight Railroads")
    print()
    
    # Calculate bounding box for central US
    bbox = calculate_central_us_bounding_box()
    min_lat, min_lon, max_lat, max_lon = bbox
    
    print(f"Coverage Area: Central United States")
    print(f"  North: {max_lat}° (Minnesota/North Dakota)")
    print(f"  South: {min_lat}° (Texas/Louisiana)")
    print(f"  East:  {max_lon}° (Great Lakes region)")
    print(f"  West:  {min_lon}° (Colorado/New Mexico)")
    print()
    
    # Fetch railroad data
    print("Fetching central US railroad data from OpenStreetMap...")
    osm_data = fetch_railroad_data(bbox)
    
    if not osm_data:
        print("❌ Failed to fetch railroad data")
        return False
    
    # Convert to GeoJSON
    metadata = {
        'bbox': bbox
    }
    
    print("Converting OSM railroad data to GeoJSON...")
    geojson_data = convert_osm_to_geojson(osm_data, metadata)
    
    if not geojson_data or not geojson_data['features']:
        print("❌ No valid railroad features found")
        return False
    
    # Save to file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "..", "public", "data", "central_us_railroads.geojson")
    
    success = save_geojson(geojson_data, output_path)
    
    if success:
        print("\n🎯 SUCCESS! Central US railroad data ready for mapping.")
        print(f"Load this file: {os.path.basename(output_path)}")
        print(f"\nThis dataset includes:")
        print(f"  • Major freight railroad lines in central US")
        print(f"  • Color-coded by railroad operator")
        print(f"  • Covers the same region as our interstate corridors")
        print(f"  • Perfect for freight transportation analysis")
        return True
    else:
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)