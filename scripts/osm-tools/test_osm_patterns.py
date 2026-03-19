#!/usr/bin/env python3
"""
Test script to analyze OSM data patterns and identify missing tags/features.
Helps understand regional OSM tagging patterns for PA nuclear sites.
"""

import json
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "public" / "osm"

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in km"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def analyze_osm_patterns(site_key: str, site_lat: float, site_lon: float):
    """Analyze OSM data patterns for a site"""
    data_file = DATA_DIR / f"{site_key}.json"
    
    if not data_file.exists():
        print(f"❌ Data file not found: {data_file}")
        return
    
    with open(data_file, 'r') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"\n{'='*80}")
    print(f"OSM Pattern Analysis: {site_key}")
    print(f"{'='*80}\n")
    
    # Analyze features within different distance bands
    distance_bands = [
        (0, 1, "On-site (0-1km)"),
        (1, 5, "Immediate (1-5km)"),
        (5, 10, "Nearby (5-10km)"),
        (10, 50, "Regional (10-50km)"),
        (50, 100, "Extended (50-100km)"),
    ]
    
    for min_dist, max_dist, label in distance_bands:
        band_features = []
        for f in features:
            props = f.get('properties', {})
            tags = props.get('tags', {})
            
            # Calculate distance
            distance_km = None
            if f.get('geometry', {}).get('type') == 'Point':
                coords = f['geometry']['coordinates']
                distance_km = haversine_distance(site_lat, site_lon, coords[1], coords[0])
            elif f.get('geometry', {}).get('type') == 'LineString':
                # Use first point
                coords = f['geometry']['coordinates'][0] if f['geometry']['coordinates'] else None
                if coords:
                    distance_km = haversine_distance(site_lat, site_lon, coords[1], coords[0])
            
            if distance_km and min_dist <= distance_km < max_dist:
                band_features.append({
                    'distance': distance_km,
                    'name': props.get('name', 'Unnamed'),
                    'power': tags.get('power', ''),
                    'subcategory': props.get('subcategory', ''),
                    'voltage': tags.get('voltage', ''),
                    'operator': tags.get('operator', ''),
                    'strategic_score': props.get('strategic_score', 0),
                    'tags': tags
                })
        
        print(f"\n{label} ({len(band_features)} features):")
        if band_features:
            # Sort by distance
            band_features.sort(key=lambda x: x['distance'])
            
            # Show power type distribution
            power_types = {}
            for f in band_features:
                ptype = f['power'] or 'none'
                power_types[ptype] = power_types.get(ptype, 0) + 1
            
            print(f"  Power types: {dict(sorted(power_types.items(), key=lambda x: -x[1]))}")
            
            # Show switchyard patterns
            switchyard_features = [f for f in band_features if any(
                pattern in (f['name'] or '').lower() 
                for pattern in ['sub', 'switchyard', 'junction', 'tie', 'tmi']
            )]
            if switchyard_features:
                print(f"  Switchyard patterns: {len(switchyard_features)} features")
                for sf in switchyard_features[:5]:
                    print(f"    - {sf['distance']:.2f}km: {sf['name']} (power={sf['power']}, score={sf['strategic_score']})")
            
            # Show features with low scores that might be filtered out
            low_score = [f for f in band_features if f['strategic_score'] < 25]
            if low_score:
                print(f"  ⚠️ Low score features (<25): {len(low_score)}")
                for ls in low_score[:5]:
                    print(f"    - {ls['distance']:.2f}km: {ls['name']} (power={ls['power']}, score={ls['strategic_score']}, voltage={ls['voltage']})")
            
            # Show top features
            top_features = sorted(band_features, key=lambda x: -x['strategic_score'])[:3]
            print(f"  Top features:")
            for tf in top_features:
                print(f"    - {tf['distance']:.2f}km: {tf['name']} (score={tf['strategic_score']}, power={tf['power']})")
        else:
            print("  No features found")
    
    # Tag pattern analysis
    print(f"\n{'='*80}")
    print("Tag Pattern Analysis")
    print(f"{'='*80}\n")
    
    # Collect all unique tag keys
    all_tags = {}
    for f in features:
        tags = f.get('properties', {}).get('tags', {})
        for key, value in tags.items():
            if key not in all_tags:
                all_tags[key] = set()
            all_tags[key].add(str(value)[:50])
    
    # Show most common tags
    print("Most common OSM tags:")
    for key in sorted(all_tags.keys())[:20]:
        values = list(all_tags[key])[:5]
        print(f"  {key}: {len(all_tags[key])} unique values")
        if len(values) <= 5:
            print(f"    Examples: {', '.join(values)}")
        else:
            print(f"    Examples: {', '.join(values)}... ({len(all_tags[key])-5} more)")
    
    # Check for missing substation tags
    print(f"\n{'='*80}")
    print("Substation Detection Analysis")
    print(f"{'='*80}\n")
    
    substation_candidates = []
    for f in features:
        props = f.get('properties', {})
        tags = props.get('tags', {})
        name = props.get('name', '').lower()
        
        # Check if it looks like a substation but isn't tagged as one
        is_substation_like = any(pattern in name for pattern in ['sub', 'substation', 'switchyard'])
        is_tagged_substation = tags.get('power') == 'substation'
        
        if is_substation_like and not is_tagged_substation:
            distance_km = None
            if f.get('geometry', {}).get('type') == 'Point':
                coords = f['geometry']['coordinates']
                distance_km = haversine_distance(site_lat, site_lon, coords[1], coords[0])
            elif f.get('geometry', {}).get('type') == 'LineString':
                coords = f['geometry']['coordinates'][0] if f['geometry']['coordinates'] else None
                if coords:
                    distance_km = haversine_distance(site_lat, site_lon, coords[1], coords[0])
            
            if distance_km:
                substation_candidates.append({
                    'distance': distance_km,
                    'name': props.get('name'),
                    'power': tags.get('power'),
                    'voltage': tags.get('voltage'),
                    'score': props.get('strategic_score', 0)
                })
    
    if substation_candidates:
        print(f"Found {len(substation_candidates)} features that look like substations but aren't tagged as such:")
        for sc in sorted(substation_candidates, key=lambda x: x['distance'])[:10]:
            print(f"  {sc['distance']:.2f}km: {sc['name']} (tagged as power={sc['power']}, voltage={sc['voltage']}, score={sc['score']})")
    else:
        print("No substation-like features found with mismatched tags")

if __name__ == "__main__":
    # TMI
    analyze_osm_patterns("pa_nuclear_tmi", 40.1500, -76.7300)
    
    # Susquehanna
    analyze_osm_patterns("pa_nuclear_susquehanna", 41.1000, -76.1500)

