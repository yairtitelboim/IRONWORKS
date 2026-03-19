#!/usr/bin/env python3
"""
Validate and analyze the companies JSON file
"""

import json
from collections import Counter
from typing import Dict, List, Any

def analyze_companies_json(json_file_path: str) -> None:
    """Analyze the companies JSON file and show statistics"""
    
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    companies = data['companies']
    metadata = data['metadata']
    
    print("📊 COMPANIES JSON ANALYSIS")
    print("=" * 50)
    
    # Basic stats
    print(f"Total companies: {metadata['total_companies']}")
    print(f"Conversion date: {metadata['conversion_date']}")
    print(f"Geocoding ready: {metadata['geocoding_ready']}")
    
    # Location analysis
    locations = [company['headquarters_location']['cleaned'] for company in companies]
    unique_locations = set(location for location in locations if location)
    
    print(f"\n📍 LOCATION ANALYSIS")
    print(f"Companies with location data: {len([l for l in locations if l])}")
    print(f"Unique locations: {len(unique_locations)}")
    
    # Top locations
    location_counts = Counter(locations)
    print(f"\n🏆 TOP 10 LOCATIONS:")
    for location, count in location_counts.most_common(10):
        if location:
            print(f"  {location}: {count} companies")
    
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
    
    # Operating status
    operating_status = [company['operating_status'] for company in companies]
    status_counts = Counter(operating_status)
    print(f"\n⚡ OPERATING STATUS:")
    for status, count in status_counts.most_common():
        print(f"  {status}: {count} companies")
    
    # IPO status
    ipo_status = [company['ipo_status'] for company in companies]
    ipo_counts = Counter(ipo_status)
    print(f"\n📈 IPO STATUS:")
    for status, count in ipo_counts.most_common():
        print(f"  {status}: {count} companies")
    
    # Heat score tiers
    heat_tiers = [company['heat_score_tier'] for company in companies]
    heat_counts = Counter(heat_tiers)
    print(f"\n🔥 HEAT SCORE TIERS:")
    for tier, count in heat_counts.most_common():
        print(f"  {tier}: {count} companies")
    
    # Sample companies
    print(f"\n🏢 SAMPLE COMPANIES:")
    for i, company in enumerate(companies[:5], 1):
        print(f"  {i}. {company['name']}")
        print(f"     Location: {company['headquarters_location']['cleaned']}")
        print(f"     Industries: {', '.join(company['industries'][:3])}")
        print(f"     Employees: {company['employees']['range']}")
        print()

def main():
    json_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025.json"
    
    try:
        analyze_companies_json(json_file)
    except FileNotFoundError:
        print(f"❌ Error: JSON file not found at {json_file}")
    except Exception as e:
        print(f"❌ Error during analysis: {str(e)}")

if __name__ == "__main__":
    main()
