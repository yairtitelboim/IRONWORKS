#!/usr/bin/env python3
"""
Optimize Los Angeles Zoning GeoJSON files

This script preprocesses LA zoning GeoJSON data by:
1. Buffering polygons to fill gaps between adjacent zones
2. Simplifying polygons for different detail levels
3. Preserving topological relationships

Usage:
    python optimize_zoning.py input.geojson [--buffer METERS] [--output OUTPUT_DIR]

Requirements:
    pip install geopandas shapely pyproj numpy tqdm
"""

import os
import sys
import json
import argparse
from pathlib import Path
from tqdm import tqdm
import re

try:
    import geopandas as gpd
    import pandas as pd
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    import numpy as np
    import pyproj
except ImportError:
    print("Required packages not found. Please install with:")
    print("pip install geopandas shapely pyproj numpy tqdm")
    sys.exit(1)

def extract_base_zone(zone_code):
    """Extract the base zone from complex zoning codes"""
    if not zone_code or not isinstance(zone_code, str):
        return None
    
    # Remove qualifiers and overlays
    base = zone_code
    base = re.sub(r'^\[?Q\]?', '', base)           # Remove [Q] or Q at start
    base = re.sub(r'^\(T\)', '', base)             # Remove (T) at start
    base = re.sub(r'^\(Q\)', '', base)             # Remove (Q) at start
    base = re.sub(r'\-.*$', '', base)              # Remove everything after first hyphen
    base = re.sub(r'\(.*?\)', '', base)            # Remove anything in parentheses
    base = base.strip()
    
    # Special handling for combined zones (e.g., CM(GM))
    if '(' in base:
        base = base.split('(')[0]
    
    return base

def optimize_geojson(input_filepath, output_dir, buffer_distance=3.0):
    """
    Process and optimize zoning GeoJSON for web map performance
    
    Parameters:
    -----------
    input_filepath : str
        Path to the input GeoJSON file
    output_dir : str
        Directory to save the optimized files
    buffer_distance : float
        Buffer distance in meters to apply to each polygon
    """
    print(f"Processing {input_filepath}")
    
    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Load GeoJSON file
    gdf = gpd.read_file(input_filepath)
    
    # Check if the data has a CRS (coordinate reference system)
    if gdf.crs is None or gdf.crs.is_geographic:
        print("Converting to UTM projection for accurate area calculations and buffering...")
        # Determine UTM zone from centroid of data extent
        lon = gdf.total_bounds[0] + (gdf.total_bounds[2] - gdf.total_bounds[0])/2
        lat = gdf.total_bounds[1] + (gdf.total_bounds[3] - gdf.total_bounds[1])/2
        utm_zone = int(np.floor((lon + 180) / 6) + 1)
        hemisphere = 'north' if lat >= 0 else 'south'
        utm_crs = f"EPSG:{326 if hemisphere == 'north' else 327}{utm_zone:02d}"
        
        print(f"Using UTM zone {utm_zone} {hemisphere} ({utm_crs}) for accurate geometry operations")
        # Project to UTM for accurate measurements
        gdf = gdf.to_crs(utm_crs)
    
    # Extract base zone for each feature
    print("Extracting base zones for features...")
    if 'zone_cmplt' in gdf.columns:
        # Add baseZone property to each feature
        gdf['baseZone'] = gdf['zone_cmplt'].apply(extract_base_zone)
        print(f"Extracted base zones for {len(gdf)} features")
    
    # Validate geometries
    print("Validating geometries...")
    gdf.geometry = gdf.geometry.buffer(0)  # Fix invalid geometries
    gdf = gdf[~gdf.geometry.is_empty]  # Remove empty geometries
    
    # Calculate areas for each feature
    print("Calculating areas...")
    gdf['area'] = gdf.geometry.area
    
    # Apply adaptive buffering (larger buffer for smaller features)
    print("Buffering polygons...")
    mean_area = gdf['area'].mean()
    
    def adaptive_buffer(geom, area):
        if geom.is_empty:
            return geom
            
        # Calculate buffer size based on area relative to mean
        # Smaller parcels get proportionally smaller buffers
        ratio = min(1.0, area / mean_area) if mean_area > 0 else 0.5
        adaptive_buffer_distance = buffer_distance * (0.5 + 0.5 * ratio)
        
        try:
            buffered = geom.buffer(adaptive_buffer_distance, join_style=1)
            return buffered
        except Exception as e:
            print(f"Error buffering: {e}")
            return geom
    
    gdf.geometry = [adaptive_buffer(geom, area) for geom, area in zip(gdf.geometry, gdf['area'])]
    
    # Create optimized versions with different detail levels
    detail_levels = {
        'low': 0.0002,      # Lower tolerance means more simplified
        'medium': 0.0001,   # Medium simplification
        'high': 0.00005     # High detail, minimal simplification
    }
    
    # Project back to original CRS if needed for output
    if not gdf.crs.is_geographic:
        gdf = gdf.to_crs("EPSG:4326")  # Convert back to WGS84 for GeoJSON
    
    for level, tolerance in detail_levels.items():
        print(f"Creating {level} detail level (tolerance={tolerance})...")
        
        gdf_simplified = gdf.copy()
        # Apply simplification with preserve_topology=True to avoid invalid geoms
        gdf_simplified.geometry = gdf_simplified.geometry.simplify(
            tolerance=tolerance, 
            preserve_topology=True
        )
        
        # Save the optimized file
        output_file = f"{output_dir}/zoning_{level}_detail.geojson"
        print(f"Saving to {output_file}...")
        gdf_simplified.to_file(output_file, driver="GeoJSON")
    
    print("Processing complete!")

def main():
    parser = argparse.ArgumentParser(description="Optimize zoning GeoJSON for web maps")
    parser.add_argument("input_file", help="Path to input GeoJSON file")
    parser.add_argument("--buffer", type=float, default=3.0, 
                        help="Buffer distance in meters (default: 3.0)")
    parser.add_argument("--output", default="public/optimized_zoning", 
                        help="Output directory (default: public/optimized_zoning)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"Error: Input file {args.input_file} not found")
        return 1
    
    optimize_geojson(args.input_file, args.output, args.buffer)
    return 0

if __name__ == "__main__":
    sys.exit(main()) 