#!/usr/bin/env python3
"""
Texas Highway Segments Fetcher using Overpass API

This script fetches specific highway segments for the Texas route:
Fort Stockton → Ozona → Junction/Sonora → Rocksprings → Leakey/Utopia → Hondo → Castroville → Medina County

Each segment is fetched with targeted queries using highway ref tags and geographic bounds.
"""

import requests
import json
import time
import os
from typing import Dict, List, Tuple

# Route segments with their approximate coordinates and highway designations
ROUTE_SEGMENTS = {
    'i10_fort_stockton_ozona': {
        'name': 'I-10 Fort Stockton to Ozona',
        'highway_refs': ['10'],
        'bbox': (-102.9, 30.8, -101.0, 31.0),  # [west, south, east, north]
        'description': 'Interstate 10 from Fort Stockton to Ozona'
    },
    'i10_ozona_junction_sonora': {
        'name': 'I-10 Ozona to Junction/Sonora',
        'highway_refs': ['10'],
        'bbox': (-101.0, 30.4, -99.7, 30.9),
        'description': 'Interstate 10 from Ozona through Junction area to Sonora'
    },
    'us277_sonora_rocksprings': {
        'name': 'US-277 Sonora to Rocksprings',
        'highway_refs': ['277'],
        'bbox': (-100.7, 29.8, -99.8, 30.6),
        'description': 'US Highway 277 from Sonora to Rocksprings'
    },
    'us83_rocksprings_leakey': {
        'name': 'US-83 Rocksprings to Leakey',
        'highway_refs': ['83'],
        'bbox': (-100.2, 29.6, -99.5, 30.0),
        'description': 'US Highway 83 from Rocksprings to Leakey'
    },
    'us377_leakey_utopia': {
        'name': 'US-377 Leakey to Utopia',
        'highway_refs': ['377'],
        'bbox': (-99.5, 29.4, -99.0, 29.8),
        'description': 'US Highway 377 from Leakey to Utopia area'
    },
    'local_utopia_hondo': {
        'name': 'Local roads Utopia to Hondo',
        'highway_refs': ['1050', '187'],  # TX state routes that connect this area
        'bbox': (-99.2, 29.2, -98.8, 29.6),
        'description': 'State and local roads from Utopia area to Hondo'
    },
    'us90_hondo_castroville': {
        'name': 'US-90 Hondo to Castroville',
        'highway_refs': ['90'],
        'bbox': (-98.8, 29.2, -98.6, 29.4),
        'description': 'US Highway 90 from Hondo to Castroville'
    },
    'local_castroville_medina': {
        'name': 'Local roads Castroville to Medina County',
        'highway_refs': ['471', '173'],  # Local state routes
        'bbox': (-98.9, 29.1, -98.5, 29.4),
        'description': 'Local roads from Castroville to Medina County'
    }
}

class OverpassFetcher:
    def __init__(self, base_url: str = "http://overpass-api.de/api/interpreter"):
        self.base_url = base_url
        self.session = requests.Session()
        # Set a reasonable timeout and user agent
        self.session.headers.update({
            'User-Agent': 'Texas-Highway-Route-Fetcher/1.0'
        })
    
    def build_overpass_query(self, segment_info: Dict) -> str:
        """
        Build targeted Overpass query for highway segment
        """
        bbox = segment_info['bbox']
        highway_refs = segment_info['highway_refs']
        
        # Create ref filter for multiple highway numbers
        ref_filter = '|'.join(highway_refs)
        
        query = f"""
[out:json][timeout:60];
(
  // Ways with specific highway ref tags in bounding box
  way["highway"]["ref"~"^({ref_filter})$"]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});
  
  // Also get ways that are part of highway relations
  rel["route"="road"]["ref"~"^({ref_filter})$"]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});
  way(r)["highway"];
  
  // Include trunk and primary roads if no specific refs found
  way["highway"~"^(trunk|primary)$"]["name"~".*({ref_filter}).*"]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});
);
out geom;
"""
        return query.strip()
    
    def fetch_segment(self, segment_key: str, segment_info: Dict) -> Dict:
        """
        Fetch a specific highway segment from Overpass API
        """
        print(f"Fetching {segment_info['name']}...")
        
        query = self.build_overpass_query(segment_info)
        print(f"Query for {segment_key}:")
        print(query)
        print("-" * 50)
        
        try:
            response = self.session.post(self.base_url, data=query, timeout=60)
            response.raise_for_status()
            
            data = response.json()
            
            if 'elements' not in data or len(data['elements']) == 0:
                print(f"⚠️  No data found for {segment_info['name']}")
                return None
            
            print(f"✅ Found {len(data['elements'])} elements for {segment_info['name']}")
            return data
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error fetching {segment_info['name']}: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error for {segment_info['name']}: {e}")
            return None
    
    def convert_to_geojson(self, osm_data: Dict, segment_info: Dict) -> Dict:
        """
        Convert OSM data to GeoJSON format
        """
        if not osm_data or 'elements' not in osm_data:
            return None
        
        features = []
        
        for element in osm_data['elements']:
            if element['type'] == 'way' and 'geometry' in element:
                # Convert way to LineString
                coordinates = [[point['lon'], point['lat']] for point in element['geometry']]
                
                # Extract properties
                properties = element.get('tags', {})
                properties.update({
                    'osm_id': element['id'],
                    'osm_type': 'way',
                    'segment_name': segment_info['name'],
                    'segment_description': segment_info['description']
                })
                
                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': coordinates
                    },
                    'properties': properties
                }
                features.append(feature)
        
        geojson = {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'segment_name': segment_info['name'],
                'segment_description': segment_info['description'],
                'highway_refs': segment_info['highway_refs'],
                'bbox': segment_info['bbox'],
                'generated_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()),
                'total_features': len(features)
            }
        }
        
        return geojson
    
    def save_geojson(self, geojson_data: Dict, filename: str, output_dir: str) -> bool:
        """
        Save GeoJSON data to file
        """
        if not geojson_data:
            return False
        
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(geojson_data, f, indent=2, ensure_ascii=False)
            print(f"💾 Saved {filename} with {geojson_data['metadata']['total_features']} features")
            return True
        except Exception as e:
            print(f"❌ Error saving {filename}: {e}")
            return False
    
    def fetch_all_segments(self, output_dir: str = "../public/data", delay: float = 2.0):
        """
        Fetch all highway segments and save as GeoJSON files
        """
        print("🚀 Starting Texas Highway Segments fetch...")
        print("=" * 60)
        
        results = {}
        
        for segment_key, segment_info in ROUTE_SEGMENTS.items():
            # Check if file already exists
            filename = f"{segment_key}.geojson"
            filepath = os.path.join(output_dir, filename)
            
            if os.path.exists(filepath):
                print(f"📁 {filename} already exists, skipping...")
                results[segment_key] = 'exists'
                continue
            
            # Fetch the segment
            osm_data = self.fetch_segment(segment_key, segment_info)
            
            if osm_data:
                # Convert to GeoJSON
                geojson_data = self.convert_to_geojson(osm_data, segment_info)
                
                if geojson_data and geojson_data['features']:
                    # Save to file
                    success = self.save_geojson(geojson_data, filename, output_dir)
                    results[segment_key] = 'success' if success else 'save_failed'
                else:
                    print(f"⚠️  No valid features extracted for {segment_info['name']}")
                    results[segment_key] = 'no_features'
            else:
                results[segment_key] = 'fetch_failed'
            
            # Rate limiting
            if delay > 0:
                print(f"⏳ Waiting {delay}s before next request...")
                time.sleep(delay)
            print()
        
        # Print summary
        print("=" * 60)
        print("📊 FETCH SUMMARY:")
        print("=" * 60)
        
        for segment_key, status in results.items():
            segment_name = ROUTE_SEGMENTS[segment_key]['name']
            if status == 'success':
                print(f"✅ {segment_name}")
            elif status == 'exists':
                print(f"📁 {segment_name} (already existed)")
            elif status == 'fetch_failed':
                print(f"❌ {segment_name} (fetch failed)")
            elif status == 'save_failed':
                print(f"💾❌ {segment_name} (save failed)")
            elif status == 'no_features':
                print(f"⚠️  {segment_name} (no features)")
        
        successful_count = sum(1 for status in results.values() if status in ['success', 'exists'])
        total_count = len(results)
        
        print(f"\n🎯 Successfully obtained {successful_count}/{total_count} segments")
        
        return results

def main():
    """
    Main execution function
    """
    # Get the script directory and set output path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "..", "public", "data")
    
    print(f"Script directory: {script_dir}")
    print(f"Output directory: {output_dir}")
    print()
    
    # Create fetcher and run
    fetcher = OverpassFetcher()
    results = fetcher.fetch_all_segments(output_dir=output_dir, delay=2.0)
    
    return results

if __name__ == "__main__":
    main()