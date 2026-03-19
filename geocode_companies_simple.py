#!/usr/bin/env python3
"""
Simple geocoding script using Google Places API
"""

import json
import os
import time
import requests
from typing import Dict, List, Any, Optional

# API Configuration
GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"

def geocode_location(location: str) -> Dict[str, Any]:
    """Geocode a single location using Google Geocoding API"""
    if not location or location.strip() == "":
        return {
            "success": False,
            "error": "Empty location",
            "coordinates": None,
            "formatted_address": None
        }
    
    params = {
        'address': location,
        'key': GOOGLE_PLACES_API_KEY
    }
    
    try:
        response = requests.get(GEOCODING_URL, params=params, timeout=10)
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

def geocode_companies_batch(companies_data: Dict[str, Any], 
                           start_index: int = 0, 
                           batch_size: int = 10) -> Dict[str, Any]:
    """Geocode a batch of companies with rate limiting"""
    
    companies = companies_data['companies']
    total_companies = len(companies)
    end_index = min(start_index + batch_size, total_companies)
    
    print(f"🚀 Geocoding companies {start_index + 1} to {end_index} of {total_companies}")
    
    for i in range(start_index, end_index):
        company = companies[i]
        location = company['headquarters_location']['cleaned']
        
        if not location:
            company['geocoding_status'] = 'skipped'
            company['geocoding_notes'] = 'No location data'
            continue
        
        print(f"📍 [{i + 1}/{total_companies}] {company['name']} - {location}")
        
        result = geocode_location(location)
        
        if result['success']:
            company['headquarters_location']['geocoded'] = True
            company['headquarters_location']['coordinates'] = result['coordinates']
            company['headquarters_location']['formatted_address'] = result['formatted_address']
            company['geocoding_status'] = 'success'
            company['geocoding_notes'] = None
            print(f"  ✅ {result['formatted_address']}")
        else:
            company['geocoding_status'] = 'failed'
            company['geocoding_notes'] = result['error']
            print(f"  ❌ {result['error']}")
        
        # Rate limiting - 0.1 second delay between requests
        time.sleep(0.1)
    
    # Update metadata
    companies_data['metadata']['last_geocoded_batch'] = {
        'start_index': start_index,
        'end_index': end_index,
        'batch_size': batch_size
    }
    
    return companies_data

def main():
    # File paths
    json_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025.json"
    output_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025-geocoded.json"
    
    print("🔑 Using Google Places API for geocoding")
    print(f"📁 Input: {json_file}")
    print(f"📁 Output: {output_file}")
    
    try:
        # Load the JSON data
        with open(json_file, 'r', encoding='utf-8') as f:
            companies_data = json.load(f)
        
        # Ask user for batch parameters
        total_companies = len(companies_data['companies'])
        print(f"\n📊 Total companies: {total_companies}")
        
        start_index = int(input(f"Start index (0-{total_companies-1}): ") or "0")
        batch_size = int(input("Batch size (recommended: 10-50): ") or "10")
        
        # Geocode the batch
        geocoded_data = geocode_companies_batch(companies_data, start_index, batch_size)
        
        # Save the updated data
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(geocoded_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Updated data saved to: {output_file}")
        
        # Show statistics
        companies = geocoded_data['companies']
        successful = sum(1 for c in companies if c['geocoding_status'] == 'success')
        failed = sum(1 for c in companies if c['geocoding_status'] == 'failed')
        skipped = sum(1 for c in companies if c['geocoding_status'] == 'skipped')
        
        print(f"\n📈 Geocoding Statistics:")
        print(f"  ✅ Successful: {successful}")
        print(f"  ❌ Failed: {failed}")
        print(f"  ⏭️  Skipped: {skipped}")
        
    except FileNotFoundError:
        print(f"❌ Error: JSON file not found at {json_file}")
    except Exception as e:
        print(f"❌ Error during geocoding: {str(e)}")

if __name__ == "__main__":
    main()
