#!/usr/bin/env python3
"""
Search Index Creator Module

This module creates a searchable index from document embeddings and
builds an integration file for the frontend map interface.
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_embedding_files(embeddings_dir: Path) -> List[Dict[str, Any]]:
    """Load all embedding files from the directory."""
    embedding_files = list(embeddings_dir.glob("*_embeddings.json"))
    
    if not embedding_files:
        logger.warning(f"No embedding files found in {embeddings_dir}")
        return []
    
    all_embeddings = []
    
    for file_path in embedding_files:
        try:
            with open(file_path, 'r') as f:
                embedding_data = json.load(f)
                all_embeddings.append(embedding_data)
                logger.info(f"Loaded embeddings for document: {embedding_data.get('documentId')}")
        except Exception as e:
            logger.error(f"Error loading embedding file {file_path}: {e}")
    
    return all_embeddings

def load_structured_data_files(structured_data_dir: Path) -> Dict[str, Dict[str, Any]]:
    """Load all structured data files from the directory."""
    data_files = list(structured_data_dir.glob("*.json"))
    
    if not data_files:
        logger.warning(f"No structured data files found in {structured_data_dir}")
        return {}
    
    structured_data = {}
    
    for file_path in data_files:
        try:
            with open(file_path, 'r') as f:
                document_data = json.load(f)
                doc_id = document_data.get("documentId")
                if doc_id:
                    structured_data[doc_id] = document_data
                    logger.info(f"Loaded structured data for document: {doc_id}")
        except Exception as e:
            logger.error(f"Error loading structured data file {file_path}: {e}")
    
    return structured_data

def create_vector_index(all_embeddings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Create a simple vector index from the embeddings."""
    vector_index = {
        "metadata": {
            "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "documentCount": len(all_embeddings),
            "chunkCount": sum(data.get("embeddingCount", 0) for data in all_embeddings),
            "dimensions": None  # Will be set when processing embeddings
        },
        "documents": {},
        "chunks": []
    }
    
    # Process each document's embeddings
    for doc_data in all_embeddings:
        doc_id = doc_data.get("documentId")
        model_name = doc_data.get("modelName", "unknown")
        embeddings_list = doc_data.get("embeddings", [])
        
        # Add document metadata to index
        vector_index["documents"][doc_id] = {
            "documentId": doc_id,
            "chunkCount": len(embeddings_list),
            "chunkIds": []
        }
        
        # Process each chunk and its embedding
        for i, embedding_entry in enumerate(embeddings_list):
            chunk = embedding_entry.get("chunk", {})
            embedding_vector = embedding_entry.get("embedding", [])
            
            chunk_id = chunk.get("chunkId", f"{doc_id}_chunk_{i}")
            
            # Add chunk ID to document's chunk list
            vector_index["documents"][doc_id]["chunkIds"].append(chunk_id)
            
            # Add chunk to index with its embedding
            vector_index["chunks"].append({
                "chunkId": chunk_id,
                "documentId": doc_id,
                "title": chunk.get("title", ""),
                "text": chunk.get("text", ""),
                "chunkType": chunk.get("chunkType", ""),
                "metadata": chunk.get("metadata", {}),
                "embedding": embedding_vector
            })
            
            # Set dimensions if not set
            if vector_index["metadata"]["dimensions"] is None and embedding_vector:
                vector_index["metadata"]["dimensions"] = len(embedding_vector)
    
    logger.info(f"Created vector index with {len(vector_index['documents'])} documents and {len(vector_index['chunks'])} chunks")
    
    return vector_index

def create_integration_file(
    vector_index: Dict[str, Any],
    structured_data: Dict[str, Dict[str, Any]],
    output_path: Path
) -> bool:
    """Create an integration file for the frontend."""
    try:
        # Create the integration data structure
        integration_data = {
            "metadata": {
                "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "documentCount": len(vector_index["documents"]),
                "vectorDimensions": vector_index["metadata"]["dimensions"]
            },
            "documents": [],
            "geographicReferences": []
        }
        
        # Process each document
        for doc_id, doc_info in vector_index["documents"].items():
            # Get the structured data for this document
            doc_data = structured_data.get(doc_id, {})
            
            # Create document entry
            doc_entry = {
                "documentId": doc_id,
                "title": doc_data.get("title", f"Document {doc_id}"),
                "documentType": doc_data.get("documentType", "other"),
                "documentDate": doc_data.get("documentDate", ""),
                "chunkCount": doc_info.get("chunkCount", 0),
                "summary": doc_data.get("content", {}).get("summary", "No summary available")
            }
            
            integration_data["documents"].append(doc_entry)
            
            # Process geographic references
            for geo_ref in doc_data.get("geographicReferences", []):
                # Only include references with boundaries
                if "boundary" in geo_ref:
                    geo_entry = {
                        "documentId": doc_id,
                        "referenceType": geo_ref.get("referenceType", ""),
                        "name": geo_ref.get("name", ""),
                        "identifier": geo_ref.get("identifier", ""),
                        "boundary": geo_ref["boundary"]
                    }
                    
                    integration_data["geographicReferences"].append(geo_entry)
        
        # Write the integration file
        with open(output_path, 'w') as f:
            json.dump(integration_data, f, indent=2)
        
        logger.info(f"Created integration file at {output_path}")
        logger.info(f"Integration file contains {len(integration_data['documents'])} documents and {len(integration_data['geographicReferences'])} geographic references")
        
        return True
    
    except Exception as e:
        logger.error(f"Error creating integration file: {e}")
        return False

def save_vector_index(vector_index: Dict[str, Any], output_dir: Path) -> bool:
    """Save the vector index to a file."""
    try:
        index_path = output_dir / "planning_vector_index.json"
        
        with open(index_path, 'w') as f:
            json.dump(vector_index, f, indent=2)
        
        logger.info(f"Saved vector index to {index_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error saving vector index: {e}")
        return False

def main():
    """Run the search index creator."""
    parser = argparse.ArgumentParser(description="Create search index and integration file")
    parser.add_argument("--embeddings-dir", required=True, help="Directory containing document embeddings")
    parser.add_argument("--structured-data-dir", required=True, help="Directory containing structured document data")
    parser.add_argument("--output-dir", required=True, help="Directory to save the index and integration file")
    parser.add_argument("--integration-file", required=True, help="Path for the integration file")
    
    args = parser.parse_args()
    
    # Ensure directories exist
    embeddings_dir = Path(args.embeddings_dir)
    structured_data_dir = Path(args.structured_data_dir)
    output_dir = Path(args.output_dir)
    integration_file = Path(args.integration_file)
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Ensure path to integration file exists
    integration_file.parent.mkdir(exist_ok=True, parents=True)
    
    if not embeddings_dir.exists():
        logger.error(f"Embeddings directory does not exist: {embeddings_dir}")
        sys.exit(1)
    
    if not structured_data_dir.exists():
        logger.error(f"Structured data directory does not exist: {structured_data_dir}")
        sys.exit(1)
    
    # Load embedding files
    logger.info(f"Loading embeddings from {embeddings_dir}")
    all_embeddings = load_embedding_files(embeddings_dir)
    
    if not all_embeddings:
        logger.error("No embedding data found. Cannot create search index.")
        sys.exit(1)
    
    # Load structured data files
    logger.info(f"Loading structured data from {structured_data_dir}")
    structured_data = load_structured_data_files(structured_data_dir)
    
    if not structured_data:
        logger.warning("No structured data found. Integration file will have limited information.")
    
    # Create vector index
    logger.info("Creating vector index")
    vector_index = create_vector_index(all_embeddings)
    
    # Save vector index
    if not save_vector_index(vector_index, output_dir):
        logger.error("Failed to save vector index")
        sys.exit(1)
    
    # Create integration file
    logger.info("Creating integration file")
    if not create_integration_file(vector_index, structured_data, integration_file):
        logger.error("Failed to create integration file")
        sys.exit(1)
    
    logger.info("Search index creation complete")

if __name__ == "__main__":
    main() 