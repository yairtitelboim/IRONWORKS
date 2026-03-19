#!/usr/bin/env python3
"""
Validate and summarize the Texas highway route segments
"""

import json
import os
from collections import defaultdict

def analyze_geojson_file(filepath):
    """
    Analyze a GeoJSON file and return basic statistics
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if data.get('type') != 'FeatureCollection':
            return None
        
        features = data.get('features', [])
        
        # Extract highway refs and names
        highway_refs = set()
        highway_names = set()
        highway_types = set()
        
        for feature in features:
            props = feature.get('properties', {})
            if 'ref' in props and props['ref']:
                highway_refs.add(str(props['ref']))
            if 'name' in props and props['name']:
                highway_names.add(str(props['name'])[:50])  # Truncate long names
            if 'highway' in props and props['highway']:
                highway_types.add(props['highway'])
        
        # Get bounding box
        coords = []
        for feature in features:
            if feature['geometry']['type'] == 'LineString':
                coords.extend(feature['geometry']['coordinates'])
        
        if coords:
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            bbox = [min(lons), min(lats), max(lons), max(lats)]
        else:
            bbox = None
        
        return {
            'feature_count': len(features),
            'highway_refs': sorted(list(highway_refs)),
            'highway_names': sorted(list(highway_names))[:5],  # Top 5 names
            'highway_types': sorted(list(highway_types)),
            'bbox': bbox,
            'metadata': data.get('metadata', {})
        }
        
    except Exception as e:
        print(f"Error analyzing {filepath}: {e}")
        return None

def main():
    """
    Analyze all route segment files
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "public", "data")
    
    # Define the route segments in order
    route_segments = [
        ('i10_fort_stockton_ozona.geojson', 'I-10: Fort Stockton → Ozona'),
        ('i10_ozona_junction_sonora.geojson', 'I-10: Ozona → Junction/Sonora'),
        ('us277_sonora_rocksprings.geojson', 'US-277: Sonora → Rocksprings'),
        ('us83_rocksprings_leakey.geojson', 'US-83: Rocksprings → Leakey'),
        ('us377_leakey_utopia.geojson', 'US-377: Leakey → Utopia'),
        ('local_utopia_hondo.geojson', 'Local: Utopia → Hondo'),
        ('us90_hondo_castroville.geojson', 'US-90: Hondo → Castroville'),
        ('local_castroville_medina.geojson', 'Local: Castroville → Medina County')
    ]
    
    print("🛣️  TEXAS HIGHWAY ROUTE SEGMENTS ANALYSIS")
    print("=" * 60)
    print("Route: Fort Stockton → Ozona → Junction/Sonora → Rocksprings → Leakey/Utopia → Hondo → Castroville → Medina County")
    print("=" * 60)
    
    total_features = 0
    available_segments = 0
    
    for filename, description in route_segments:
        filepath = os.path.join(data_dir, filename)
        
        print(f"\n📍 {description}")
        print(f"   File: {filename}")
        
        if os.path.exists(filepath):
            stats = analyze_geojson_file(filepath)
            if stats:
                available_segments += 1
                total_features += stats['feature_count']
                
                print(f"   ✅ Available - {stats['feature_count']} features")
                
                if stats['highway_refs']:
                    print(f"   🏷️  Highway refs: {', '.join(stats['highway_refs'])}")
                
                if stats['highway_types']:
                    print(f"   🛣️  Road types: {', '.join(stats['highway_types'])}")
                
                if stats['bbox']:
                    bbox = stats['bbox']
                    print(f"   📍 Bounds: ({bbox[0]:.3f}, {bbox[1]:.3f}) to ({bbox[2]:.3f}, {bbox[3]:.3f})")
                
                if stats.get('metadata') and stats['metadata'].get('generated_at'):
                    print(f"   🕐 Generated: {stats['metadata']['generated_at']}")
            else:
                print(f"   ❌ Available but corrupted")
        else:
            print(f"   ❌ Missing")
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"Available segments: {available_segments}/8")
    print(f"Total features: {total_features:,}")
    
    # Check for other related files that might be useful
    print("\n🔍 OTHER RELATED FILES:")
    
    other_files = [
        'i10_ozona_fortstockton.geojson',  # Reverse direction
        'i10_ozona_sonora.geojson',        # Older version
        'us277_55_sonora_rocksprings.geojson',  # Alternative US-277
        'us277_combo_sonora_rocksprings.geojson'  # Combined US-277
    ]
    
    for filename in other_files:
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            stats = analyze_geojson_file(filepath)
            if stats:
                print(f"   📄 {filename} - {stats['feature_count']} features")
    
    print(f"\n🎯 Route segments ready for visualization!")
    print(f"💡 You can now use these files as toggle layers in your mapping application.")

if __name__ == "__main__":
    main()