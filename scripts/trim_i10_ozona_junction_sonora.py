#!/usr/bin/env python3
"""
Trim I-10 Ozona to Junction/Sonora GeoJSON file to only include the segment between these cities.
"""

import json
import sys

def main():
    # Define the bounding coordinates
    OZONA_COORDS = (-101.205972, 30.707417)  # (longitude, latitude)
    JUNCTION_COORDS = (-99.771944, 30.489444)  # Junction, TX
    SONORA_COORDS = (-100.643333, 30.570833)  # Sonora, TX
    
    # Create a bounding box with some buffer (0.1 degrees ~= 11km)
    BUFFER = 0.1
    MIN_LON = min(OZONA_COORDS[0], JUNCTION_COORDS[0], SONORA_COORDS[0]) - BUFFER  # -101.31
    MAX_LON = max(OZONA_COORDS[0], JUNCTION_COORDS[0], SONORA_COORDS[0]) + BUFFER  # -99.67
    MIN_LAT = min(OZONA_COORDS[1], JUNCTION_COORDS[1], SONORA_COORDS[1]) - BUFFER  # 30.39
    MAX_LAT = max(OZONA_COORDS[1], JUNCTION_COORDS[1], SONORA_COORDS[1]) + BUFFER  # 30.81
    
    print(f"Bounding box: lon[{MIN_LON:.2f}, {MAX_LON:.2f}], lat[{MIN_LAT:.2f}, {MAX_LAT:.2f}]")
    
    # Load the original GeoJSON file
    input_file = '../public/data/i10_ozona_junction_sonora.geojson'
    output_file = '../public/data/i10_ozona_junction_sonora_trimmed.geojson'
    
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