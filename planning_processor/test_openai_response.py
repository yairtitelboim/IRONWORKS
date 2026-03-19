#!/usr/bin/env python3
"""
OpenAI Response API Test Script

This script demonstrates how to use OpenAI's Response API for structured data
extraction from planning documents, with proper cost control and output formatting.
"""

import os
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Import API usage tracker
try:
    from planning_processor.api_usage_tracker import get_tracker
    HAVE_TRACKER = True
except ImportError:
    HAVE_TRACKER = False
    logger.warning("API usage tracker not available. API usage will not be tracked.")

# Import OpenAI library
try:
    import openai
    HAVE_OPENAI = True
except ImportError:
    HAVE_OPENAI = False
    logger.error("OpenAI library not installed. Please install it with 'pip install openai>=1.3.0'")

def setup_openai_api():
    """Set up the OpenAI API with credentials from environment variables."""
    if not HAVE_OPENAI:
        return False
    
    openai_api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY2")
    if not openai_api_key:
        logger.error("No OpenAI API key found in environment variables.")
        logger.error("Please set OPENAI_API_KEY or OPENROUTER_API_KEY2 in your .env file.")
        return False
    
    openai.api_key = openai_api_key
    logger.info("OpenAI API key loaded successfully.")
    
    # Check if we're using a direct OpenAI key or OpenRouter
    if os.environ.get("OPENAI_API_KEY"):
        logger.info("Using direct OpenAI API")
        return "openai"
    else:
        logger.info("Using OpenRouter API with OpenAI models")
        return "openrouter"

def extract_document_data(text: str, doc_type: str, 
                          api_type: str, 
                          output_file: Path,
                          tracker=None) -> Dict[str, Any]:
    """
    Extract structured data from a planning document text using OpenAI's Response API.
    
    Args:
        text: The text of the planning document
        doc_type: The type of planning document
        api_type: The API type ('openai' or 'openrouter')
        output_file: File to save the extracted data
        tracker: API usage tracker instance
        
    Returns:
        Dict with the extracted structured data
    """
    if not HAVE_OPENAI:
        logger.error("OpenAI library not available. Cannot extract data.")
        return {}
    
    # Truncate text to avoid excessive token usage
    text_for_prompt = text[:10000]  # Limit text for testing purposes
    
    # Create a schema example for zoning information
    schema_example = """
{
  "documentType": "zoning_ordinance",
  "documentTitle": "Title of the document",
  "effectiveDate": "YYYY-MM-DD",
  "jurisdiction": "Name of city/county",
  "summary": "Brief summary of the document",
  "zoning": [
    {
      "zoneCode": "R1",
      "zoneName": "Single Family Residential",
      "allowedUses": ["Single-family dwellings", "Parks", "Home occupations"],
      "prohibitedUses": ["Commercial", "Industrial", "Multi-family dwellings"],
      "developmentStandards": {
        "heightLimit": "35 feet",
        "farLimit": "0.5",
        "setbacks": {
          "front": "20 feet",
          "side": "5 feet",
          "rear": "15 feet"
        }
      }
    }
  ],
  "geographicReferences": [
    {
      "referenceType": "zone",
      "name": "Downtown Commercial District",
      "identifier": "C-2"
    },
    {
      "referenceType": "neighborhood",
      "name": "Harbor Hills",
      "identifier": ""
    }
  ]
}
"""
    
    # Create a prompt for information extraction
    prompt = f"""
You are an expert in urban planning and zoning regulations. Extract structured information from the following planning document of type "{doc_type}".

DOCUMENT TEXT:
{text_for_prompt}

INSTRUCTIONS:
- Extract ALL structured information from the text
- Follow the exact schema format provided below
- Include the document type, title, and jurisdiction if present
- Extract all zoning information including codes, allowed uses, and development standards
- Extract any geographic references like districts or neighborhoods
- Do not include any information that is not present in the document
- If information is not found, omit those fields rather than making up data
- Ensure your JSON response is valid and properly formatted

SCHEMA FORMAT:
{schema_example}

Return only valid JSON in the format shown above. Do not include any explanations or text outside the JSON structure.
"""
    
    # Estimate prompt tokens if tracker is available
    estimated_input_tokens = 0
    if HAVE_TRACKER and tracker:
        estimated_input_tokens = tracker.estimate_prompt_tokens(prompt)
        logger.info(f"Estimated prompt tokens: {estimated_input_tokens}")
    
    start_time = time.time()
    try:
        # Use the OpenAI Response API for structured JSON output
        response = openai.chat.completions.create(
            model="gpt-4o" if api_type == "openai" else "gpt-3.5-turbo",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are an expert in city planning documents and extract structured information accurately."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        
        elapsed_time = time.time() - start_time
        logger.info(f"API response received in {elapsed_time:.2f} seconds")
        
        # Track API usage if tracker is available
        if HAVE_TRACKER and tracker:
            output_tokens = response.usage.completion_tokens if hasattr(response, 'usage') else 0
            input_tokens = response.usage.prompt_tokens if hasattr(response, 'usage') else estimated_input_tokens
            model_name = "gpt-4o" if api_type == "openai" else "gpt-4o-mini"
            
            tracker.track_api_call(
                model=model_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                document_id="test_document",
                processing_stage="test_extraction"
            )
            logger.info(f"API usage tracked: {input_tokens} input, {output_tokens} output tokens")
        
        # Parse the JSON response
        result_json = json.loads(response.choices[0].message.content)
        
        # Save the result to a file
        with open(output_file, 'w') as f:
            json.dump(result_json, f, indent=2)
        
        logger.info(f"Extracted data saved to {output_file}")
        return result_json
        
    except Exception as e:
        logger.error(f"Error using OpenAI Response API: {e}")
        return {}

def main():
    """Run the test script."""
    parser = argparse.ArgumentParser(description="Test OpenAI Response API for document extraction")
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
    
    # Set up the OpenAI API
    api_type = setup_openai_api()
    if not api_type:
        logger.error("Failed to set up OpenAI API. Exiting.")
        return
    
    # Initialize API usage tracker if available
    tracker = None
    if HAVE_TRACKER:
        tracker = get_tracker(args.output_dir, 5)  # Allow max 5 API calls for testing
        logger.info("API usage tracker initialized")
    
    # Extract data from the document
    logger.info(f"Extracting data from document using OpenAI Response API ({api_type})...")
    result = extract_document_data(
        document_text, 
        args.doc_type, 
        api_type, 
        output_file,
        tracker
    )
    
    if result:
        logger.info("Data extraction successful")
        
        # Print a summary of the extracted data
        document_title = result.get("documentTitle", "Unknown title")
        num_zones = len(result.get("zoning", []))
        num_geo_refs = len(result.get("geographicReferences", []))
        
        logger.info("Extraction Summary:")
        logger.info(f"Document: {document_title}")
        logger.info(f"Document Type: {result.get('documentType', 'Unknown')}")
        logger.info(f"Jurisdiction: {result.get('jurisdiction', 'Unknown')}")
        logger.info(f"Zones Extracted: {num_zones}")
        logger.info(f"Geographic References: {num_geo_refs}")
        
        # Print usage summary if available
        if HAVE_TRACKER and tracker:
            usage = tracker.get_usage_summary()
            logger.info(f"API Usage:")
            logger.info(f"API Calls: {usage['call_count']}")
            logger.info(f"Total Tokens: {usage['total_tokens']}")
            logger.info(f"Estimated Cost: ${usage['estimated_cost']:.5f}")
    else:
        logger.error("Data extraction failed")

if __name__ == "__main__":
    main() 