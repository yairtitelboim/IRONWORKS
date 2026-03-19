import json
import ijson
from pathlib import Path
import numpy as np
from tqdm import tqdm
from decimal import Decimal
from typing import Dict, Any

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def get_building_score(feature: Dict[str, Any]) -> float:
    """Calculate a score for building significance based on various factors."""
    properties = feature.get('properties', {})
    score = 0.0
    
    # Height is the primary factor
    height = float(properties.get('height', 0) or properties.get('building:height', 0) or 0)
    score += height * 2  # Height is weighted heavily
    
    # Area is the secondary factor
    area = float(properties.get('area', 0) or 0)
    score += min(area / 1000, 100)  # Cap area contribution at 100
    
    # Building type bonus
    building_type = properties.get('building', '')
    type_scores = {
        'commercial': 50,
        'industrial': 40,
        'residential': 30,
        'apartments': 25
    }
    score += type_scores.get(building_type, 0)
    
    # Bonus for named buildings
    if properties.get('name'):
        score += 20
    
    return score

def optimize_coordinates(coordinates, precision=6):
    """Reduce coordinate precision and simplify if needed."""
    if isinstance(coordinates, (int, float, np.number, Decimal)):
        return round(float(coordinates), precision)
    if isinstance(coordinates, list):
        return [optimize_coordinates(coord, precision) for coord in coordinates]
    return coordinates

def optimize_feature(feature):
    """Optimize a single feature by reducing precision and keeping essential properties."""
    # Keep only essential properties
    essential_properties = {
        'height': feature['properties'].get('height'),
        'building:height': feature['properties'].get('building:height'),
        'building': feature['properties'].get('building'),
        'area': feature['properties'].get('area'),
        'name': feature['properties'].get('name')
    }
    
    # Remove None values and convert Decimal to float
    essential_properties = {
        k: float(v) if isinstance(v, Decimal) else v 
        for k, v in essential_properties.items() 
        if v is not None
    }
    
    return {
        'type': 'Feature',
        'properties': essential_properties,
        'geometry': {
            'type': feature['geometry']['type'],
            'coordinates': optimize_coordinates(feature['geometry']['coordinates'])
        }
    }

def main():
    input_file = Path('public/data/osm/la_buildings_3d.geojson')
    output_file = Path('public/data/osm/la_buildings_3d_10k.geojson')
    max_buildings = 10000
    
    print(f"Processing {input_file}...")
    
    # First pass: collect and score buildings
    scored_features = []
    
    with open(input_file, 'rb') as file:
        parser = ijson.parse(file)
        feature_collection = ijson.items(parser, 'features.item')
        
        print("First pass: Scoring buildings...")
        for feature in tqdm(feature_collection, desc="Scoring features"):
            score = get_building_score(feature)
            if score > 0:  # Only keep buildings with some significance
                scored_features.append((score, feature))
    
    # Sort by score and take top N
    print(f"\nSorting buildings by significance...")
    scored_features.sort(key=lambda x: x[0], reverse=True)
    top_features = scored_features[:max_buildings]
    
    # Create optimized dataset
    output_data = {
        'type': 'FeatureCollection',
        'features': []
    }
    
    print(f"\nOptimizing top {max_buildings} buildings...")
    for _, feature in tqdm(top_features, desc="Optimizing features"):
        optimized_feature = optimize_feature(feature)
        output_data['features'].append(optimized_feature)
    
    # Write the optimized data
    print(f"Writing optimized data to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(output_data, f, cls=DecimalEncoder)
    
    # Print statistics
    input_size = input_file.stat().st_size / (1024 * 1024)  # MB
    output_size = output_file.stat().st_size / (1024 * 1024)  # MB
    print(f"\nOptimization complete:")
    print(f"Original size: {input_size:.2f} MB")
    print(f"Optimized size: {output_size:.2f} MB")
    print(f"Reduction: {((input_size - output_size) / input_size * 100):.1f}%")
    print(f"Number of features kept: {len(output_data['features'])}")

if __name__ == '__main__':
    main() 