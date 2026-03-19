#!/usr/bin/env python3

import os
import json
import logging
from pathlib import Path
import PyPDF2
from document_analyzer import DocumentAnalyzer
from geojson import Feature, FeatureCollection, Point, Polygon
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract text content from PDF file."""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
    except Exception as e:
        logger.error(f"Error extracting text from {pdf_path}: {str(e)}")
        return ""

def extract_coordinates(location_text: str) -> tuple:
    """Extract coordinates from location text using GPT."""
    try:
        # Use OpenAI to extract/estimate coordinates from location description
        analyzer = DocumentAnalyzer()
        prompt = f"""Extract or estimate the latitude and longitude coordinates for this location: {location_text}
        Return only a JSON object with 'lat' and 'lon' fields. Example:
        {{"lat": 29.7604, "lon": -95.3698}}"""
        
        response = analyzer.client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a geolocation expert. Return only valid JSON with coordinates."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        coords = json.loads(response.choices[0].message.content)
        return (float(coords["lat"]), float(coords["lon"]))
    except Exception as e:
        logger.error(f"Error extracting coordinates: {str(e)}")
        return (29.7604, -95.3698)  # Default to Houston coordinates

def convert_to_geojson(mappable_data: dict, doc_id: str) -> dict:
    """Convert extracted data into GeoJSON format."""
    features = []
    
    # Process development areas
    for area in mappable_data.get("developmentAreas", []):
        coords = extract_coordinates(area["name"])
        features.append(Feature(
            geometry=Point(coords),
            properties={
                "type": "development",
                "name": area["name"],
                "description": area["description"],
                "potentialType": area["potentialType"],
                "docId": doc_id,
                "potential_score": 15  # Example score, could be derived from analysis
            }
        ))
    
    # Process infrastructure capacity
    for infra in mappable_data.get("infrastructureCapacity", []):
        coords = extract_coordinates(infra["area"])
        features.append(Feature(
            geometry=Point(coords),
            properties={
                "type": "infrastructure",
                "area": infra["area"],
                "metricType": infra["metricType"],
                "value": infra["value"],
                "docId": doc_id,
                "capacity_score": 12  # Example score
            }
        ))
    
    # Process transit access
    for transit in mappable_data.get("transitAccess", []):
        coords = extract_coordinates(transit["location"])
        features.append(Feature(
            geometry=Point(coords),
            properties={
                "type": "transit",
                "location": transit["location"],
                "transitType": transit["type"],
                "metrics": transit["metrics"],
                "docId": doc_id,
                "access_score": 18  # Example score
            }
        ))
    
    # Process amenities
    for amenity in mappable_data.get("amenities", []):
        coords = extract_coordinates(amenity["location"])
        features.append(Feature(
            geometry=Point(coords),
            properties={
                "type": "amenity",
                "amenityType": amenity["type"],
                "location": amenity["location"],
                "status": amenity["status"],
                "docId": doc_id
            }
        ))
    
    # Process adaptive reuse areas
    for reuse in mappable_data.get("adaptiveReuse", []):
        coords = extract_coordinates(reuse["area"])
        features.append(Feature(
            geometry=Point(coords),
            properties={
                "type": "adaptive-reuse",
                "area": reuse["area"],
                "potential": reuse["potential"],
                "constraints": reuse["constraints"],
                "docId": doc_id,
                "reuse_potential": 16  # Example score
            }
        ))
    
    return FeatureCollection(features)

def process_single_document(pdf_path: Path, output_dir: Path) -> dict:
    """Process a single planning document and generate GeoJSON outputs."""
    logger.info(f"Processing document: {pdf_path}")
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Extract text from PDF
    text = extract_text_from_pdf(pdf_path)
    if not text:
        logger.error("Failed to extract text from PDF")
        return None
        
    # Initialize analyzer
    analyzer = DocumentAnalyzer()
    
    # Analyze document
    analysis = analyzer.analyze_document(text)
    if not analysis:
        logger.error("Failed to analyze document")
        return None
        
    # Generate document ID
    doc_id = f"doc_{pdf_path.stem}"
    
    # Save analysis results
    analysis_output = output_dir / f"{doc_id}_analysis.json"
    with open(analysis_output, 'w') as f:
        json.dump(analysis, f, indent=2)
        
    # Extract mappable data if document is relevant
    if int(analysis["fifteenMinCityRelevance"]) >= 3:  # Convert string to int
        mappable_data = analyzer.extract_mappable_data(text, analysis)
        
        # Convert to GeoJSON
        geojson_data = convert_to_geojson(mappable_data, doc_id)
        
        # Save GeoJSON output
        geojson_output = output_dir / f"{doc_id}_geo.json"
        with open(geojson_output, 'w') as f:
            json.dump(geojson_data, f, indent=2)
            
        return {
            "docId": doc_id,
            "title": pdf_path.stem,
            "analysis": analysis,
            "geojsonPath": str(geojson_output)
        }
    
    return None

def main():
    docs_dir = Path("public/planningDocs")
    output_dir = Path("public/processed_planning_docs/single")
    
    if not docs_dir.exists():
        logger.error(f"Planning documents directory not found: {docs_dir}")
        return
        
    # Get list of already processed documents
    processed_docs = {
        path.stem.replace('doc_', '').replace('_analysis', '')
        for path in output_dir.glob('*_analysis.json')
    }
    
    # Process first unprocessed document
    for pdf_file in docs_dir.glob("**/*.pdf"):
        if pdf_file.stem not in processed_docs:
            logger.info(f"Processing new document: {pdf_file}")
            result = process_single_document(pdf_file, output_dir)
            if result:
                logger.info(f"Successfully processed document: {pdf_file}")
                logger.info(f"GeoJSON output: {result['geojsonPath']}")
            break
        else:
            logger.debug(f"Skipping already processed document: {pdf_file}")

if __name__ == "__main__":
    main() 