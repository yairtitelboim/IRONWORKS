#!/usr/bin/env python3
"""
Mock OpenAI Response Script for testing

This script provides mock responses for testing the planning document
processing pipeline without using actual API calls.
"""

import argparse
import json
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def extract_mock_data(text, doc_type, output_file):
    """Generate mock structured data based on text input."""
    # Simple regex-based extraction for zone codes
    import re
    
    zone_codes = re.findall(r'([RCMPO][A-Z0-9\-]+)\s+ZONE', text, re.IGNORECASE)
    districts = re.findall(r'([A-Za-z\s]+)\s+District', text, re.IGNORECASE)
    neighborhoods = re.findall(r'([A-Za-z\s]+)\s+neighborhood', text, re.IGNORECASE)
    
    # Create mock structured data
    result = {
        "documentType": doc_type,
        "documentTitle": "Mock Planning Document",
        "jurisdiction": "Los Angeles",
        "summary": text[:100] + "...",
        "zoning": [],
        "geographicReferences": []
    }
    
    # Add zoning data
    for zone in zone_codes:
        result["zoning"].append({
            "zoneCode": zone,
            "zoneName": "Mock Zone Name for " + zone,
            "allowedUses": ["Mock use 1", "Mock use 2"],
            "prohibitedUses": ["Mock prohibited use"],
            "developmentStandards": {
                "heightLimit": "35 feet",
                "farLimit": "0.5",
                "setbacks": {
                    "front": "20 feet",
                    "side": "5 feet",
                    "rear": "15 feet"
                }
            }
        })
    
    # Add geographic references
    for district in districts:
        result["geographicReferences"].append({
            "referenceType": "district",
            "name": district,
            "identifier": ""
        })
    
    for neighborhood in neighborhoods:
        result["geographicReferences"].append({
            "referenceType": "neighborhood",
            "name": neighborhood,
            "identifier": ""
        })
    
    # Save the mock result
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    logger.info(f"Generated mock data with {len(result['zoning'])} zones and {len(result['geographicReferences'])} geographic references")
    return result

def main():
    """Run the mock extraction."""
    parser = argparse.ArgumentParser(description="Generate mock planning document data")
    parser.add_argument("--input-file", required=True, help="Text file containing the planning document")
    parser.add_argument("--output-dir", default="test_output", help="Directory to save extracted data")
    parser.add_argument("--doc-type", default="zoning_ordinance", help="Type of planning document")
    
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)
    output_file = output_dir / "test_extracted_data.json"
    
    # Load input text
    input_file = Path(args.input_file)
    if not input_file.exists():
        logger.error(f"Input file does not exist: {input_file}")
        return
    
    # Read the input file
    try:
        with open(input_file, 'r') as f:
            document_text = f.read()
        logger.info(f"Loaded document from {input_file} ({len(document_text)} characters)")
    except Exception as e:
        logger.error(f"Error reading input file: {e}")
        return
    
    # Generate mock data
    logger.info(f"Generating mock structured data for document...")
    result = extract_mock_data(
        document_text, 
        args.doc_type, 
        output_file
    )
    
    if result:
        logger.info("Mock data generation successful")
        
        # Print a summary
        document_title = result.get("documentTitle", "Unknown title")
        num_zones = len(result.get("zoning", []))
        num_geo_refs = len(result.get("geographicReferences", []))
        
        logger.info("Extraction Summary:")
        logger.info(f"Document: {document_title}")
        logger.info(f"Document Type: {result.get('documentType', 'Unknown')}")
        logger.info(f"Jurisdiction: {result.get('jurisdiction', 'Unknown')}")
        logger.info(f"Zones Extracted: {num_zones}")
        logger.info(f"Geographic References: {num_geo_refs}")
    else:
        logger.error("Data extraction failed")

if __name__ == "__main__":
    main()
