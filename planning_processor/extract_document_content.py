#!/usr/bin/env python3
"""
Document Content Extraction Module

This module extracts content from planning documents using PDF text extraction
and document understanding techniques.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
import logging
import hashlib
from typing import Dict, List, Optional, Tuple, Union, Any

# Import document processing libraries
try:
    from pdfminer.high_level import extract_text_to_fp
    from pdfminer.layout import LAParams
    from io import StringIO
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: Required document processing libraries not found.")
    print("Install them with: pip install pdfminer.six beautifulsoup4")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def generate_document_id(file_path: Path) -> str:
    """Generate a unique document ID based on file path and content."""
    hasher = hashlib.md5()
    hasher.update(str(file_path).encode())
    hasher.update(str(os.path.getmtime(file_path)).encode())
    return f"doc_{hasher.hexdigest()[:12]}"

def process_document(
    file_path: Path, 
    output_dir: Path,
    use_vision_model: bool = False  # Kept for compatibility
) -> Dict[str, Any]:
    """Process a document and extract its content."""
    logger.info(f"Processing document: {file_path}")
    
    document_id = generate_document_id(file_path)
    file_extension = file_path.suffix.lower()
    
    # Create base document structure
    document_data = {
        "documentId": document_id,
        "documentType": "other",
        "title": file_path.stem,
        "content": {
            "summary": "",
            "sections": [],
            "tables": []
        },
        "metadata": {
            "fileType": file_extension[1:],
            "processingTimestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "processingMethod": "text_extraction"
        }
    }
    
    try:
        if file_extension == '.pdf':
            document_data = process_pdf(file_path, document_data)
        elif file_extension in ['.txt']:
            document_data = process_text(file_path, document_data)
        else:
            logger.warning(f"Unsupported file type: {file_extension}")
            document_data["metadata"]["processingMethod"] = "unsupported_file_type"
    except Exception as e:
        logger.error(f"Error processing document {file_path}: {e}")
        document_data["metadata"]["error"] = str(e)
    
    # Save the extracted content
    output_file = output_dir / f"{document_id}.json"
    with open(output_file, 'w') as f:
        json.dump(document_data, f, indent=2)
    
    logger.info(f"Document processed and saved to: {output_file}")
    return document_data

def process_pdf(file_path: Path, document_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process a PDF document using pdfminer.six."""
    
    # Extract text from PDF
    output_string = StringIO()
    with open(file_path, 'rb') as pdf_file:
        extract_text_to_fp(pdf_file, output_string, laparams=LAParams())
    
    text = output_string.getvalue()
    
    # Split text into sections based on newlines and potential headers
    lines = text.split('\n')
    current_section = None
    current_section_text = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Potential section header detection
        if (line.isupper() or 
            (len(line) < 100 and any(char.isdigit() for char in line)) or
            line.startswith('Section') or 
            line.startswith('SECTION')):
            
            # Save previous section if exists
            if current_section and current_section_text:
                document_data["content"]["sections"].append({
                    "heading": current_section,
                    "text": "\n".join(current_section_text)
                })
                current_section_text = []
            
            current_section = line
            
            # First section header might be the title
            if not document_data.get("title"):
                document_data["title"] = line
                
        else:
            if current_section:
                current_section_text.append(line)
            elif len(document_data["content"]["summary"]) < 1000:
                document_data["content"]["summary"] += " " + line
    
    # Add the last section
    if current_section and current_section_text:
        document_data["content"]["sections"].append({
            "heading": current_section,
            "text": "\n".join(current_section_text)
        })
    
    # Infer document type and extract dates
    document_data = infer_document_type(document_data)
    document_data = extract_date_information(document_data)
    
    return document_data

def process_text(file_path: Path, document_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process a text document."""
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()
    
    lines = text.split('\n')
    
    # First non-empty line might be title
    for line in lines:
        if line.strip():
            document_data["title"] = line.strip()
            break
    
    # Rest goes into a single section
    document_data["content"]["sections"].append({
        "heading": "Main Content",
        "text": text
    })
    
    # Get a summary
    summary_lines = []
    for line in lines:
        if line.strip() and len(summary_lines) < 5:
            summary_lines.append(line.strip())
    
    document_data["content"]["summary"] = " ".join(summary_lines)
    
    return document_data

def infer_document_type(document_data: Dict[str, Any]) -> Dict[str, Any]:
    """Infer the document type from its content."""
    # This is a simple keyword-based approach
    # In a full implementation, you'd use a classifier or more sophisticated NLP
    
    title = document_data.get("title", "").lower()
    summary = document_data.get("content", {}).get("summary", "").lower()
    
    # Collect text from all sections
    all_text = ""
    for section in document_data.get("content", {}).get("sections", []):
        all_text += section.get("heading", "").lower() + " "
        all_text += section.get("text", "").lower() + " "
    
    # Check for document type indicators
    if any(term in title + " " + summary + " " + all_text for term in ["zoning", "zone", "zoned"]):
        document_data["documentType"] = "zoning_ordinance"
    
    elif any(term in title + " " + summary + " " + all_text for term in ["community plan", "neighborhood plan"]):
        document_data["documentType"] = "community_plan"
    
    elif "specific plan" in title + " " + summary + " " + all_text:
        document_data["documentType"] = "specific_plan"
    
    elif "general plan" in title + " " + summary + " " + all_text:
        document_data["documentType"] = "general_plan"
    
    elif any(term in title + " " + summary + " " + all_text for term in ["development agreement", "developer agreement"]):
        document_data["documentType"] = "development_agreement"
    
    elif any(term in title + " " + summary + " " + all_text for term in ["environmental impact", "eia", "eir"]):
        document_data["documentType"] = "environmental_impact"
    
    return document_data

def extract_date_information(document_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract date information from document content."""
    # In a full implementation, you would use NER or date extraction models
    # For now, let's use a simple regex-based approach
    
    import re
    from datetime import datetime
    
    # Pattern for dates like MM/DD/YYYY, YYYY-MM-DD, Month DD YYYY, etc.
    date_patterns = [
        r'\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](19|20)\d{2}\b',  # MM/DD/YYYY
        r'\b(19|20)\d{2}[\/\-](0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])\b',  # YYYY/MM/DD
        r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(0?[1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?,?\s+(19|20)\d{2}\b',  # Month DD, YYYY
    ]
    
    # Helper function to convert matched date to ISO format
    def parse_date(date_str):
        try:
            # Try different date formats
            for fmt in ['%m/%d/%Y', '%Y-%m-%d', '%B %d, %Y', '%B %d %Y']:
                try:
                    return datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
                except ValueError:
                    continue
            return None
        except Exception:
            return None
    
    # Collect text to search for dates
    search_text = document_data.get("title", "") + " "
    search_text += document_data.get("content", {}).get("summary", "") + " "
    
    for section in document_data.get("content", {}).get("sections", []):
        search_text += section.get("heading", "") + " "
        search_text += section.get("text", "") + " "
    
    # Find all dates in the text
    found_dates = []
    for pattern in date_patterns:
        matches = re.finditer(pattern, search_text, re.IGNORECASE)
        for match in matches:
            date_str = match.group(0)
            iso_date = parse_date(date_str)
            if iso_date:
                found_dates.append((iso_date, match.start()))
    
    # Sort by position in text (earlier mentions are likely more important)
    found_dates.sort(key=lambda x: x[1])
    
    # If we found any dates, use the first one as the document date
    if found_dates:
        document_data["documentDate"] = found_dates[0][0]
    
    return document_data

def main():
    """Run the document extraction process."""
    parser = argparse.ArgumentParser(description="Extract content from planning documents using advanced techniques")
    parser.add_argument("--docs-dir", required=True, help="Directory containing planning documents")
    parser.add_argument("--output-dir", required=True, help="Directory to save extracted content")
    parser.add_argument("--use-vision-model", action="store_true", help="Use vision models for enhanced extraction")
    
    args = parser.parse_args()
    
    # Ensure directories exist
    docs_dir = Path(args.docs_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)
    
    if not docs_dir.exists():
        logger.error(f"Documents directory does not exist: {docs_dir}")
        sys.exit(1)
    
    # Process all documents
    supported_extensions = ['.pdf', '.txt']
    documents = []
    
    for ext in supported_extensions:
        documents.extend(list(docs_dir.glob(f"*{ext}")))
    
    if not documents:
        logger.warning(f"No supported documents found in {docs_dir}")
        sys.exit(0)
    
    logger.info(f"Found {len(documents)} documents to process")
    
    # Process each document
    for doc_path in documents:
        try:
            process_document(doc_path, output_dir, args.use_vision_model)
        except Exception as e:
            logger.error(f"Failed to process document {doc_path}: {e}")
    
    logger.info("Document extraction complete")

if __name__ == "__main__":
    main() 