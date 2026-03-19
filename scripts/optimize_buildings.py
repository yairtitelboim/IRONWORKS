#!/usr/bin/env python3
import json
import os
import math
from shapely.geometry import shape, mapping
import numpy as np
from tqdm import tqdm
import sys
import geopandas as gpd
import pandas as pd

"""
Optimize LA Buildings 3D GeoJSON

This script processes a large building GeoJSON file and creates a smaller, optimized version
with the most significant buildings while reducing overall file size.

Usage:
    python optimize_buildings.py [input_file] [output_file] [options]

Options:
    --min-height=X     Minimum building height to include (meters) (default: 10)
    --max-buildings=X  Maximum number of buildings to include (default: 10000)
    --simplify=X       Simplification tolerance (meters) (default: 1.0)
    --sample=X         Random sample percentage (0-1) of buildings below height threshold (default: 0.05)
"""

def load_geojson_in_chunks(filename, chunk_size=1000):
    """Load a large GeoJSON file in chunks to avoid memory issues."""
    print(f"Loading GeoJSON file: {filename}")
    
    # First pass to count features
    features_count = 0
    with open(filename, 'r') as f:
        # Read opening part of the file
        line = f.readline()
        while line and not '"features"' in line:
            line = f.readline()
        
        # Count opening brackets for features
        line = f.readline()
        while line:
            if '"type": "Feature"' in line:
                features_count += 1
            line = f.readline()
            
    print(f"Found approximately {features_count} features")
    
    # Second pass to load data in chunks
    with open(filename, 'r') as f:
        # Read until features array
        content = ""
        line = f.readline()
        while line and not '"features"' in line:
            content += line
            line = f.readline()
        
        content += line  # Add the "features": [ line
        
        # Start of features array
        all_features = []
        current_feature = ""
        bracket_count = 0
        in_feature = False
        
        with tqdm(total=features_count, desc="Loading features") as pbar:
            line = f.readline()
            while line:
                if not in_feature and '{' in line and '"type": "Feature"' in line:
                    in_feature = True
                    current_feature = line
                    bracket_count = line.count('{') - line.count('}')
                elif in_feature:
                    current_feature += line
                    bracket_count += line.count('{') - line.count('}')
                    
                    if bracket_count == 0:
                        # End of feature
                        in_feature = False
                        try:
                            # Parse the feature
                            feature = json.loads(current_feature.rstrip(','))
                            all_features.append(feature)
                            pbar.update(1)
                            
                            # Process in chunks to avoid memory issues
                            if len(all_features) >= chunk_size:
                                for feature in all_features:
                                    yield feature
                                all_features = []
                        except json.JSONDecodeError as e:
                            print(f"Error decoding feature: {e}")
                            print(f"Problematic feature: {current_feature[:100]}...")
                
                line = f.readline()
        
        # Yield remaining features
        for feature in all_features:
            yield feature


def optimize_buildings(input_file, output_file, min_height=10, max_buildings=10000, 
                     simplify_tolerance=1.0, sample_rate=0.05):
    """
    Process the buildings file to create an optimized version:
    1. Keep all buildings above min_height
    2. Sample a percentage of smaller buildings
    3. Simplify geometries to reduce file size
    4. Limit to max_buildings total
    5. Keep properties like height, but trim unnecessary ones
    """
    # Create GeoDataFrame to store optimized buildings
    all_buildings = []
    
    # Load buildings from the large file in chunks
    height_key = 'height'  # Adjust based on your data
    buildings_above_threshold = []
    buildings_below_threshold = []
    
    print("Processing buildings...")
    
    # Process buildings from the input file
    for building in load_geojson_in_chunks(input_file):
        try:
            # Extract height information (handle different possible formats)
            height = 0
            if 'properties' in building:
                props = building['properties']
                if height_key in props and props[height_key]:
                    try:
                        height = float(props[height_key])
                    except (ValueError, TypeError):
                        # Try to handle cases where height might be stored differently
                        height = 0
                        
                # Some files use 'height_m' or other variations
                elif 'height_m' in props and props['height_m']:
                    try:
                        height = float(props['height_m'])
                    except (ValueError, TypeError):
                        height = 0
                
                # Calculate height from levels if available
                elif 'building:levels' in props and props['building:levels']:
                    try:
                        levels = float(props['building:levels'])
                        height = levels * 3  # Assume 3 meters per level
                    except (ValueError, TypeError):
                        height = 0
                        
            # Simplify the geometry to reduce file size
            if 'geometry' in building and building['geometry']:
                try:
                    geom = shape(building['geometry'])
                    if simplify_tolerance > 0:
                        simplified = geom.simplify(simplify_tolerance, preserve_topology=True)
                        building['geometry'] = mapping(simplified)
                except Exception as e:
                    print(f"Error simplifying geometry: {e}")
            
            # Keep only essential properties
            if 'properties' in building:
                essential_props = {
                    'height': height,
                    'id': building['properties'].get('id', ''),
                    'name': building['properties'].get('name', ''),
                    'building': building['properties'].get('building', 'yes'),
                }
                
                # Add a few more useful properties if they exist
                for key in ['address', 'building:levels', 'amenity', 'building:material']:
                    if key in building['properties']:
                        essential_props[key] = building['properties'][key]
                
                building['properties'] = essential_props
            
            # Categorize buildings based on height
            if height >= min_height:
                buildings_above_threshold.append(building)
            else:
                # Only keep a random sample of smaller buildings
                if np.random.random() < sample_rate:
                    buildings_below_threshold.append(building)
        
        except Exception as e:
            print(f"Error processing building: {e}")
    
    print(f"Found {len(buildings_above_threshold)} buildings above height threshold")
    print(f"Sampled {len(buildings_below_threshold)} buildings below height threshold")
    
    # Sort taller buildings first
    buildings_above_threshold.sort(
        key=lambda b: float(b['properties'].get('height', 0)), 
        reverse=True
    )
    
    # Combine the buildings, prioritizing taller ones
    all_buildings = buildings_above_threshold
    
    # Add sampled smaller buildings if we have space
    remaining_slots = max_buildings - len(all_buildings)
    if remaining_slots > 0 and buildings_below_threshold:
        # Randomly select smaller buildings to fill remaining slots
        np.random.shuffle(buildings_below_threshold)
        all_buildings.extend(buildings_below_threshold[:remaining_slots])
    
    # Trim to max_buildings if necessary
    if len(all_buildings) > max_buildings:
        all_buildings = all_buildings[:max_buildings]
    
    # Create the final GeoJSON structure
    result = {
        "type": "FeatureCollection",
        "features": all_buildings
    }
    
    # Write the optimized file
    with open(output_file, 'w') as f:
        json.dump(result, f)
    
    print(f"Optimized file created: {output_file}")
    print(f"Included {len(all_buildings)} buildings total")
    original_size = os.path.getsize(input_file) / (1024 * 1024)
    optimized_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"File size reduced from {original_size:.2f}MB to {optimized_size:.2f}MB")
    print(f"Compression ratio: {optimized_size/original_size:.2%}")


def main():
    # Get the absolute path to the workspace root
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Default parameters with absolute paths
    input_file = os.path.join(workspace_root, "public", "data", "osm", "la_buildings_3d.geojson")
    output_file = os.path.join(workspace_root, "public", "data", "osm", "la_buildings_3d_optimized.geojson")
    min_height = 10  # meters
    max_buildings = 10000
    simplify_tolerance = 1.0  # meters
    sample_rate = 0.05
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    # Parse options
    for arg in sys.argv[3:]:
        if arg.startswith('--min-height='):
            min_height = float(arg.split('=')[1])
        elif arg.startswith('--max-buildings='):
            max_buildings = int(arg.split('=')[1])
        elif arg.startswith('--simplify='):
            simplify_tolerance = float(arg.split('=')[1])
        elif arg.startswith('--sample='):
            sample_rate = float(arg.split('=')[1])
    
    print(f"Optimizing 3D buildings with parameters:")
    print(f"  Input file: {input_file}")
    print(f"  Output file: {output_file}")
    print(f"  Min height: {min_height}m")
    print(f"  Max buildings: {max_buildings}")
    print(f"  Simplify tolerance: {simplify_tolerance}m")
    print(f"  Sample rate: {sample_rate}")
    
    optimize_buildings(
        input_file, 
        output_file, 
        min_height, 
        max_buildings, 
        simplify_tolerance, 
        sample_rate
    )

if __name__ == "__main__":
    main() 