#!/usr/bin/env python3
"""
Fetch missing highway segments with broader search criteria
"""

import requests
import json
import time
import os

class MissingSegmentsFetcher:
    def __init__(self, base_url: str = "http://overpass-api.de/api/interpreter"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Texas-Highway-Route-Fetcher/1.0'
        })
    
    def fetch_us377_segment(self):
        """
        Fetch US-377 segment with broader criteria since it might not be well-tagged
        """
        print("🔍 Searching for US-377 Leakey to Utopia with broader criteria...")
        
        # Expanded bounding box and more flexible query
        query = """
[out:json][timeout:60];
(
  // Look for ways with ref 377
  way["highway"]["ref"~"377"](29.3,-99.6,29.9,-98.9);
  
  // Look for ways with name containing 377
  way["highway"]["name"~".*377.*"](29.3,-99.6,29.9,-98.9);
  
  // Look for relations with ref 377
  rel["route"="road"]["ref"~"377"](29.3,-99.6,29.9,-98.9);
  way(r)["highway"];
  
  // Look for primary/secondary roads in the area
  way["highway"~"^(primary|secondary|trunk)$"](29.3,-99.6,29.9,-98.9);
);
out geom;
"""
        
        try:
            response = self.session.post(self.base_url, data=query, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            if data['elements']:
                print(f"✅ Found {len(data['elements'])} elements for US-377 area")
                return data
            else:
                print("⚠️  Still no data found for US-377 area")
                return None
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return None
    
    def fetch_utopia_hondo_segment(self):
        """
        Fetch roads connecting Utopia area to Hondo with very broad search
        """
        print("🔍 Searching for Utopia to Hondo connection with broad criteria...")
        
        query = """
[out:json][timeout:60];
(
  // Look for any state routes in the area
  way["highway"]["ref"~"^(1050|187|173)$"](29.1,-99.3,29.7,-98.7);
  
  // Look for roads with relevant names
  way["highway"]["name"~".*(Utopia|Hondo).*"](29.1,-99.3,29.7,-98.7);
  
  // Look for all primary and secondary roads
  way["highway"~"^(primary|secondary|trunk)$"](29.1,-99.3,29.7,-98.7);
  
  // Look for all tertiary roads as well
  way["highway"="tertiary"](29.1,-99.3,29.7,-98.7);
);
out geom;
"""
        
        try:
            response = self.session.post(self.base_url, data=query, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            if data['elements']:
                print(f"✅ Found {len(data['elements'])} elements for Utopia-Hondo area")
                return data
            else:
                print("⚠️  No data found for Utopia-Hondo area")
                return None
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return None
    
    def convert_and_save(self, osm_data, filename, segment_name, output_dir):
        """
        Convert OSM data to GeoJSON and save
        """
        if not osm_data:
            return False
            
        features = []
        
        for element in osm_data['elements']:
            if element['type'] == 'way' and 'geometry' in element:
                coordinates = [[point['lon'], point['lat']] for point in element['geometry']]
                
                properties = element.get('tags', {})
                properties.update({
                    'osm_id': element['id'],
                    'osm_type': 'way',
                    'segment_name': segment_name
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
        
        if not features:
            print(f"⚠️  No valid features extracted for {segment_name}")
            return False
        
        geojson = {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'segment_name': segment_name,
                'generated_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()),
                'total_features': len(features)
            }
        }
        
        try:
            os.makedirs(output_dir, exist_ok=True)
            filepath = os.path.join(output_dir, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(geojson, f, indent=2, ensure_ascii=False)
                
            print(f"💾 Saved {filename} with {len(features)} features")
            return True
            
        except Exception as e:
            print(f"❌ Error saving {filename}: {e}")
            return False

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "..", "public", "data")
    
    fetcher = MissingSegmentsFetcher()
    
    # Fetch US-377 segment
    us377_data = fetcher.fetch_us377_segment()
    if us377_data:
        fetcher.convert_and_save(
            us377_data, 
            "us377_leakey_utopia.geojson", 
            "US-377 Leakey to Utopia area",
            output_dir
        )
    
    time.sleep(2)
    
    # Fetch Utopia to Hondo segment
    utopia_hondo_data = fetcher.fetch_utopia_hondo_segment()
    if utopia_hondo_data:
        fetcher.convert_and_save(
            utopia_hondo_data,
            "local_utopia_hondo.geojson",
            "Local roads Utopia to Hondo area", 
            output_dir
        )

if __name__ == "__main__":
    main()