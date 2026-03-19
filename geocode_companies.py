#!/usr/bin/env python3
"""
Geocode company locations using Google Geocoding API
"""

import json
import time
import requests
from typing import Dict, List, Any, Optional
import os

class CompanyGeocoder:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('GOOGLE_MAPS_API_KEY')
        if not self.api_key:
            raise ValueError("Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable or pass it to constructor.")
        
        self.base_url = "https://maps.googleapis.com/maps/api/geocode/json"
        self.session = requests.Session()
        
    def geocode_location(self, location: str) -> Dict[str, Any]:
        """Geocode a single location"""
        if not location or location.strip() == "":
            return {
                "success": False,
                "error": "Empty location",
                "coordinates": None,
                "formatted_address": None
            }
        
        params = {
            'address': location,
            'key': self.api_key
        }
        
        try:
            response = self.session.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK' and data['results']:
                result = data['results'][0]
                return {
                    "success": True,
                    "coordinates": {
                        "lat": result['geometry']['location']['lat'],
                        "lng": result['geometry']['location']['lng']
                    },
                    "formatted_address": result['formatted_address'],
                    "place_id": result.get('place_id'),
                    "types": result.get('types', [])
                }
            else:
                return {
                    "success": False,
                    "error": f"Geocoding failed: {data['status']}",
                    "coordinates": None,
                    "formatted_address": None
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Request failed: {str(e)}",
                "coordinates": None,
                "formatted_address": None
            }
    
    def geocode_companies(self, companies_data: Dict[str, Any], 
                         batch_size: int = 50, 
                         delay_seconds: float = 0.1) -> Dict[str, Any]:
        """Geocode all companies with rate limiting"""
        
        companies = companies_data['companies']
        total_companies = len(companies)
        geocoded_count = 0
        failed_count = 0
        
        print(f"🚀 Starting geocoding for {total_companies} companies...")
        print(f"⏱️  Rate limiting: {delay_seconds}s delay between requests")
        print(f"📦 Batch size: {batch_size}")
        
        for i, company in enumerate(companies, 1):
            location = company['headquarters_location']['cleaned']
            
            if not location:
                company['geocoding_status'] = 'skipped'
                company['geocoding_notes'] = 'No location data'
                continue
            
            print(f"📍 [{i}/{total_companies}] Geocoding: {company['name']} - {location}")
            
            result = self.geocode_location(location)
            
            if result['success']:
                company['headquarters_location']['geocoded'] = True
                company['headquarters_location']['coordinates'] = result['coordinates']
                company['headquarters_location']['formatted_address'] = result['formatted_address']
                company['geocoding_status'] = 'success'
                company['geocoding_notes'] = None
                geocoded_count += 1
                print(f"  ✅ Success: {result['formatted_address']}")
            else:
                company['geocoding_status'] = 'failed'
                company['geocoding_notes'] = result['error']
                failed_count += 1
                print(f"  ❌ Failed: {result['error']}")
            
            # Rate limiting
            if i % batch_size == 0:
                print(f"⏸️  Pausing for {delay_seconds}s after batch {i//batch_size}")
                time.sleep(delay_seconds)
            else:
                time.sleep(delay_seconds)
        
        # Update metadata
        companies_data['metadata']['geocoding_completed'] = True
        companies_data['metadata']['geocoding_stats'] = {
            'total': total_companies,
            'successful': geocoded_count,
            'failed': failed_count,
            'skipped': total_companies - geocoded_count - failed_count
        }
        
        print(f"\n🎉 Geocoding completed!")
        print(f"✅ Successful: {geocoded_count}")
        print(f"❌ Failed: {failed_count}")
        print(f"⏭️  Skipped: {total_companies - geocoded_count - failed_count}")
        
        return companies_data

def main():
    # File paths
    json_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025.json"
    output_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025-geocoded.json"
    
    # API key - using the provided Google Places API key
    api_key = "AIzaSyBGFqyws8LGGGkof2ZbP_Mt8l3hf_glfpE"
    
    print(f"🔑 Using Google Places API key: {api_key[:20]}...")
    
    try:
        # Load the JSON data
        with open(json_file, 'r', encoding='utf-8') as f:
            companies_data = json.load(f)
        
        # Initialize geocoder
        geocoder = CompanyGeocoder(api_key)
        
        # Geocode all companies
        geocoded_data = geocoder.geocode_companies(companies_data)
        
        # Save the geocoded data
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(geocoded_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Geocoded data saved to: {output_file}")
        
    except FileNotFoundError:
        print(f"❌ Error: JSON file not found at {json_file}")
    except Exception as e:
        print(f"❌ Error during geocoding: {str(e)}")

if __name__ == "__main__":
    main()
