import json
import geopandas as gpd
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import numpy as np
from pathlib import Path

def optimize_geojson(input_filepath, output_dir):
    print("Loading GeoJSON file...")
    gdf = gpd.read_file(input_filepath)
    
    # Create output directory if it doesn't exist
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Create zoom-level optimized versions with different simplification tolerances
    print("\nCreating zoom-level optimized versions...")
    zoom_levels = {
        'high': {'tolerance': 0.0001, 'min_area': 0.0},           # High detail (zoom > 15)
        'medium': {'tolerance': 0.001, 'min_area': 0.0000005},    # Medium detail (zoom 12-15)
        'low': {'tolerance': 0.01, 'min_area': 0.000001}          # Low detail (zoom < 12)
    }
    
    for level, params in zoom_levels.items():
        print(f"\nProcessing {level} detail level...")
        gdf_level = gdf.copy()
        
        # Filter by minimum area to reduce complexity at lower zoom levels
        if params['min_area'] > 0:
            gdf_level = gdf_level[gdf_level.area >= params['min_area']]
            print(f"Filtered to {len(gdf_level)} features based on minimum area")
        
        # Simplify geometries
        gdf_level.geometry = gdf_level.geometry.simplify(
            tolerance=params['tolerance'],
            preserve_topology=True
        )
        
        # Save to file
        output_file = f"{output_dir}/zoning_{level}_detail.geojson"
        gdf_level.to_file(output_file, driver='GeoJSON')
        print(f"Saved {output_file}")
        
        # Print file size
        file_size = Path(output_file).stat().st_size / (1024 * 1024)  # Convert to MB
        print(f"File size: {file_size:.2f} MB")
    
    # Generate metadata
    print("\nGenerating metadata...")
    metadata = {
        'total_features': len(gdf),
        'properties': list(gdf.columns),
        'bounds': gdf.total_bounds.tolist(),
        'available_files': {
            'high_detail': {
                'file': 'zoning_high_detail.geojson',
                'features': len(gdf),
                'recommended_zoom': '> 15'
            },
            'medium_detail': {
                'file': 'zoning_medium_detail.geojson',
                'features': len(gdf[gdf.area >= zoom_levels['medium']['min_area']]),
                'recommended_zoom': '12-15'
            },
            'low_detail': {
                'file': 'zoning_low_detail.geojson',
                'features': len(gdf[gdf.area >= zoom_levels['low']['min_area']]),
                'recommended_zoom': '< 12'
            }
        },
        'zone_cmplt_stats': {
            'unique_values': gdf['zone_cmplt'].nunique(),
            'top_10_values': gdf['zone_cmplt'].value_counts().head(10).to_dict()
        }
    }
    
    with open(f"{output_dir}/metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print("\nOptimization complete! Files created:")
    for level in zoom_levels:
        print(f"- zoning_{level}_detail.geojson")
    print("- metadata.json")
    
    return metadata

if __name__ == "__main__":
    input_file = "public/kx-houston-texas-census-block-group-boundaries-2010-SHP/ZONING_PLY_20250311.geojson"
    output_dir = "public/optimized_zoning"
    metadata = optimize_geojson(input_file, output_dir) 