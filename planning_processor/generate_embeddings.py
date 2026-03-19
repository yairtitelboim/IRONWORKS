#!/usr/bin/env python3
"""
Document Embedding Generator Module

This module generates high-quality embeddings for planning documents
to enable semantic search and retrieval.
"""

import argparse
import json
import os
import sys
import logging
import time
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
import re

# Import embedding libraries
try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    from sentence_transformers import SentenceTransformer
    HAVE_EMBEDDINGS = True
except ImportError:
    HAVE_EMBEDDINGS = False
    print("Warning: Embedding libraries not found.")
    print("For embeddings functionality, install torch, transformers, and sentence-transformers.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global embedding model
EMBEDDING_MODEL = None
TOKENIZER = None

def setup_embedding_model(model_name: str = "intfloat/e5-large"):
    """Set up the embedding model."""
    global EMBEDDING_MODEL, TOKENIZER
    
    if not HAVE_EMBEDDINGS:
        logger.error("Embedding libraries not installed")
        return False
        
    if EMBEDDING_MODEL is None:
        try:
            logger.info(f"Loading embedding model: {model_name}")
            
            # Choose approach based on model name
            if "e5" in model_name:
                # For E5 models
                TOKENIZER = AutoTokenizer.from_pretrained(model_name)
                EMBEDDING_MODEL = AutoModel.from_pretrained(model_name)
                
                # Check if CUDA is available and move model to GPU
                if torch.cuda.is_available():
                    logger.info("Using GPU for embeddings")
                    EMBEDDING_MODEL = EMBEDDING_MODEL.to("cuda")
            else:
                # For sentence-transformers models
                EMBEDDING_MODEL = SentenceTransformer(model_name)
                if torch.cuda.is_available():
                    EMBEDDING_MODEL = EMBEDDING_MODEL.to("cuda")
            
            logger.info("Embedding model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading embedding model: {e}")
            EMBEDDING_MODEL = None
            TOKENIZER = None
            return False
    
    return True

def get_e5_embedding(text: str) -> Optional[np.ndarray]:
    """Generate embeddings using E5 models."""
    if not HAVE_EMBEDDINGS or EMBEDDING_MODEL is None or TOKENIZER is None:
        return None
    
    # Truncate text if too long
    max_length = 512
    text = text[:10000]  # Rough character limit
    
    # Prepare text for E5 models (instruction format)
    text = f"passage: {text}"
    
    try:
        # Tokenize and get model inputs
        inputs = TOKENIZER(
            text, 
            padding=True, 
            truncation=True, 
            max_length=max_length, 
            return_tensors="pt"
        )
        
        # Move inputs to GPU if available
        if torch.cuda.is_available():
            inputs = {k: v.to("cuda") for k, v in inputs.items()}
        
        # Generate embeddings
        with torch.no_grad():
            outputs = EMBEDDING_MODEL(**inputs)
            embeddings = outputs.last_hidden_state[:, 0]  # CLS token
            # Normalize embeddings
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        
        # Move back to CPU and convert to numpy
        embeddings = embeddings.cpu().numpy()
        
        return embeddings[0]  # Return the first embedding
    
    except Exception as e:
        logger.error(f"Error generating E5 embedding: {e}")
        return None

def get_sentence_transformer_embedding(text: str) -> Optional[np.ndarray]:
    """Generate embeddings using sentence-transformers models."""
    if not HAVE_EMBEDDINGS or EMBEDDING_MODEL is None:
        return None
    
    # Truncate text if too long
    text = text[:10000]  # Rough character limit
    
    try:
        # Generate embeddings
        embedding = EMBEDDING_MODEL.encode(text, convert_to_numpy=True)
        return embedding
    
    except Exception as e:
        logger.error(f"Error generating sentence-transformer embedding: {e}")
        return None

def get_embedding(text: str, model_name: str) -> Optional[np.ndarray]:
    """Generate an embedding for the given text."""
    if not text or not text.strip():
        return None
    
    # Choose approach based on model name
    if "e5" in model_name:
        return get_e5_embedding(text)
    else:
        return get_sentence_transformer_embedding(text)

def prepare_chunks_for_embedding(document_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Prepare document chunks for embedding."""
    chunks = []
    
    doc_id = document_data.get("documentId", "unknown")
    doc_title = document_data.get("title", "")
    doc_type = document_data.get("documentType", "")
    
    # Add a chunk for the document summary
    summary = document_data.get("content", {}).get("summary", "")
    if summary:
        chunks.append({
            "documentId": doc_id,
            "chunkId": f"{doc_id}_summary",
            "chunkType": "summary",
            "title": doc_title,
            "text": summary,
            "documentType": doc_type,
            "metadata": {
                "sectionIndex": -1,
                "sectionName": "Summary"
            }
        })
    
    # Add chunks for each section
    sections = document_data.get("content", {}).get("sections", [])
    for i, section in enumerate(sections):
        section_heading = section.get("heading", f"Section {i+1}")
        section_text = section.get("text", "")
        
        if section_text:
            chunks.append({
                "documentId": doc_id,
                "chunkId": f"{doc_id}_section_{i}",
                "chunkType": "section",
                "title": f"{doc_title} - {section_heading}",
                "text": section_text,
                "documentType": doc_type,
                "metadata": {
                    "sectionIndex": i,
                    "sectionName": section_heading
                }
            })
    
    # Add chunks for zoning information
    zoning_info = document_data.get("zoning", [])
    for i, zone in enumerate(zoning_info):
        zone_code = zone.get("zoneCode", "")
        zone_name = zone.get("zoneName", "")
        
        # Concatenate zone information
        zone_text = f"Zone Code: {zone_code}\nZone Name: {zone_name}\n"
        
        # Add allowed uses
        allowed_uses = zone.get("allowedUses", [])
        if allowed_uses:
            zone_text += "Allowed Uses:\n"
            for use in allowed_uses:
                zone_text += f"- {use}\n"
        
        # Add prohibited uses
        prohibited_uses = zone.get("prohibitedUses", [])
        if prohibited_uses:
            zone_text += "Prohibited Uses:\n"
            for use in prohibited_uses:
                zone_text += f"- {use}\n"
        
        # Add development standards
        standards = zone.get("developmentStandards", {})
        if standards:
            zone_text += "Development Standards:\n"
            for key, value in standards.items():
                if isinstance(value, dict):
                    zone_text += f"- {key}:\n"
                    for subkey, subvalue in value.items():
                        if subvalue:
                            zone_text += f"  - {subkey}: {subvalue}\n"
                elif value:
                    zone_text += f"- {key}: {value}\n"
        
        if zone_text:
            chunks.append({
                "documentId": doc_id,
                "chunkId": f"{doc_id}_zone_{i}",
                "chunkType": "zoning",
                "title": f"{doc_title} - Zoning: {zone_code} ({zone_name})",
                "text": zone_text,
                "documentType": doc_type,
                "metadata": {
                    "zoneCode": zone_code,
                    "zoneName": zone_name
                }
            })
    
    # Add chunks for geographic references
    geo_refs = document_data.get("geographicReferences", [])
    for i, ref in enumerate(geo_refs):
        ref_type = ref.get("referenceType", "")
        ref_name = ref.get("name", "")
        ref_id = ref.get("identifier", "")
        
        # Only create chunks for references with substantial information
        if ref_name or ref_id:
            ref_text = f"Reference Type: {ref_type}\nName: {ref_name}\nIdentifier: {ref_id}\n"
            
            # Check if has boundary
            has_boundary = "boundary" in ref
            if has_boundary:
                ref_text += "Geographic boundary information is available for this reference.\n"
            
            chunks.append({
                "documentId": doc_id,
                "chunkId": f"{doc_id}_georef_{i}",
                "chunkType": "geographic_reference",
                "title": f"{doc_title} - Geographic Reference: {ref_name or ref_id}",
                "text": ref_text,
                "documentType": doc_type,
                "metadata": {
                    "referenceType": ref_type,
                    "referenceName": ref_name,
                    "referenceId": ref_id,
                    "hasBoundary": has_boundary
                }
            })
    
    return chunks

def generate_document_embeddings(
    file_path: Path,
    output_dir: Path,
    model_name: str
) -> bool:
    """Generate embeddings for a document."""
    try:
        logger.info(f"Generating embeddings for document: {file_path}")
        
        # Load the geo-referenced document
        with open(file_path, 'r') as f:
            document_data = json.load(f)
        
        # Get document ID
        doc_id = document_data.get("documentId", "unknown")
        
        # Prepare chunks for embedding
        chunks = prepare_chunks_for_embedding(document_data)
        
        if not chunks:
            logger.warning(f"No text chunks found for document {doc_id}")
            return False
        
        logger.info(f"Prepared {len(chunks)} chunks for embedding")
        
        # Generate embeddings for each chunk
        embeddings_data = []
        
        for chunk in chunks:
            text = chunk["text"]
            
            # Generate embedding
            embedding = get_embedding(text, model_name)
            
            if embedding is not None:
                # Create embedding data entry
                embedding_entry = {
                    "chunk": chunk,
                    "embedding": embedding.tolist()  # Convert numpy array to list for JSON serialization
                }
                
                embeddings_data.append(embedding_entry)
        
        # Save embeddings
        output_file = output_dir / f"{doc_id}_embeddings.json"
        
        with open(output_file, 'w') as f:
            json.dump({
                "documentId": doc_id,
                "modelName": model_name,
                "embeddingCount": len(embeddings_data),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "embeddings": embeddings_data
            }, f, indent=2)
        
        logger.info(f"Generated and saved {len(embeddings_data)} embeddings for document {doc_id}")
        return True
    
    except Exception as e:
        logger.error(f"Error generating embeddings for {file_path}: {e}")
        return False

def main():
    """Run the document embedding generator."""
    parser = argparse.ArgumentParser(description="Generate embeddings for planning documents")
    parser.add_argument("--input-dir", required=True, help="Directory containing geo-referenced documents")
    parser.add_argument("--output-dir", required=True, help="Directory to save document embeddings")
    parser.add_argument("--model-name", default="intfloat/e5-large", help="Name of the embedding model to use")
    
    args = parser.parse_args()
    
    # Ensure directories exist
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    model_name = args.model_name
    
    output_dir.mkdir(exist_ok=True, parents=True)
    
    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        sys.exit(1)
    
    # Setup embedding model
    if not HAVE_EMBEDDINGS:
        logger.error("Embedding libraries not installed. Cannot generate embeddings.")
        sys.exit(1)
    
    if not setup_embedding_model(model_name):
        logger.error("Failed to setup embedding model")
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
        if generate_document_embeddings(file_path, output_dir, model_name):
            success_count += 1
    
    logger.info(f"Embedding generation complete. Processed {success_count}/{len(input_files)} documents successfully.")

if __name__ == "__main__":
    main() 