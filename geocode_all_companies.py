#!/usr/bin/env python3
"""
Geocode all companies in batches using Google Places API
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

def geocode_all_companies(companies_data: Dict[str, Any], 
                         batch_size: int = 50, 
                         delay_seconds: float = 0.1) -> Dict[str, Any]:
    """Geocode all companies in batches"""
    
    companies = companies_data['companies']
    total_companies = len(companies)
    geocoded_count = 0
    failed_count = 0
    skipped_count = 0
    
    print(f"🚀 Starting geocoding for {total_companies} companies")
    print(f"📦 Batch size: {batch_size}")
    print(f"⏱️  Delay between requests: {delay_seconds}s")
    print(f"⏱️  Estimated time: {(total_companies * delay_seconds) / 60:.1f} minutes")
    
    for i, company in enumerate(companies, 1):
        location = company['headquarters_location']['cleaned']
        
        if not location:
            company['geocoding_status'] = 'skipped'
            company['geocoding_notes'] = 'No location data'
            skipped_count += 1
            continue
        
        # Show progress every 10 companies
        if i % 10 == 0 or i <= 10:
            print(f"📍 [{i}/{total_companies}] {company['name']} - {location}")
        
        result = geocode_location(location)
        
        if result['success']:
            company['headquarters_location']['geocoded'] = True
            company['headquarters_location']['coordinates'] = result['coordinates']
            company['headquarters_location']['formatted_address'] = result['formatted_address']
            company['geocoding_status'] = 'success'
            company['geocoding_notes'] = None
            geocoded_count += 1
            
            if i % 10 == 0 or i <= 10:
                print(f"  ✅ {result['formatted_address']}")
        else:
            company['geocoding_status'] = 'failed'
            company['geocoding_notes'] = result['error']
            failed_count += 1
            
            if i % 10 == 0 or i <= 10:
                print(f"  ❌ {result['error']}")
        
        # Rate limiting
        time.sleep(delay_seconds)
        
        # Save progress every 100 companies
        if i % 100 == 0:
            print(f"💾 Progress saved at {i} companies...")
            with open("/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025-geocoded.json", 'w', encoding='utf-8') as f:
                json.dump(companies_data, f, indent=2, ensure_ascii=False)
    
    # Update metadata
    companies_data['metadata']['geocoding_completed'] = True
    companies_data['metadata']['geocoding_stats'] = {
        'total': total_companies,
        'successful': geocoded_count,
        'failed': failed_count,
        'skipped': skipped_count
    }
    
    print(f"\n🎉 Geocoding completed!")
    print(f"✅ Successful: {geocoded_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"⏭️  Skipped: {skipped_count}")
    
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
        
        # Check if already geocoded
        if companies_data['metadata'].get('geocoding_completed', False):
            print("⚠️  Companies already geocoded. Starting fresh...")
            # Reset geocoding status
            for company in companies_data['companies']:
                company['geocoding_status'] = 'pending'
                company['headquarters_location']['geocoded'] = False
                company['headquarters_location']['coordinates'] = None
                company['headquarters_location']['formatted_address'] = None
        
        # Geocode all companies
        geocoded_data = geocode_all_companies(companies_data, batch_size=50, delay_seconds=0.1)
        
        # Save the final data
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(geocoded_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Final geocoded data saved to: {output_file}")
        
    except FileNotFoundError:
        print(f"❌ Error: JSON file not found at {json_file}")
    except Exception as e:
        print(f"❌ Error during geocoding: {str(e)}")

if __name__ == "__main__":
    main()
