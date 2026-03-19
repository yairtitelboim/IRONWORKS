#!/usr/bin/env python3
"""
Trim I-10 Fort Stockton to Ozona GeoJSON file to only include the segment between these two cities.
"""

import json
import sys
from geopy.distance import geodesic

def main():
    # Define the bounding coordinates
    FORT_STOCKTON_COORDS = (-102.879996, 30.894348)  # (longitude, latitude)
    OZONA_COORDS = (-101.205972, 30.707417)
    
    # Create a bounding box with some buffer (0.1 degrees ~= 11km)
    BUFFER = 0.1
    MIN_LON = min(FORT_STOCKTON_COORDS[0], OZONA_COORDS[0]) - BUFFER  # -102.98
    MAX_LON = max(FORT_STOCKTON_COORDS[0], OZONA_COORDS[0]) + BUFFER  # -101.11
    MIN_LAT = min(FORT_STOCKTON_COORDS[1], OZONA_COORDS[1]) - BUFFER  # 30.61
    MAX_LAT = max(FORT_STOCKTON_COORDS[1], OZONA_COORDS[1]) + BUFFER  # 30.99
    
    print(f"Bounding box: lon[{MIN_LON:.2f}, {MAX_LON:.2f}], lat[{MIN_LAT:.2f}, {MAX_LAT:.2f}]")
    
    # Load the original GeoJSON file
    input_file = '../public/data/i10_fort_stockton_ozona.geojson'
    output_file = '../public/data/i10_fort_stockton_ozona_trimmed.geojson'
    
    try:
        with open(input_file, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file {input_file} not found")
        sys.exit(1)
    
    print(f"Original features: {len(data['features'])}")
    
    # Filter features that fall within the bounding box
    filtered_features = []
    
    for feature in data['features']:
        if feature['geometry']['type'] == 'LineString':
            coords = feature['geometry']['coordinates']
            
            # Check if any coordinate in the LineString falls within our bounding box
            within_bounds = False
            for coord in coords:
                lon, lat = coord[0], coord[1]
                if MIN_LON <= lon <= MAX_LON and MIN_LAT <= lat <= MAX_LAT:
                    within_bounds = True
                    break
            
            if within_bounds:
                filtered_features.append(feature)
        
        elif feature['geometry']['type'] == 'MultiLineString':
            coords_array = feature['geometry']['coordinates']
            
            # Check if any coordinate in any LineString falls within our bounding box
            within_bounds = False
            for line_coords in coords_array:
                for coord in line_coords:
                    lon, lat = coord[0], coord[1]
                    if MIN_LON <= lon <= MAX_LON and MIN_LAT <= lat <= MAX_LAT:
                        within_bounds = True
                        break
                if within_bounds:
                    break
            
            if within_bounds:
                filtered_features.append(feature)
    
    print(f"Filtered features: {len(filtered_features)}")
    
    # Create new GeoJSON with filtered features
    trimmed_data = {
        "type": "FeatureCollection",
        "features": filtered_features
    }
    
    # Save the trimmed file
    with open(output_file, 'w') as f:
        json.dump(trimmed_data, f, separators=(',', ':'))
    
    print(f"Trimmed file saved to: {output_file}")
    
    # Calculate file size reduction
    import os
    original_size = os.path.getsize(input_file)
    trimmed_size = os.path.getsize(output_file)
    reduction = (1 - trimmed_size / original_size) * 100
    
    print(f"File size: {original_size:,} → {trimmed_size:,} bytes ({reduction:.1f}% reduction)")

if __name__ == "__main__":
    main()