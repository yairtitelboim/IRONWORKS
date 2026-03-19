#!/usr/bin/env python3
"""
Geocode Houston companies using Google Places API for more accurate coordinates
"""

import json
import time
import requests
from typing import Dict, List, Any, Optional
import os

class HoustonCompanyGeocoder:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('GOOGLE_MAPS_API_KEY')
        if not self.api_key:
            raise ValueError("Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable or pass it to constructor.")
        
        self.places_url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
        self.geocoding_url = "https://maps.googleapis.com/maps/api/geocode/json"
        self.session = requests.Session()
        
    def search_company_place(self, company_name: str, location: str = "Houston, TX") -> Dict[str, Any]:
        """Search for a company using Google Places API"""
        print(f"    🔍 Places API: Searching '{company_name}' in {location}")
        
        params = {
            'input': f"{company_name} {location}",
            'inputtype': 'textquery',
            'fields': 'place_id,formatted_address,geometry,name',
            'key': self.api_key
        }
        
        try:
            response = self.session.get(self.places_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK' and data['candidates']:
                candidate = data['candidates'][0]
                print(f"    ✅ Places API: Found '{candidate.get('name')}' at {candidate.get('formatted_address')}")
                return {
                    "success": True,
                    "place_id": candidate.get('place_id'),
                    "name": candidate.get('name'),
                    "formatted_address": candidate.get('formatted_address'),
                    "coordinates": {
                        "lat": candidate['geometry']['location']['lat'],
                        "lng": candidate['geometry']['location']['lng']
                    }
                }
            else:
                print(f"    ❌ Places API: Status {data['status']} - No candidates found")
                return {
                    "success": False,
                    "error": f"Places API status: {data['status']}",
                    "coordinates": None,
                    "formatted_address": None
                }
        except Exception as e:
            print(f"    ❌ Places API: Exception - {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "coordinates": None,
                "formatted_address": None
            }
    
    def geocode_fallback(self, location: str) -> Dict[str, Any]:
        """Fallback to regular geocoding if Places API fails"""
        print(f"    🔍 Geocoding API: Searching '{location}'")
        
        params = {
            'address': location,
            'key': self.api_key
        }
        
        try:
            response = self.session.get(self.geocoding_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK' and data['results']:
                result = data['results'][0]
                print(f"    ✅ Geocoding API: Found {result['formatted_address']}")
                return {
                    "success": True,
                    "coordinates": {
                        "lat": result['geometry']['location']['lat'],
                        "lng": result['geometry']['location']['lng']
                    },
                    "formatted_address": result['formatted_address']
                }
            else:
                print(f"    ❌ Geocoding API: Status {data['status']} - No results found")
                return {
                    "success": False,
                    "error": f"Geocoding API status: {data['status']}",
                    "coordinates": None,
                    "formatted_address": None
                }
        except Exception as e:
            print(f"    ❌ Geocoding API: Exception - {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "coordinates": None,
                "formatted_address": None
            }
    
    def geocode_company(self, company: Dict[str, Any]) -> Dict[str, Any]:
        """Geocode a single company with multiple strategies"""
        company_name = company.get('name', '')
        headquarters = company.get('headquarters_location', {}).get('raw', '')
        
        print(f"    🚀 Starting geocoding strategies for: {company_name}")
        
        # Strategy 1: Try Places API with company name + Houston
        print(f"    📍 Strategy 1: Places API with company name + Houston")
        places_result = self.search_company_place(company_name, "Houston, TX")
        
        if places_result['success']:
            print(f"    ✅ Strategy 1 SUCCESS: {places_result['name']} at {places_result['formatted_address']}")
            return {
                "success": True,
                "coordinates": places_result['coordinates'],
                "formatted_address": places_result['formatted_address'],
                "method": "places_api",
                "place_id": places_result.get('place_id')
            }
        
        # Strategy 2: Try Places API with company name + headquarters location
        if headquarters and "Houston" in headquarters:
            print(f"    📍 Strategy 2: Places API with headquarters location")
            places_result = self.search_company_place(company_name, headquarters)
            
            if places_result['success']:
                print(f"    ✅ Strategy 2 SUCCESS: {places_result['name']} at {places_result['formatted_address']}")
                return {
                    "success": True,
                    "coordinates": places_result['coordinates'],
                    "formatted_address": places_result['formatted_address'],
                    "method": "places_api_headquarters",
                    "place_id": places_result.get('place_id')
                }
        
        # Strategy 3: Fallback to regular geocoding
        print(f"    📍 Strategy 3: Fallback geocoding with headquarters")
        geocode_result = self.geocode_fallback(headquarters)
        
        if geocode_result['success']:
            print(f"    ✅ Strategy 3 SUCCESS: {geocode_result['formatted_address']}")
            return {
                "success": True,
                "coordinates": geocode_result['coordinates'],
                "formatted_address": geocode_result['formatted_address'],
                "method": "geocoding_fallback"
            }
        
        print(f"    ❌ ALL STRATEGIES FAILED for: {company_name}")
        return {
            "success": False,
            "error": f"All methods failed. Places: {places_result.get('error', 'N/A')}, Geocoding: {geocode_result.get('error', 'N/A')}",
            "coordinates": None,
            "formatted_address": None,
            "method": "failed"
        }
    
    def geocode_companies(self, companies: List[Dict[str, Any]], delay: float = 0.1) -> List[Dict[str, Any]]:
        """Geocode a list of companies with rate limiting"""
        results = []
        successful = 0
        failed = 0
        start_time = time.time()
        
        for i, company in enumerate(companies):
            # Calculate progress and ETA
            progress = (i + 1) / len(companies) * 100
            elapsed_time = time.time() - start_time
            if i > 0:
                avg_time_per_company = elapsed_time / (i + 1)
                remaining_companies = len(companies) - (i + 1)
                eta_seconds = remaining_companies * avg_time_per_company
                eta_minutes = eta_seconds / 60
            else:
                eta_minutes = 0
            
            print(f"\n{'='*60}")
            print(f"📍 Processing {i+1}/{len(companies)} ({progress:.1f}%)")
            print(f"⏱️  Elapsed: {elapsed_time:.1f}s | ETA: {eta_minutes:.1f}m")
            print(f"🏢 Company: {company.get('name', 'Unknown')}")
            print(f"📍 Current: {company.get('headquarters_location', {}).get('raw', 'No address')}")
            print(f"📊 Status: ✅ {successful} | ❌ {failed}")
            print(f"{'='*60}")
            
            result = self.geocode_company(company)
            
            # Update company with geocoding results
            company['geocoding_result'] = result
            
            if result['success']:
                # Update the headquarters_location with new coordinates
                company['headquarters_location']['coordinates'] = result['coordinates']
                company['headquarters_location']['formatted_address'] = result['formatted_address']
                company['headquarters_location']['geocoded'] = True
                company['headquarters_location']['geocoding_method'] = result['method']
                if 'place_id' in result:
                    company['headquarters_location']['place_id'] = result['place_id']
                successful += 1
                print(f"✅ SUCCESS: {result['formatted_address']}")
                print(f"📍 New Coords: {result['coordinates']['lat']:.6f}, {result['coordinates']['lng']:.6f}")
                print(f"🔧 Method: {result['method']}")
            else:
                failed += 1
                print(f"❌ FAILED: {result['error']}")
            
            results.append(company)
            
            # Show live progress summary
            success_rate = successful / (successful + failed) * 100
            print(f"📈 Live Stats: {successful}/{successful+failed} ({success_rate:.1f}% success)")
            
            # Rate limiting
            if delay > 0:
                print(f"⏳ Waiting {delay}s before next request...")
                time.sleep(delay)
        
        total_time = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"🎉 GEOCODING COMPLETE!")
        print(f"{'='*60}")
        print(f"⏱️  Total Time: {total_time:.1f}s ({total_time/60:.1f}m)")
        print(f"✅ Successful: {successful}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {successful/(successful+failed)*100:.1f}%")
        print(f"⚡ Avg Time/Company: {total_time/len(companies):.2f}s")
        print(f"{'='*60}")
        
        return results

def main():
    print("=" * 80)
    print("🌍 HOUSTON COMPANIES GEOCODING TOOL")
    print("=" * 80)
    print("🔧 Using Google Places API for accurate coordinates")
    print("📍 Processing Houston-based companies")
    print("⏱️  Estimated time: 2-5 minutes for 50 companies")
    print("=" * 80)
    
    # Use the API key from the user
    api_key = "AIzaSyBGFqyws8LGGGkof2ZbP_Mt8l3hf_glfpE"
    
    # Load the Houston companies data
    print("\n📂 Loading Houston companies data...")
    try:
        with open('public/companies/companies-9-24-2025-geocoded.json', 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("❌ ERROR: Could not find companies data file!")
        print("   Expected: public/companies/companies-9-24-2025-geocoded.json")
        return
    except json.JSONDecodeError as e:
        print(f"❌ ERROR: Invalid JSON in companies file: {e}")
        return
    
    companies = data['companies']
    print(f"📊 Found {len(companies)} companies to geocode")
    
    # Initialize geocoder
    try:
        geocoder = HoustonCompanyGeocoder(api_key)
        print("✅ Google Places API initialized successfully")
    except Exception as e:
        print(f"❌ ERROR: Failed to initialize geocoder: {e}")
        return
    
    # Geocode companies in batches (companies 51-300, batches 2-6)
    print(f"\n🚀 Starting geocoding of companies 51-300 (batches 2-6)...")
    print(f"💡 Note: Processing in batches to avoid rate limits")
    
    # Process companies 51-300 (5 batches of 50 each)
    all_geocoded_companies = []
    
    for batch_num in range(2, 7):  # Batches 2, 3, 4, 5, 6
        start_idx = (batch_num - 1) * 50  # 50, 100, 150, 200, 250
        end_idx = batch_num * 50  # 100, 150, 200, 250, 300
        companies_to_process = companies[start_idx:end_idx]
        
        print(f"\n{'='*80}")
        print(f"🔄 BATCH {batch_num}/6: Processing companies {start_idx+1}-{end_idx}")
        print(f"{'='*80}")
        
        geocoded_batch = geocoder.geocode_companies(companies_to_process, delay=0.2)
        all_geocoded_companies.extend(geocoded_batch)
        
        # Save intermediate results after each batch
        intermediate_file = f'public/companies/companies-9-24-2025-places-geocoded-batch-{batch_num}.json'
        intermediate_data = {
            "metadata": {
                "batch_number": batch_num,
                "companies_range": f"{start_idx+1}-{end_idx}",
                "total_companies": len(geocoded_batch),
                "geocoding_date": "2025-01-27",
                "source_file": "public/companies/companies-9-24-2025-geocoded.json",
                "geocoding_method": "google_places_api",
                "api_key_used": api_key[:10] + "...",
                "geocoding_stats": {
                    "total": len(geocoded_batch),
                    "successful": len([c for c in geocoded_batch if c['geocoding_result']['success']]),
                    "failed": len([c for c in geocoded_batch if not c['geocoding_result']['success']])
                }
            },
            "companies": geocoded_batch
        }
        
        with open(intermediate_file, 'w') as f:
            json.dump(intermediate_data, f, indent=2)
        
        print(f"💾 Batch {batch_num} saved to {intermediate_file}")
        
        # Brief pause between batches
        if batch_num < 6:
            print(f"⏳ Pausing 2 seconds before next batch...")
            time.sleep(2)
    
    # Create final combined output data
    total_successful = len([c for c in all_geocoded_companies if c['geocoding_result']['success']])
    total_failed = len([c for c in all_geocoded_companies if not c['geocoding_result']['success']])
    
    output_data = {
        "metadata": {
            "total_companies": len(all_geocoded_companies),
            "batches_processed": "2-6 (companies 51-300)",
            "geocoding_date": "2025-01-27",
            "source_file": "public/companies/companies-9-24-2025-geocoded.json",
            "geocoding_method": "google_places_api",
            "api_key_used": api_key[:10] + "...",
            "geocoding_stats": {
                "total": len(all_geocoded_companies),
                "successful": total_successful,
                "failed": total_failed,
                "success_rate": f"{total_successful/(total_successful+total_failed)*100:.1f}%"
            }
        },
        "companies": all_geocoded_companies
    }
    
    # Save final combined results
    output_file = 'public/companies/companies-9-24-2025-places-geocoded-batches-2-6.json'
    print(f"\n💾 Saving final combined results to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"✅ All batches complete! Results saved to {output_file}")
    
    # Show final summary
    print(f"\n{'='*80}")
    print(f"🎉 FINAL BATCH SUMMARY (Companies 51-300)")
    print(f"{'='*80}")
    print(f"📊 Total Companies Processed: {len(all_geocoded_companies)}")
    print(f"✅ Successful: {total_successful}")
    print(f"❌ Failed: {total_failed}")
    print(f"📈 Success Rate: {total_successful/(total_successful+total_failed)*100:.1f}%")
    print(f"💾 Individual batch files saved as: companies-9-24-2025-places-geocoded-batch-X.json")
    print(f"💾 Combined file saved as: {output_file}")
    print(f"{'='*80}")
    
    # Show some examples from the final batch
    print(f"\n📋 Sample Results from Final Batch:")
    sample_companies = [c for c in all_geocoded_companies if c['geocoding_result']['success']][-5:]
    for i, company in enumerate(sample_companies):
        coords = company['headquarters_location']['coordinates']
        print(f"{i+1}. {company['name']}: {coords['lat']:.6f}, {coords['lng']:.6f}")

if __name__ == "__main__":
    main()
