#!/usr/bin/env python3
"""
Split Denver 3D Buildings by Neighborhood Boundaries

This script takes the large denver_3d_buildings.geojson file and splits it into 
smaller JSON files, one for each neighborhood boundary. This enables loading 
only the buildings for a specific neighborhood when a user clicks on that area.

Usage:
    python split_buildings_by_neighborhoods.py

Input files:
    - /denver_3d_buildings.geojson (355MB 3D buildings file)
    - /ODC_ADMN_NEIGHBORHOOD_A_-5910795496315123332.geojson (neighborhood boundaries)

Output:
    - /neighborhood_buildings/[NEIGHBORHOOD_NAME]_buildings.geojson (one per neighborhood)
    - /neighborhood_buildings/neighborhood_index.json (mapping file)
"""

import json
import os
from pathlib import Path
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union
import time

def load_geojson(file_path):
    """Load and parse a GeoJSON file"""
    print(f"📁 Loading {file_path}...")
    start_time = time.time()
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    elapsed = time.time() - start_time
    feature_count = len(data.get('features', []))
    print(f"✅ Loaded {feature_count:,} features in {elapsed:.2f}s")
    return data

def save_geojson(data, file_path):
    """Save data as GeoJSON file"""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))  # Compact JSON
    
    feature_count = len(data.get('features', []))
    file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
    print(f"💾 Saved {feature_count:,} buildings ({file_size:.1f}MB): {os.path.basename(file_path)}")

def clean_neighborhood_name(name):
    """Clean neighborhood name for use as filename"""
    if not name:
        return "unknown"
    
    # Remove special characters and spaces
    clean_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_'))
    clean_name = clean_name.replace(' ', '_').lower()
    return clean_name

def point_in_polygon_optimized(point, polygon_shape):
    """Check if a point is within a polygon using Shapely"""
    try:
        return polygon_shape.contains(point)
    except Exception:
        return False

def main():
    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    buildings_file = project_root / "public" / "denver_3d_buildings.geojson"
    neighborhoods_file = project_root / "public" / "ODC_ADMN_NEIGHBORHOOD_A_-5910795496315123332.geojson"
    output_dir = project_root / "public" / "neighborhood_buildings"
    
    # Check if input files exist
    if not buildings_file.exists():
        print(f"❌ Buildings file not found: {buildings_file}")
        return
    
    if not neighborhoods_file.exists():
        print(f"❌ Neighborhoods file not found: {neighborhoods_file}")
        return
    
    print("🏗️  Starting Denver 3D Buildings neighborhood split...")
    print(f"📍 Buildings file: {buildings_file}")
    print(f"🗺️  Neighborhoods file: {neighborhoods_file}")
    print(f"📂 Output directory: {output_dir}")
    print()
    
    # Load neighborhood boundaries
    neighborhoods_data = load_geojson(neighborhoods_file)
    print()
    
    # Process neighborhoods and create polygon shapes
    neighborhoods = []
    for feature in neighborhoods_data['features']:
        props = feature['properties']
        neighborhood_id = props.get('NBHD_ID', 'unknown')
        neighborhood_name = props.get('NBHD_NAME', f'neighborhood_{neighborhood_id}')
        
        # Create Shapely polygon for fast point-in-polygon testing
        try:
            polygon_shape = shape(feature['geometry'])
            neighborhoods.append({
                'id': neighborhood_id,
                'name': neighborhood_name,
                'clean_name': clean_neighborhood_name(neighborhood_name),
                'polygon': polygon_shape,
                'buildings': []
            })
            print(f"🌍 Processed neighborhood: {neighborhood_name} (ID: {neighborhood_id})")
        except Exception as e:
            print(f"⚠️  Error processing neighborhood {neighborhood_name}: {e}")
    
    print(f"\n📊 Total neighborhoods to process: {len(neighborhoods)}")
    print()
    
    # Load 3D buildings
    buildings_data = load_geojson(buildings_file)
    total_buildings = len(buildings_data['features'])
    print()
    
    # Process each building and assign to neighborhoods
    print("🔍 Assigning buildings to neighborhoods...")
    processed = 0
    unassigned_buildings = []
    
    for i, building in enumerate(buildings_data['features']):
        if i % 5000 == 0:  # Progress update every 5000 buildings
            print(f"📈 Progress: {i:,}/{total_buildings:,} buildings processed ({i/total_buildings*100:.1f}%)")
        
        try:
            # Get building centroid
            if building['geometry']['type'] == 'Polygon':
                coords = building['geometry']['coordinates'][0]
                # Calculate centroid
                x = sum(coord[0] for coord in coords) / len(coords)
                y = sum(coord[1] for coord in coords) / len(coords)
                building_point = Point(x, y)
            else:
                print(f"⚠️  Unsupported geometry type: {building['geometry']['type']}")
                continue
            
            # Find which neighborhood contains this building
            assigned = False
            for neighborhood in neighborhoods:
                if point_in_polygon_optimized(building_point, neighborhood['polygon']):
                    neighborhood['buildings'].append(building)
                    assigned = True
                    break
            
            if not assigned:
                unassigned_buildings.append(building)
            
            processed += 1
            
        except Exception as e:
            print(f"⚠️  Error processing building {i}: {e}")
            continue
    
    print(f"\n✅ Building assignment complete!")
    print(f"📊 Processed: {processed:,} buildings")
    print(f"📊 Unassigned: {len(unassigned_buildings):,} buildings")
    print()
    
    # Create output directory
    output_dir.mkdir(exist_ok=True)
    
    # Save buildings for each neighborhood
    neighborhood_index = {}
    total_saved_buildings = 0
    
    for neighborhood in neighborhoods:
        if len(neighborhood['buildings']) > 0:
            # Create GeoJSON for this neighborhood
            neighborhood_geojson = {
                "type": "FeatureCollection",
                "features": neighborhood['buildings']
            }
            
            # Save to file
            filename = f"{neighborhood['clean_name']}_buildings.geojson"
            file_path = output_dir / filename
            save_geojson(neighborhood_geojson, file_path)
            
            # Add to index
            neighborhood_index[neighborhood['id']] = {
                'name': neighborhood['name'],
                'clean_name': neighborhood['clean_name'],
                'filename': filename,
                'building_count': len(neighborhood['buildings']),
                'file_path': f"/neighborhood_buildings/{filename}"
            }
            
            total_saved_buildings += len(neighborhood['buildings'])
        else:
            print(f"🈳 No buildings found in: {neighborhood['name']}")
    
    # Save unassigned buildings if any
    if unassigned_buildings:
        unassigned_geojson = {
            "type": "FeatureCollection",
            "features": unassigned_buildings
        }
        unassigned_file = output_dir / "unassigned_buildings.geojson"
        save_geojson(unassigned_geojson, unassigned_file)
        
        neighborhood_index['unassigned'] = {
            'name': 'Unassigned Buildings',
            'clean_name': 'unassigned',
            'filename': 'unassigned_buildings.geojson',
            'building_count': len(unassigned_buildings),
            'file_path': '/neighborhood_buildings/unassigned_buildings.geojson'
        }
    
    # Save neighborhood index
    index_file = output_dir / "neighborhood_index.json"
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(neighborhood_index, f, indent=2)
    
    print(f"\n🎉 Split complete!")
    print(f"📁 Created {len(neighborhood_index)} neighborhood building files")
    print(f"🏗️  Total buildings saved: {total_saved_buildings:,}")
    print(f"📋 Index file saved: {index_file}")
    print(f"📂 All files saved to: {output_dir}")
    print()
    
    # Summary statistics
    print("📊 Neighborhood Summary:")
    for nbhd_id, info in neighborhood_index.items():
        print(f"   {info['name']}: {info['building_count']:,} buildings")

if __name__ == "__main__":
    main()