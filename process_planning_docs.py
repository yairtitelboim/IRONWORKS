#!/usr/bin/env python3
"""
Los Angeles Planning Document Processor

This script processes PDF planning documents from Los Angeles, extracts
relevant zoning information, and maps it to existing GeoJSON zoning data.
It creates an enriched GeoJSON file that can be used to display additional
planning information on the zoning map.

Requirements:
pip install pdfplumber spacy pytesseract pillow pandas geopandas langchain
"""

import os
import json
import re
import glob
from pathlib import Path
from collections import defaultdict
import logging

import pdfplumber
import spacy
import pandas as pd
import geopandas as gpd
from PIL import Image
import pytesseract
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load NLP model for entity extraction
try:
    nlp = spacy.load("en_core_web_lg")
    logger.info("Loaded spaCy model successfully")
except OSError:
    logger.info("Downloading spaCy model...")
    spacy.cli.download("en_core_web_lg")
    nlp = spacy.load("en_core_web_lg")

class PlanningDocProcessor:
    def __init__(self, docs_dir, zoning_geojson_path, output_dir):
        """
        Initialize the planning document processor.
        
        Args:
            docs_dir: Directory containing PDF planning documents
            zoning_geojson_path: Path to the existing zoning GeoJSON file
            output_dir: Directory to save processed results
        """
        self.docs_dir = docs_dir
        self.zoning_geojson_path = zoning_geojson_path
        self.output_dir = output_dir
        self.zoning_data = None
        self.documents = []
        self.processed_data = defaultdict(list)
        self.vector_store = None
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Los Angeles neighborhood areas for entity recognition
        self.la_neighborhoods = [
            'Downtown', 'Hollywood', 'Silver Lake', 'Echo Park', 'Westlake', 
            'Koreatown', 'Chinatown', 'Little Tokyo', 'Arts District', 'Boyle Heights',
            'East Los Angeles', 'West Hollywood', 'Beverly Hills', 'Bel Air', 'Brentwood',
            'Pacific Palisades', 'Venice', 'Marina del Rey', 'Playa del Rey', 
            'Westchester', 'South LA', 'Crenshaw', 'Baldwin Hills', 'Leimert Park',
            'Jefferson Park', 'West Adams', 'Culver City', 'Palms', 'Mar Vista',
            'Santa Monica', 'Malibu', 'Pasadena', 'Glendale', 'Burbank', 'North Hollywood',
            'Studio City', 'Sherman Oaks', 'Encino', 'Tarzana', 'Woodland Hills',
            'Canoga Park', 'Reseda', 'Van Nuys', 'Panorama City', 'Sun Valley',
            'San Fernando', 'Sylmar', 'Granada Hills', 'Northridge', 'Chatsworth',
            'Porter Ranch', 'Pacoima', 'Arleta', 'San Pedro', 'Wilmington',
            'Harbor City', 'Carson', 'Torrance', 'Compton', 'Watts', 'Inglewood',
            'Hawthorne', 'El Segundo', 'Gardena', 'Long Beach'
        ]
        
        # Common LA zoning code patterns for matching
        self.zoning_patterns = [
            r'R[1-5]', r'RS', r'RE\d*', r'RA', r'RW\d*', r'RD\d*', r'RMP', 
            r'CR', r'C[1-5]', r'C[1-5](\.\d)?', r'CM', r'CW', 
            r'M[1-3]', r'MR[1-2]', r'P', r'PF', r'OS', r'GW', r'ADP'
        ]
        self.zoning_regex = re.compile('|'.join(self.zoning_patterns))
        
        # Policy types to look for
        self.policy_types = [
            'Adaptive Reuse', 'Housing Element', 'Downtown Community Plan',
            'Community Plan', 'Transit Oriented Development', 'TOD',
            'Specific Plan', 'Overlay Zone', 'Historic Preservation',
            'Affordable Housing', 'Inclusionary Zoning', 'Density Bonus',
            'Mixed Use', 'Upzoning', 'Rezoning', 'Land Use', 'Ordinance'
        ]

    def load_zoning_data(self):
        """Load the existing zoning GeoJSON data."""
        try:
            self.zoning_data = gpd.read_file(self.zoning_geojson_path)
            logger.info(f"Loaded zoning data with {len(self.zoning_data)} features")
            
            # Add a column for planning document references
            if 'planning_docs' not in self.zoning_data.columns:
                self.zoning_data['planning_docs'] = None
                
            return True
        except Exception as e:
            logger.error(f"Error loading zoning data: {e}")
            return False

    def find_pdf_documents(self):
        """Find all PDF documents in the docs directory."""
        pdf_paths = glob.glob(os.path.join(self.docs_dir, "**/*.pdf"), recursive=True)
        logger.info(f"Found {len(pdf_paths)} PDF documents")
        return pdf_paths

    def extract_text_from_pdf(self, pdf_path):
        """Extract text from a PDF document using pdfplumber."""
        document_text = ""
        document_metadata = {"filename": os.path.basename(pdf_path), "path": pdf_path}
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                document_metadata["total_pages"] = len(pdf.pages)
                
                for i, page in enumerate(pdf.pages):
                    # Extract text from the page
                    page_text = page.extract_text() or ""
                    
                    # If text extraction fails, try OCR
                    if not page_text.strip():
                        logger.info(f"Using OCR for page {i+1} of {pdf_path}")
                        img = page.to_image(resolution=300)
                        img_pil = img.original
                        page_text = pytesseract.image_to_string(img_pil)
                    
                    document_text += f"\n--- Page {i+1} ---\n{page_text}"
                    
                    # Extract tables if any
                    tables = page.extract_tables()
                    if tables:
                        document_text += f"\n--- Tables on Page {i+1} ---\n"
                        for table in tables:
                            for row in table:
                                document_text += " | ".join([str(cell or "") for cell in row]) + "\n"
            
            logger.info(f"Extracted {len(document_text)} characters from {pdf_path}")
            return document_text, document_metadata
            
        except Exception as e:
            logger.error(f"Error extracting text from {pdf_path}: {e}")
            return "", document_metadata

    def process_documents(self):
        """Process all PDF documents in the directory."""
        pdf_paths = self.find_pdf_documents()
        processed_docs = []
        
        for pdf_path in pdf_paths:
            logger.info(f"Processing {pdf_path}")
            text, metadata = self.extract_text_from_pdf(pdf_path)
            
            if text:
                doc_data = {
                    "text": text,
                    "metadata": metadata,
                    "zones_mentioned": self.extract_zone_mentions(text),
                    "areas_mentioned": self.extract_area_mentions(text),
                    "policies_mentioned": self.extract_policy_mentions(text),
                    "summary": self.generate_summary(text)
                }
                processed_docs.append(doc_data)
                
                # Save individual document data
                doc_filename = os.path.splitext(os.path.basename(pdf_path))[0]
                with open(os.path.join(self.output_dir, f"{doc_filename}_processed.json"), 'w') as f:
                    json.dump(doc_data, f, indent=2)
            
        self.documents = processed_docs
        logger.info(f"Processed {len(processed_docs)} documents")
        return processed_docs

    def extract_zone_mentions(self, text):
        """Extract zone code mentions from text."""
        zones_mentioned = []
        matches = self.zoning_regex.findall(text)
        zones_mentioned.extend(matches)
        
        # Process with spaCy for more sophisticated entity extraction
        doc = nlp(text[:1000000])  # Limit to first million chars to avoid memory issues
        
        for ent in doc.ents:
            if ent.label_ == "ORG" and len(ent.text) <= 10:
                # Check if it matches zoning code patterns
                if self.zoning_regex.match(ent.text):
                    zones_mentioned.append(ent.text)
        
        # Remove duplicates and sort
        zones_mentioned = sorted(list(set(zones_mentioned)))
        return zones_mentioned

    def extract_area_mentions(self, text):
        """Extract geographic area mentions from text."""
        areas_mentioned = []
        
        # Process with spaCy for entity extraction
        doc = nlp(text[:1000000])  # Limit to first million chars to avoid memory issues
        
        for ent in doc.ents:
            if ent.label_ == "GPE" or ent.label_ == "LOC":
                areas_mentioned.append(ent.text)
        
        # Look for specific LA neighborhoods
        for neighborhood in self.la_neighborhoods:
            if re.search(r'\b' + re.escape(neighborhood) + r'\b', text, re.IGNORECASE):
                areas_mentioned.append(neighborhood)
        
        # Remove duplicates and sort
        areas_mentioned = sorted(list(set(areas_mentioned)))
        return areas_mentioned

    def extract_policy_mentions(self, text):
        """Extract policy type mentions from text."""
        policies_mentioned = []
        
        for policy in self.policy_types:
            if re.search(r'\b' + re.escape(policy) + r'\b', text, re.IGNORECASE):
                policies_mentioned.append(policy)
        
        # Extract section titles that might indicate policies
        section_titles = re.findall(r'(?:SECTION|Article|Chapter)\s+\d+\.\s+([A-Z][^\n\.]{5,50})', text)
        policies_mentioned.extend(section_titles)
        
        # Remove duplicates and sort
        policies_mentioned = sorted(list(set(policies_mentioned)))
        return policies_mentioned

    def generate_summary(self, text, max_length=500):
        """Generate a short summary of the document content."""
        # Simple summary generation - extract first paragraph after common introductory headings
        summary_patterns = [
            r'(?:EXECUTIVE\s+SUMMARY|INTRODUCTION|OVERVIEW|PURPOSE)[:\s\n]+([^\n]{50,500})',
            r'(?:BACKGROUND|SUMMARY)[:\s\n]+([^\n]{50,500})',
            r'(?:This\s+document\s+|The\s+purpose\s+of\s+this)([^\n]{50,500})'
        ]
        
        for pattern in summary_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()[:max_length]
        
        # Fallback: just take the first substantive paragraph
        paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
        for p in paragraphs:
            if len(p) > 100 and not p.startswith('Page') and not re.match(r'^[\d\-\s]+$', p):
                return p[:max_length]
                
        return "No summary available."

    def create_vector_store(self):
        """Create a vector store for semantic search of documents."""
        if not self.documents:
            logger.error("No documents to create vector store")
            return False
        
        try:
            logger.info("Creating vector store for semantic search...")
            # Prepare documents for vector store
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            
            all_chunks = []
            for doc in self.documents:
                texts = text_splitter.split_text(doc["text"])
                chunks = [
                    {
                        "content": chunk,
                        "metadata": {
                            "filename": doc["metadata"]["filename"],
                            "zones": doc["zones_mentioned"],
                            "areas": doc["areas_mentioned"],
                            "policies": doc["policies_mentioned"]
                        }
                    }
                    for chunk in texts
                ]
                all_chunks.extend(chunks)
            
            # Create the vector store
            embeddings = OpenAIEmbeddings()
            self.vector_store = FAISS.from_documents(all_chunks, embeddings)
            
            # Save the vector store
            self.vector_store.save_local(os.path.join(self.output_dir, "planning_docs_index"))
            logger.info(f"Created vector store with {len(all_chunks)} chunks")
            return True
            
        except Exception as e:
            logger.error(f"Error creating vector store: {e}")
            return False

    def map_docs_to_zones(self):
        """Map document information to zoning GeoJSON."""
        if not self.zoning_data or not self.documents:
            logger.error("Zoning data or documents not loaded")
            return False
        
        try:
            # Create mapping from zone codes to documents
            zone_to_docs = defaultdict(list)
            
            for doc in self.documents:
                for zone in doc["zones_mentioned"]:
                    doc_info = {
                        "filename": doc["metadata"]["filename"],
                        "title": doc["metadata"]["filename"].replace(".pdf", "").replace("_", " "),
                        "summary": doc["summary"],
                        "policies": doc["policies_mentioned"],
                        "areas": doc["areas_mentioned"]
                    }
                    zone_to_docs[zone].append(doc_info)
            
            # Map documents to zoning features
            logger.info("Mapping documents to zoning features...")
            
            # Create a new column for planning documents if it doesn't exist
            if 'planning_docs' not in self.zoning_data.columns:
                self.zoning_data['planning_docs'] = None
            
            # Iterate through each zoning feature
            for idx, feature in self.zoning_data.iterrows():
                zone_code = feature.get('zone_cmplt', '')
                base_zone = None
                
                # Extract base zone
                if zone_code:
                    # Use the same base zone extraction as in the frontend
                    base_zone_match = re.match(r'^(?:\[?Q\]?)?(?:\(T\))?(?:\(Q\))?([A-Za-z0-9]+)', zone_code)
                    if base_zone_match:
                        base_zone = base_zone_match.group(1)
                
                if base_zone and base_zone in zone_to_docs:
                    self.zoning_data.at[idx, 'planning_docs'] = zone_to_docs[base_zone]
            
            # Count how many features have planning docs
            doc_count = self.zoning_data['planning_docs'].notna().sum()
            logger.info(f"Mapped planning documents to {doc_count} zoning features")
            
            # Save the enriched GeoJSON
            output_geojson = os.path.join(self.output_dir, 'zoning_with_planning_docs.geojson')
            self.zoning_data.to_file(output_geojson, driver='GeoJSON')
            logger.info(f"Saved enriched GeoJSON to {output_geojson}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error mapping documents to zones: {e}")
            return False
    
    def generate_policy_layer(self):
        """Generate a separate GeoJSON layer for policy overlays."""
        if not self.documents:
            logger.error("No documents processed")
            return False
        
        try:
            # Group documents by policy
            policy_to_areas = defaultdict(set)
            
            for doc in self.documents:
                for policy in doc["policies_mentioned"]:
                    for area in doc["areas_mentioned"]:
                        policy_to_areas[policy].add(area)
            
            # For each policy, create a feature
            features = []
            for policy, areas in policy_to_areas.items():
                # In a real implementation, we would get actual boundaries
                # For this proof of concept, we'll use a simplified approach
                feature = {
                    "type": "Feature",
                    "properties": {
                        "policy": policy,
                        "areas": list(areas),
                        "documents": [
                            doc["metadata"]["filename"] 
                            for doc in self.documents 
                            if policy in doc["policies_mentioned"]
                        ],
                        "description": f"Policy area for {policy} affecting {', '.join(list(areas)[:3])}"
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [-118.2437, 34.0522]  # LA City Hall as placeholder
                    }
                }
                features.append(feature)
            
            # Create GeoJSON
            policy_geojson = {
                "type": "FeatureCollection",
                "features": features
            }
            
            # Save policy GeoJSON
            output_policy_geojson = os.path.join(self.output_dir, 'planning_policies.geojson')
            with open(output_policy_geojson, 'w') as f:
                json.dump(policy_geojson, f, indent=2)
            
            logger.info(f"Generated policy layer with {len(features)} policies")
            logger.info(f"Saved policy GeoJSON to {output_policy_geojson}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error generating policy layer: {e}")
            return False
    
    def create_document_index(self):
        """Create a searchable index of all document content."""
        if not self.documents:
            logger.error("No documents processed")
            return False
        
        try:
            # Create an index with metadata about each document
            doc_index = []
            
            for doc in self.documents:
                doc_info = {
                    "filename": doc["metadata"]["filename"],
                    "title": doc["metadata"]["filename"].replace(".pdf", "").replace("_", " "),
                    "pages": doc["metadata"].get("total_pages", 0),
                    "summary": doc["summary"],
                    "zones_mentioned": doc["zones_mentioned"],
                    "areas_mentioned": doc["areas_mentioned"],
                    "policies_mentioned": doc["policies_mentioned"],
                    "text_sample": doc["text"][:500] + "..." if len(doc["text"]) > 500 else doc["text"]
                }
                doc_index.append(doc_info)
            
            # Save document index
            output_index = os.path.join(self.output_dir, 'planning_docs_index.json')
            with open(output_index, 'w') as f:
                json.dump(doc_index, f, indent=2)
            
            logger.info(f"Created document index with {len(doc_index)} documents")
            logger.info(f"Saved document index to {output_index}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error creating document index: {e}")
            return False
    
    def process_all(self):
        """Run the complete processing pipeline."""
        logger.info("Starting planning document processing pipeline")
        
        success = self.load_zoning_data()
        if not success:
            logger.error("Failed to load zoning data. Aborting pipeline.")
            return False
        
        self.process_documents()
        
        self.map_docs_to_zones()
        self.generate_policy_layer()
        self.create_document_index()
        
        # Optionally create vector store if OpenAI API key is available
        if os.environ.get("OPENAI_API_KEY"):
            self.create_vector_store()
        else:
            logger.info("Skipping vector store creation (no OpenAI API key)")
        
        logger.info("Completed planning document processing pipeline")
        return True


def main():
    # Parse command-line arguments
    import argparse
    
    parser = argparse.ArgumentParser(description="Process LA planning documents and link to zoning data")
    parser.add_argument("--docs-dir", default="public/planningDocs", help="Directory containing planning PDFs")
    parser.add_argument("--zoning-geojson", default="public/optimized_zoning/zoning_medium_detail.geojson", 
                      help="Path to zoning GeoJSON file")
    parser.add_argument("--output-dir", default="public/processed_planning_docs", 
                      help="Directory to save processed results")
    
    args = parser.parse_args()
    
    # Run the processor
    processor = PlanningDocProcessor(
        docs_dir=args.docs_dir,
        zoning_geojson_path=args.zoning_geojson,
        output_dir=args.output_dir
    )
    
    processor.process_all()


if __name__ == "__main__":
    main() 