#!/usr/bin/env python3
"""
Convert TWDB_Groundwater shapefile to GeoJSON format
"""

import geopandas as gpd
import os

def convert_twdb_groundwater():
    # Input shapefile path
    input_shp = "public/data/TWDB_Groundwater.shp"
    
    # Output GeoJSON path
    output_geojson = "public/data/TWDB_Groundwater.geojson"
    
    # Check if input file exists
    if not os.path.exists(input_shp):
        print(f"Error: Input file {input_shp} not found")
        return False
    
    try:
        # Read the shapefile
        print(f"Reading shapefile: {input_shp}")
        gdf = gpd.read_file(input_shp)
        
        # Print info about the data
        print(f"Shape: {gdf.shape}")
        print(f"Columns: {list(gdf.columns)}")
        print(f"CRS: {gdf.crs}")
        
        # Convert to WGS84 if needed
        if gdf.crs != 'EPSG:4326':
            print("Converting to WGS84...")
            gdf = gdf.to_crs('EPSG:4326')
        
        # Save as GeoJSON
        print(f"Saving to: {output_geojson}")
        gdf.to_file(output_geojson, driver='GeoJSON')
        
        print("Conversion completed successfully!")
        return True
        
    except Exception as e:
        print(f"Error converting file: {e}")
        return False

if __name__ == "__main__":
    convert_twdb_groundwater() 