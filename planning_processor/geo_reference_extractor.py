#!/usr/bin/env python3
"""
Geographic Reference Extractor Module

This module processes structured planning documents and enhances geographic references
by linking them to actual geospatial data from the zoning GeoJSON.
"""

import argparse
import json
import os
import sys
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import re
import unicodedata

# Import geospatial libraries
try:
    import geopandas as gpd
    import shapely
    from shapely.geometry import Point, Polygon, shape
    HAVE_GEO = True
except ImportError:
    HAVE_GEO = False
    print("Warning: Geospatial libraries not found. Will perform limited geographic processing.")
    print("For full functionality, install geopandas and shapely.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_zoning_geojson(geojson_path: Path) -> Any:
    """Load zoning GeoJSON into a GeoDataFrame."""
    try:
        if not HAVE_GEO:
            # Limited functionality without geopandas
            with open(geojson_path, 'r') as f:
                return json.load(f)
        else:
            # Use geopandas for full functionality
            return gpd.read_file(geojson_path)
    except Exception as e:
        logger.error(f"Error loading zoning GeoJSON: {e}")
        return None

def normalize_text(text: str) -> str:
    """Normalize text for better matching."""
    if not text:
        return ""
    
    # Convert to lowercase
    text = text.lower()
    
    # Remove accents and special characters
    text = unicodedata.normalize('NFKD', text)
    text = ''.join([c for c in text if not unicodedata.combining(c)])
    
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    # Remove common non-alphanumeric characters
    text = re.sub(r'[^\w\s\-]', ' ', text)
    
    return text

def match_zone_code(zone_code: str, zoning_data: Any) -> Optional[Dict[str, Any]]:
    """Match a zone code to a feature in the zoning data."""
    if not HAVE_GEO:
        # Limited functionality without geopandas
        for feature in zoning_data.get('features', []):
            props = feature.get('properties', {})
            if props.get('zone_cmplt') == zone_code or props.get('zone_cmplt', '').startswith(zone_code):
                return feature
        return None
    else:
        # Use geopandas for full functionality
        matches = zoning_data[zoning_data['zone_cmplt'] == zone_code]
        if len(matches) > 0:
            return matches.iloc[0].to_dict()
        
        # Try partial match
        matches = zoning_data[zoning_data['zone_cmplt'].str.startswith(zone_code)]
        if len(matches) > 0:
            return matches.iloc[0].to_dict()
        
        return None

def match_location_name(location_name: str, zoning_data: Any) -> List[Dict[str, Any]]:
    """Match a location name to features in the zoning data."""
    normalized_name = normalize_text(location_name)
    matches = []
    
    if not HAVE_GEO:
        # Limited functionality without geopandas
        for feature in zoning_data.get('features', []):
            props = feature.get('properties', {})
            # Look for the name in various property fields
            for field in ['NAME', 'CITY', 'DISTRICT', 'NEIGHBORHOOD', 'COMMUNITY']:
                if field in props and normalize_text(props[field]).find(normalized_name) >= 0:
                    matches.append(feature)
                    break
        return matches[:5]  # Limit to top 5 matches
    else:
        # Use geopandas for full functionality
        for col in zoning_data.columns:
            if zoning_data[col].dtype == object:  # String columns
                filtered = zoning_data[zoning_data[col].fillna('').apply(
                    lambda x: normalize_text(str(x)).find(normalized_name) >= 0
                )]
                if len(filtered) > 0:
                    for _, row in filtered.iterrows():
                        matches.append(row.to_dict())
        
        return matches[:5]  # Limit to top 5 matches

def extract_boundary_from_match(match: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract boundary geometry from a matched feature."""
    if not HAVE_GEO:
        # Limited functionality without geopandas
        if isinstance(match, dict) and 'geometry' in match:
            return match['geometry']
        return None
    else:
        # Use geopandas for full functionality
        if 'geometry' in match:
            geom = match['geometry']
            if isinstance(geom, shapely.geometry.base.BaseGeometry):
                return shapely.geometry.mapping(geom)
        return None

def process_document(
    file_path: Path,
    output_path: Path,
    zoning_data: Any
) -> bool:
    """Process a document and enhance geographic references."""
    try:
        logger.info(f"Processing geographic references in: {file_path}")
        
        # Load the structured document
        with open(file_path, 'r') as f:
            document_data = json.load(f)
        
        # Get document ID
        doc_id = document_data.get("documentId", "unknown")
        
        # Process geographic references if they exist
        geo_references = document_data.get("geographicReferences", [])
        enhanced_references = []
        
        # First, process explicit zone references
        for ref in geo_references:
            enhanced_ref = ref.copy()
            
            # Try to match zone codes first
            if ref.get("referenceType") == "zone" and ref.get("identifier"):
                match = match_zone_code(ref["identifier"], zoning_data)
                if match:
                    boundary = extract_boundary_from_match(match)
                    if boundary:
                        enhanced_ref["boundary"] = boundary
            
            # Then try to match location names
            if not enhanced_ref.get("boundary") and ref.get("name"):
                matches = match_location_name(ref["name"], zoning_data)
                if matches:
                    # Use the first match for now
                    # In a full implementation, you might want a more sophisticated 
                    # selection process or include multiple potential matches
                    boundary = extract_boundary_from_match(matches[0])
                    if boundary:
                        enhanced_ref["boundary"] = boundary
                        
                        # If we found a match by name but not identifier, add the identifier
                        if not enhanced_ref.get("identifier") and "zone_cmplt" in matches[0]:
                            enhanced_ref["identifier"] = matches[0]["zone_cmplt"]
            
            enhanced_references.append(enhanced_ref)
        
        # Next, extract additional geographic references from zoning information
        if "zoning" in document_data:
            for zone_info in document_data["zoning"]:
                zone_code = zone_info.get("zoneCode")
                if zone_code:
                    # Check if this zone is already in the references
                    existing = False
                    for ref in enhanced_references:
                        if ref.get("referenceType") == "zone" and ref.get("identifier") == zone_code:
                            existing = True
                            break
                    
                    if not existing:
                        # Create a new geographic reference for this zone
                        new_ref = {
                            "referenceType": "zone",
                            "name": zone_info.get("zoneName", ""),
                            "identifier": zone_code
                        }
                        
                        # Try to find boundary
                        match = match_zone_code(zone_code, zoning_data)
                        if match:
                            boundary = extract_boundary_from_match(match)
                            if boundary:
                                new_ref["boundary"] = boundary
                        
                        enhanced_references.append(new_ref)
        
        # Update the document with enhanced references
        document_data["geographicReferences"] = enhanced_references
        
        # Update metadata
        if "metadata" not in document_data:
            document_data["metadata"] = {}
        
        document_data["metadata"]["geoReferenced"] = "true"
        document_data["metadata"]["geoReferencesCount"] = len(enhanced_references)
        document_data["metadata"]["geoReferencesWithBoundary"] = sum(1 for ref in enhanced_references if "boundary" in ref)
        
        # Save the enhanced document
        with open(output_path, 'w') as f:
            json.dump(document_data, f, indent=2)
        
        logger.info(f"Geographic reference processing complete for {doc_id}")
        logger.info(f"Found {len(enhanced_references)} references, {document_data['metadata']['geoReferencesWithBoundary']} with boundaries")
        
        return True
    
    except Exception as e:
        logger.error(f"Error processing geographic references in {file_path}: {e}")
        return False

def main():
    """Run the geographic reference extractor."""
    parser = argparse.ArgumentParser(description="Extract and validate geographic references in planning documents")
    parser.add_argument("--input-dir", required=True, help="Directory containing structured document data")
    parser.add_argument("--zoning-geojson", required=True, help="Path to zoning GeoJSON file")
    parser.add_argument("--output-dir", required=True, help="Directory to save geo-referenced documents")
    
    args = parser.parse_args()
    
    # Ensure directories exist
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    zoning_geojson = Path(args.zoning_geojson)
    
    output_dir.mkdir(exist_ok=True, parents=True)
    
    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        sys.exit(1)
        
    if not zoning_geojson.exists():
        logger.error(f"Zoning GeoJSON file does not exist: {zoning_geojson}")
        sys.exit(1)
    
    # Load zoning data
    logger.info(f"Loading zoning data from {zoning_geojson}")
    zoning_data = load_zoning_geojson(zoning_geojson)
    
    if zoning_data is None:
        logger.error("Failed to load zoning data")
        sys.exit(1)
    
    # Process all JSON files in the input directory
    input_files = list(input_dir.glob("*.json"))
    
    if not input_files:
        logger.warning(f"No JSON files found in {input_dir}")
        sys.exit(0)
    
    logger.info(f"Found {len(input_files)} documents to process")
    
    # Process each document
    success_count = 0
    for file_path in input_files:
        output_path = output_dir / file_path.name
        if process_document(file_path, output_path, zoning_data):
            success_count += 1
    
    logger.info(f"Geographic reference extraction complete. Processed {success_count}/{len(input_files)} documents successfully.")

if __name__ == "__main__":
    main() 