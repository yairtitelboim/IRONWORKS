#!/usr/bin/env python3

import os
import json
import logging
from pathlib import Path
import PyPDF2
from document_analyzer import DocumentAnalyzer

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

def process_planning_documents(docs_dir: Path, output_dir: Path):
    """Process all planning documents in the directory."""
    
    analyzer = DocumentAnalyzer()
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Track all mappable data for combined analysis
    combined_data = {
        "developmentAreas": [],
        "infrastructureCapacity": [],
        "transitAccess": [],
        "amenities": [],
        "adaptiveReuse": []
    }
    
    # Process each PDF
    for pdf_file in docs_dir.glob("**/*.pdf"):
        logger.info(f"Processing {pdf_file}")
        
        # Extract text from PDF
        text = extract_text_from_pdf(pdf_file)
        if not text:
            continue
            
        # Analyze document
        analysis = analyzer.analyze_document(text)
        if not analysis:
            continue
            
        # Save analysis results
        analysis_output = output_dir / f"{pdf_file.stem}_analysis.json"
        with open(analysis_output, 'w') as f:
            json.dump(analysis, f, indent=2)
            
        # Extract mappable data if document is relevant
        if analysis["fifteenMinCityRelevance"] >= 3:
            mappable_data = analyzer.extract_mappable_data(text, analysis)
            
            # Save individual document data
            data_output = output_dir / f"{pdf_file.stem}_data.json"
            with open(data_output, 'w') as f:
                json.dump(mappable_data, f, indent=2)
                
            # Add to combined data
            for key in combined_data:
                if key in mappable_data:
                    combined_data[key].extend(mappable_data[key])
    
    # Save combined data
    with open(output_dir / "combined_planning_data.json", 'w') as f:
        json.dump(combined_data, f, indent=2)

def main():
    docs_dir = Path("public/planningDocs")
    output_dir = Path("public/processed_planning_docs")
    
    if not docs_dir.exists():
        logger.error(f"Planning documents directory not found: {docs_dir}")
        return
        
    process_planning_documents(docs_dir, output_dir)
    logger.info("Planning document processing complete")

if __name__ == "__main__":
    main() 