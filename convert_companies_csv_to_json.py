#!/usr/bin/env python3
"""
Convert companies CSV to JSON and prepare for geocoding
"""

import csv
import json
import re
from typing import Dict, List, Any

def clean_location_string(location: str) -> str:
    """Clean and standardize location string for geocoding"""
    if not location or location.strip() == "":
        return ""
    
    # Remove extra whitespace
    location = location.strip()
    
    # Handle common patterns
    # Remove "United States" suffix as it's redundant for US geocoding
    location = re.sub(r',\s*United States$', '', location, flags=re.IGNORECASE)
    
    return location

def parse_employee_count(employee_str: str) -> Dict[str, Any]:
    """Parse employee count string into structured data"""
    if not employee_str or employee_str.strip() == "":
        return {"min": None, "max": None, "range": None}
    
    employee_str = employee_str.strip()
    
    # Handle ranges like "501-1000"
    if "-" in employee_str:
        try:
            parts = employee_str.split("-")
            if len(parts) == 2:
                min_emp = int(parts[0].strip())
                max_emp = int(parts[1].strip())
                return {
                    "min": min_emp,
                    "max": max_emp,
                    "range": employee_str
                }
        except ValueError:
            pass
    
    # Handle single numbers
    try:
        num = int(employee_str)
        return {"min": num, "max": num, "range": str(num)}
    except ValueError:
        pass
    
    return {"min": None, "max": None, "range": employee_str}

def parse_industries(industries_str: str) -> List[str]:
    """Parse industries string into list"""
    if not industries_str or industries_str.strip() == "":
        return []
    
    # Split by comma and clean each industry
    industries = [industry.strip() for industry in industries_str.split(",")]
    return [industry for industry in industries if industry]

def convert_csv_to_json(csv_file_path: str, json_file_path: str) -> None:
    """Convert CSV to JSON with geocoding preparation"""
    
    companies = []
    
    with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        
        for row in reader:
            # Clean and prepare the data
            company = {
                "id": len(companies) + 1,  # Add sequential ID
                "name": row.get("Organization Name", "").strip(),
                "url": row.get("Organization Name URL", "").strip(),
                "employees": parse_employee_count(row.get("Number of Employees", "")),
                "heat_score_tier": row.get("Heat Score Tier", "").strip(),
                "operating_status": row.get("Operating Status", "").strip(),
                "ipo_status": row.get("IPO Status", "").strip(),
                "headquarters_location": {
                    "raw": row.get("Headquarters Location", "").strip(),
                    "cleaned": clean_location_string(row.get("Headquarters Location", "")),
                    "geocoded": False,  # Will be set to True after geocoding
                    "coordinates": None,  # Will be populated after geocoding
                    "formatted_address": None  # Will be populated after geocoding
                },
                "industries": parse_industries(row.get("Industries", "")),
                "description": row.get("Description", "").strip(),
                "cb_rank_organization": row.get("CB Rank (Organization)", "").strip(),
                "stage": row.get("Stage", "").strip(),
                "cb_rank_company": row.get("CB Rank (Company)", "").strip(),
                "geocoding_status": "pending",  # pending, success, failed
                "geocoding_notes": None  # For any geocoding issues
            }
            
            companies.append(company)
    
    # Create the output structure
    output = {
        "metadata": {
            "total_companies": len(companies),
            "conversion_date": "2025-01-27",
            "source_file": csv_file_path,
            "geocoding_ready": True,
            "geocoding_fields": [
                "headquarters_location.cleaned"
            ]
        },
        "companies": companies
    }
    
    # Write to JSON file
    with open(json_file_path, 'w', encoding='utf-8') as jsonfile:
        json.dump(output, jsonfile, indent=2, ensure_ascii=False)
    
    print(f"✅ Successfully converted {len(companies)} companies from CSV to JSON")
    print(f"📁 Output saved to: {json_file_path}")
    
    # Print some statistics
    locations_with_data = sum(1 for company in companies if company["headquarters_location"]["cleaned"])
    print(f"📍 Companies with location data: {locations_with_data}/{len(companies)}")
    
    # Show sample of cleaned locations
    print("\n🔍 Sample of cleaned locations for geocoding:")
    sample_locations = [company["headquarters_location"]["cleaned"] 
                       for company in companies[:10] 
                       if company["headquarters_location"]["cleaned"]]
    for i, location in enumerate(sample_locations, 1):
        print(f"  {i}. {location}")

def main():
    csv_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025.csv"
    json_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/companies/companies-9-24-2025.json"
    
    try:
        convert_csv_to_json(csv_file, json_file)
    except FileNotFoundError:
        print(f"❌ Error: CSV file not found at {csv_file}")
    except Exception as e:
        print(f"❌ Error during conversion: {str(e)}")

if __name__ == "__main__":
    main()
