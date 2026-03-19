import json
import pandas as pd
import geopandas as gpd
from collections import Counter
from shapely.geometry import shape
import numpy as np

def analyze_geojson(filepath):
    print("Loading GeoJSON file...")
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    features = data['features']
    print(f"\nTotal number of features: {len(features)}")
    
    # Analyze properties
    print("\nAnalyzing properties...")
    if features:
        properties_keys = set()
        for feature in features:
            properties_keys.update(feature['properties'].keys())
        print(f"Available properties: {sorted(properties_keys)}")
    
    # Count zone types
    zone_counts = Counter()
    for feature in features:
        zone_code = feature['properties'].get('ZONE_CODE', 'Unknown')
        zone_counts[zone_code] += 1
    
    print("\nZone type distribution:")
    for zone, count in zone_counts.most_common():
        print(f"{zone}: {count} features ({count/len(features)*100:.1f}%)")
    
    # Analyze geometry
    print("\nAnalyzing geometries...")
    geometry_types = Counter(feature['geometry']['type'] for feature in features)
    print("Geometry types distribution:")
    for geom_type, count in geometry_types.items():
        print(f"{geom_type}: {count}")
    
    # Calculate size statistics
    areas = []
    for feature in features:
        geom = shape(feature['geometry'])
        areas.append(geom.area)
    
    print("\nArea statistics (in square degrees):")
    print(f"Min area: {min(areas):.10f}")
    print(f"Max area: {max(areas):.10f}")
    print(f"Mean area: {np.mean(areas):.10f}")
    print(f"Median area: {np.median(areas):.10f}")
    
    # Suggest optimization strategies
    print("\nOptimization suggestions:")
    if len(features) > 10000:
        print("- Consider using vector tiles for better performance")
        print("- Implement zoom-dependent filtering")
        print("- Use geometry simplification for lower zoom levels")
    
    # Create a summary of property values
    print("\nAnalyzing property values...")
    df = pd.DataFrame([feature['properties'] for feature in features])
    for column in df.columns:
        unique_values = df[column].nunique()
        print(f"\n{column}:")
        print(f"Unique values: {unique_values}")
        if unique_values < 20:  # Only show distribution for categorical data
            print("Value distribution:")
            print(df[column].value_counts().head())

if __name__ == "__main__":
    analyze_geojson("public/kx-houston-texas-census-block-group-boundaries-2010-SHP/ZONING_PLY_20250311.geojson") 