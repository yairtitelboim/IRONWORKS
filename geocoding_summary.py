#!/usr/bin/env python3
"""
Summary of geocoded companies data
"""

import json
from collections import Counter

def analyze_geocoded_data(json_file_path: str) -> None:
    """Analyze the geocoded companies data"""
    
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    companies = data['companies']
    metadata = data['metadata']
    
    print("🎉 GEOCODED COMPANIES DATA SUMMARY")
    print("=" * 60)
    
    # Basic stats
    print(f"📊 Total companies: {metadata['total_companies']}")
    print(f"📅 Conversion date: {metadata['conversion_date']}")
    print(f"✅ Geocoding completed: {metadata.get('geocoding_completed', False)}")
    
    if 'geocoding_stats' in metadata:
        stats = metadata['geocoding_stats']
        print(f"\n📍 GEOCODING STATISTICS:")
        print(f"  ✅ Successful: {stats['successful']}")
        print(f"  ❌ Failed: {stats['failed']}")
        print(f"  ⏭️  Skipped: {stats['skipped']}")
        print(f"  📈 Success rate: {(stats['successful'] / stats['total']) * 100:.1f}%")
    
    # Coordinate analysis
    coordinates = []
    for company in companies:
        if company['headquarters_location']['coordinates']:
            coords = company['headquarters_location']['coordinates']
            coordinates.append((coords['lat'], coords['lng']))
    
    if coordinates:
        print(f"\n🗺️  COORDINATE ANALYSIS:")
        print(f"  📍 Companies with coordinates: {len(coordinates)}")
        
        # Calculate bounding box
        lats = [coord[0] for coord in coordinates]
        lngs = [coord[1] for coord in coordinates]
        
        print(f"  📐 Latitude range: {min(lats):.6f} to {max(lats):.6f}")
        print(f"  📐 Longitude range: {min(lngs):.6f} to {max(lngs):.6f}")
        
        # Calculate center point
        center_lat = sum(lats) / len(lats)
        center_lng = sum(lngs) / len(lngs)
        print(f"  🎯 Center point: {center_lat:.6f}, {center_lng:.6f}")
    
    # Industry analysis
    all_industries = []
    for company in companies:
        all_industries.extend(company['industries'])
    
    industry_counts = Counter(all_industries)
    print(f"\n🏭 TOP 10 INDUSTRIES:")
    for industry, count in industry_counts.most_common(10):
        print(f"  {industry}: {count} companies")
    
    # Employee size analysis
    employee_ranges = [company['employees']['range'] for company in companies if company['employees']['range']]
    employee_counts = Counter(employee_ranges)
    print(f"\n👥 EMPLOYEE SIZE DISTRIBUTION:")
    for range_str, count in employee_counts.most_common():
        print(f"  {range_str}: {count} companies")
    
    # Sample geocoded companies
    print(f"\n🏢 SAMPLE GEOCODED COMPANIES:")
    for i, company in enumerate(companies[:5], 1):
        coords = company['headquarters_location']['coordinates']
        print(f"  {i}. {company['name']}")
        print(f"     📍 {company['headquarters_location']['formatted_address']}")
        print(f"     🗺️  {coords['lat']:.6f}, {coords['lng']:.6f}")
        print(f"     🏭 {', '.join(company['industries'][:3])}")
        print(f"     👥 {company['employees']['range']} employees")
        print()
    
    # File size
    import os
    file_size = os.path.getsize(json_file_path)
    print(f"📁 File size: {file_size:,} bytes ({file_size/1024/1024:.1f} MB)")

def main():
    json_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025-geocoded.json"
    
    try:
        analyze_geocoded_data(json_file)
    except FileNotFoundError:
        print(f"❌ Error: JSON file not found at {json_file}")
    except Exception as e:
        print(f"❌ Error during analysis: {str(e)}")

if __name__ == "__main__":
    main()
