#!/usr/bin/env python3
"""
Structured Data Extraction Module

This module processes the extracted document content and transforms it into 
structured data according to a predefined schema, using LLMs for enhanced extraction.
"""

import argparse
import json
import os
import sys
import glob
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import jsonschema
from jsonschema import validate
from dotenv import load_dotenv
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variables
EXTRACTION_MODEL = None
MAX_OPENAI_TOKENS = 2000  # Maximum tokens to use per API call
MAX_API_CALLS_PER_RUN = 10  # Maximum number of API calls per script run
API_CALL_COUNT = 0  # Global counter for API calls
API_TRACKER = None

# Load environment variables from .env file
load_dotenv()

# Try to import API usage tracker
try:
    from planning_processor.api_usage_tracker import get_tracker
    HAVE_TRACKER = True
except ImportError:
    HAVE_TRACKER = False
    print("Warning: API usage tracker not available. API usage will not be tracked.")

# Import LLM utilities if available
try:
    logger.info("Attempting to import LLM libraries...")
    from openai import OpenAI
    logger.info("Successfully imported OpenAI")
    import anthropic
    logger.info("Successfully imported Anthropic")
    from transformers import pipeline
    logger.info("Successfully imported transformers")
    HAVE_LLM = True
    logger.info("Successfully imported all LLM libraries")
except ImportError as e:
    HAVE_LLM = False
    logger.error(f"Failed to import LLM libraries: {str(e)}")
    logger.error(f"Error type: {type(e)}")
    logger.error(f"Error details: {e.__dict__ if hasattr(e, '__dict__') else 'No details'}")
    print("Warning: LLM libraries not found. Will use rule-based extraction only.")
    print("For enhanced extraction, install openai, anthropic, or transformers.")

def load_schema(schema_file: Path) -> Dict[str, Any]:
    """Load and validate the JSON schema for planning documents."""
    try:
        with open(schema_file, 'r') as f:
            schema = json.load(f)
        
        # Basic validation that it's a valid schema
        if not isinstance(schema, dict) or not schema.get('$schema'):
            logger.warning("Schema file may not be a valid JSON Schema")
        
        return schema
    except Exception as e:
        logger.error(f"Error loading schema file: {e}")
        raise

def validate_against_schema(data: Dict[str, Any], schema: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate the extracted data against the schema."""
    try:
        validate(instance=data, schema=schema)
        return True, []
    except jsonschema.exceptions.ValidationError as e:
        # Return validation error messages
        return False, [e.message]

def setup_extraction_model():
    """Set up the extraction model to use."""
    global EXTRACTION_MODEL
    
    logger.info(f"Setting up extraction model. HAVE_LLM: {HAVE_LLM}, EXTRACTION_MODEL: {EXTRACTION_MODEL}")
    
    if HAVE_LLM and EXTRACTION_MODEL is None:
        try:
            # First try OpenAI if API key is available
            openai_key = os.environ.get("OPENAI_KEY", "").strip()
            logger.info(f"OpenAI API key found: {bool(openai_key)}")
            logger.info(f"OpenAI API key length: {len(openai_key) if openai_key else 0}")
            
            if openai_key:
                logger.info("Using OpenAI API for extraction")
                client = OpenAI(
                    api_key=openai_key
                )
                
                # Test the client with a simple API call
                try:
                    test_response = client.chat.completions.create(
                        model="gpt-3.5-turbo",
                        messages=[{"role": "user", "content": "test"}],
                        max_tokens=5
                    )
                    logger.info("OpenAI API test successful")
                    EXTRACTION_MODEL = client
                    logger.info(f"Successfully set up OpenAI extraction model: {type(EXTRACTION_MODEL)}")
                    return EXTRACTION_MODEL
                except Exception as e:
                    logger.error(f"Error during test API call: {str(e)}")
                    logger.error("Falling back to alternative model")
            
            # Then try Anthropic if API key is available
            if os.environ.get("ANTHROPIC_API_KEY"):
                logger.info("Using Anthropic for extraction")
                anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
                anthropic.api_key = anthropic_key
                EXTRACTION_MODEL = anthropic
                logger.info(f"Successfully set up Anthropic extraction model: {type(EXTRACTION_MODEL)}")
                return EXTRACTION_MODEL
            
            # Otherwise use local transformers model
            logger.info("Using local transformers model for extraction")
            model = pipeline(
                "text2text-generation",
                model="google/flan-t5-large",
                max_length=512
            )
            EXTRACTION_MODEL = model
            logger.info(f"Successfully set up transformers extraction model: {type(EXTRACTION_MODEL)}")
            return EXTRACTION_MODEL
                
        except Exception as e:
            logger.error(f"Error setting up extraction model: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__ if hasattr(e, '__dict__') else 'No details'}")
            logger.warning("Falling back to rule-based extraction")
            EXTRACTION_MODEL = None
            return None
    
    return EXTRACTION_MODEL

def extract_with_llm(text: str, doc_type: str, extract_type: str, doc_id: str = "unknown") -> Dict[str, Any]:
    """Extract structured information from text using an LLM."""
    global API_CALL_COUNT, API_TRACKER
    
    if not HAVE_LLM or EXTRACTION_MODEL is None:
        logger.warning("LLM extraction not available")
        return {}
    
    # Check API call limit with global counter
    if API_CALL_COUNT >= MAX_API_CALLS_PER_RUN:
        logger.warning(f"API call limit of {MAX_API_CALLS_PER_RUN} reached. Using rule-based extraction instead.")
        return {}
    
    # Also check with API tracker if available
    if HAVE_TRACKER and API_TRACKER and not API_TRACKER.can_make_api_call():
        logger.warning(f"API call limit reached via tracker. Using rule-based extraction instead.")
        return {}
    
    # Truncate text to avoid excessive token usage - reduce to 3000 chars
    text_for_prompt = text[:3000]  # Limit text to avoid token limits
    
    # Create a simpler schema example based on extraction type
    schema_example = ""
    if extract_type == "zoning":
        schema_example = """{"zoning": [{"zoneCode": "R1", "zoneName": "Single Family Residential", "allowedUses": ["Single-family dwellings"], "prohibitedUses": ["Commercial"], "developmentStandards": {"heightLimit": "35 feet", "farLimit": "0.5"}}]}"""
    elif extract_type == "geographic references":
        schema_example = """{"geographicReferences": [{"referenceType": "zone", "name": "Downtown Commercial District", "identifier": "C-2"}]}"""
    
    # Create a simpler, more focused prompt
    prompt = f"""Extract {extract_type} from this planning document text:

{text_for_prompt}

Return ONLY valid JSON matching this format:
{schema_example}

Return ONLY the JSON, no other text. If no information found, return empty arrays."""

    try:
        if isinstance(EXTRACTION_MODEL, OpenAI):
            # Increment API call counter
            API_CALL_COUNT += 1
            
            # Add delay to prevent rate limiting
            time.sleep(1)
            
            logger.info(f"Making OpenAI API call for {extract_type} extraction...")
            
            try:
                response = EXTRACTION_MODEL.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are an expert in extracting structured data from planning documents. Return only valid JSON matching the specified schema."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    max_tokens=1000,
                    response_format={"type": "json_object"}
                )
                
                # Track API usage if tracker is available
                if hasattr(response, 'usage'):
                    output_tokens = response.usage.completion_tokens
                    input_tokens = response.usage.prompt_tokens
                    
                    if HAVE_TRACKER and API_TRACKER:
                        API_TRACKER.track_api_call(
                            model="gpt-3.5-turbo",
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            document_id=doc_id,
                            processing_stage=f"extract_{extract_type}"
                        )
                        logger.info(f"API usage tracked: {input_tokens} input, {output_tokens} output tokens")
                
                # Get response content
                content = response.choices[0].message.content
                logger.info(f"Received response from OpenAI API: {content[:100]}...")
                
                try:
                    result_json = json.loads(content)
                    
                    # Validate the response has the expected structure
                    if extract_type == "zoning":
                        if "zoning" not in result_json:
                            logger.warning("Response missing 'zoning' key")
                            logger.warning(f"Response content: {content}")
                            return {}
                        if not isinstance(result_json["zoning"], list):
                            logger.warning("'zoning' value is not an array")
                            logger.warning(f"Response content: {content}")
                            return {}
                        return result_json
                    elif extract_type == "geographic references":
                        if "geographicReferences" not in result_json:
                            logger.warning("Response missing 'geographicReferences' key")
                            logger.warning(f"Response content: {content}")
                            return {}
                        if not isinstance(result_json["geographicReferences"], list):
                            logger.warning("'geographicReferences' value is not an array")
                            logger.warning(f"Response content: {content}")
                            return {}
                        return result_json
                    
                    return {}
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON response: {e}")
                    logger.error(f"Response content: {content}")
                    return {}
                
            except Exception as e:
                logger.error(f"OpenAI API call failed: {str(e)}")
                return {}
            
        elif EXTRACTION_MODEL == "anthropic":
            # Similar logic for Anthropic, but using their API format
            API_CALL_COUNT += 1
            
            response = anthropic.Anthropic().messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=1000,
                temperature=0.1,
                system="You are an expert in city planning documents and extract structured information accurately.",
                messages=[{"role": "user", "content": prompt}]
            )
            
            result_text = response.content[0].text
            
            # Track API usage if tracker is available
            if HAVE_TRACKER and API_TRACKER:
                # Claude doesn't provide token counts, so we use estimates
                output_tokens = API_TRACKER.estimate_prompt_tokens(result_text)
                API_TRACKER.track_api_call(
                    model="claude-3-sonnet",
                    input_tokens=estimated_input_tokens,
                    output_tokens=output_tokens,
                    document_id=doc_id,
                    processing_stage=f"extract_{extract_type}"
                )
            
            # Parse the JSON response
            try:
                # Find JSON in the response (may be surrounded by text)
                import re
                json_match = re.search(r'(\{.*\})', result_text, re.DOTALL)
                if json_match:
                    result_json = json.loads(json_match.group(1))
                    return result_json
                else:
                    logger.warning("No valid JSON found in LLM response")
                    return {}
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response")
                return {}
            
        else:  # Using transformers pipeline
            result_text = EXTRACTION_MODEL(prompt)[0]["generated_text"]
            
            # Parse the JSON response
            try:
                # Find JSON in the response (may be surrounded by text)
                import re
                json_match = re.search(r'(\{.*\})', result_text, re.DOTALL)
                if json_match:
                    result_json = json.loads(json_match.group(1))
                    return result_json
                else:
                    logger.warning("No valid JSON found in LLM response")
                    return {}
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response")
                return {}
            
    except Exception as e:
        logger.error(f"Error calling LLM API: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        return {}

def extract_structured_data(
    file_path: Path, 
    output_path: Path,
    schema: Dict[str, Any]
) -> bool:
    """Extract structured data from a document using LLMs and rule-based approaches."""
    try:
        logger.info(f"Processing: {file_path}")
        
        # Load the extracted document content
        with open(file_path, 'r') as f:
            document_data = json.load(f)
        
        # Get basic document information
        doc_id = document_data.get("documentId", "unknown")
        doc_type = document_data.get("documentType", "other")
        
        # Extract text from all sections to use for extraction
        all_text = document_data.get("content", {}).get("summary", "")
        for section in document_data.get("content", {}).get("sections", []):
            all_text += "\n\n" + section.get("heading", "") + "\n" + section.get("text", "")
        
        # Extract structured data for different categories
        
        # 1. Zoning information
        if doc_type in ["zoning_ordinance", "specific_plan", "general_plan"]:
            logger.info(f"Extracting zoning information for {doc_id}")
            zoning_data = extract_with_llm(all_text, doc_type, "zoning", doc_id)
            if "zoning" in zoning_data and len(zoning_data["zoning"]) > 0:
                document_data["zoning"] = zoning_data["zoning"]
                logger.info(f"Successfully extracted {len(zoning_data['zoning'])} zoning entries using LLM")
            else:
                # Fallback to rule-based extraction if LLM failed
                logger.info(f"LLM extraction failed, falling back to rule-based extraction for zoning")
                document_data["zoning"] = extract_zoning_rule_based(all_text)
                logger.info(f"Extracted {len(document_data['zoning'])} zoning entries using rule-based method")
        
        # 2. Geographic references
        logger.info(f"Extracting geographic references for {doc_id}")
        geo_data = extract_with_llm(all_text, doc_type, "geographic references", doc_id)
        if "geographicReferences" in geo_data and len(geo_data["geographicReferences"]) > 0:
            document_data["geographicReferences"] = geo_data["geographicReferences"]
            logger.info(f"Successfully extracted {len(geo_data['geographicReferences'])} geographic references using LLM")
        else:
            # Fallback to rule-based extraction
            logger.info(f"LLM extraction failed, falling back to rule-based extraction for geographic references")
            document_data["geographicReferences"] = extract_geographic_references_rule_based(all_text)
            logger.info(f"Extracted {len(document_data['geographicReferences'])} geographic references using rule-based method")
        
        # Validate against schema
        is_valid, errors = validate_against_schema(document_data, schema)
        if not is_valid:
            logger.warning(f"Schema validation failed for {doc_id}: {errors}")
            document_data["metadata"]["schemaValidation"] = "failed"
            document_data["metadata"]["schemaErrors"] = errors
        else:
            document_data["metadata"]["schemaValidation"] = "passed"
        
        # Add extraction metadata
        document_data["metadata"]["extractionMethod"] = EXTRACTION_MODEL or "rule_based"
        document_data["metadata"]["apiCallsUsed"] = API_CALL_COUNT
        document_data["metadata"]["extractionTimestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        
        # Add API usage information if tracked
        if HAVE_TRACKER and API_TRACKER:
            usage_summary = API_TRACKER.get_usage_summary()
            document_data["metadata"]["apiUsage"] = {
                "totalCalls": usage_summary["call_count"],
                "totalTokens": usage_summary["total_tokens"],
                "estimatedCost": usage_summary["estimated_cost"]
            }
        
        # Save the enriched data
        with open(output_path, 'w') as f:
            json.dump(document_data, f, indent=2)
        
        logger.info(f"Structured data extraction complete for {doc_id}")
        return True
    
    except Exception as e:
        logger.error(f"Error extracting structured data from {file_path}: {e}")
        return False

def extract_zoning_rule_based(text: str) -> List[Dict[str, Any]]:
    """Extract zoning information using rule-based methods."""
    import re
    
    # List of common zone codes and their descriptions
    common_zones = {
        "R1": "Single Family Residential",
        "R2": "Two Family Residential",
        "R3": "Multiple Dwelling",
        "R4": "Multiple Dwelling",
        "C1": "Limited Commercial",
        "C2": "Commercial",
        "M1": "Limited Industrial",
        "M2": "Light Industrial",
        "PF": "Public Facilities",
        "OS": "Open Space"
    }
    
    # Regex patterns for zone codes
    zone_code_pattern = r'\b([RCMPOS][A-Z0-9\-]+)\b'
    
    # Regex pattern for height limits
    height_pattern = r'(?:height|Height)[^\n.]*?(\d+(?:\.\d+)?[ -]*(?:feet|ft|meters|m))'
    
    # Regex pattern for FAR
    far_pattern = r'(?:FAR|Floor Area Ratio|floor area ratio)[^\n.]*?(\d+(?:\.\d+)?)'
    
    # Find all zone codes
    zone_mentions = re.finditer(zone_code_pattern, text)
    zone_data = {}
    
    for match in zone_mentions:
        zone_code = match.group(1)
        if zone_code not in zone_data:
            # Create new zone entry
            zone_data[zone_code] = {
                "zoneCode": zone_code,
                "zoneName": common_zones.get(zone_code, ""),
                "allowedUses": [],
                "prohibitedUses": [],
                "developmentStandards": {
                    "heightLimit": "",
                    "farLimit": "",
                    "setbacks": {
                        "front": "",
                        "side": "",
                        "rear": ""
                    }
                }
            }
            
            # Look for height limit in nearby text
            zone_context = text[max(0, match.start() - 500):min(len(text), match.end() + 500)]
            height_match = re.search(height_pattern, zone_context)
            if height_match:
                zone_data[zone_code]["developmentStandards"]["heightLimit"] = height_match.group(1)
            
            # Look for FAR in nearby text
            far_match = re.search(far_pattern, zone_context)
            if far_match:
                zone_data[zone_code]["developmentStandards"]["farLimit"] = far_match.group(1)
    
    # Convert to list
    return list(zone_data.values())

def extract_geographic_references_rule_based(text: str) -> List[Dict[str, Any]]:
    """Extract geographic references using rule-based methods."""
    import re
    
    # Patterns for different geographic reference types
    patterns = {
        "zone": r'(?:Zone|ZONE|zone)[:\s]+([A-Za-z0-9\-]+)',
        "district": r'(?:District|DISTRICT|district)[:\s]+([A-Za-z0-9\s\-]+)',
        "neighborhood": r'(?:Neighborhood|NEIGHBORHOOD|neighborhood)[:\s]+([A-Za-z0-9\s\-]+)',
        "street": r'(?:Street|STREET|street|Avenue|AVENUE|avenue|Road|ROAD|road)[:\s]+([A-Za-z0-9\s\-]+)'
    }
    
    references = []
    
    for ref_type, pattern in patterns.items():
        matches = re.finditer(pattern, text)
        for match in matches:
            name = match.group(1).strip()
            if name and len(name) > 2:  # Skip very short matches
                references.append({
                    "referenceType": ref_type,
                    "name": name,
                    "identifier": ""
                })
    
    return references

def main():
    """Run the structured data extraction process."""
    global EXTRACTION_MODEL, MAX_API_CALLS_PER_RUN, API_TRACKER, API_CALL_COUNT
    
    parser = argparse.ArgumentParser(description="Extract structured data from planning documents")
    parser.add_argument("--input-dir", required=True, help="Directory containing extracted document content")
    parser.add_argument("--output-dir", required=True, help="Directory to save structured data")
    parser.add_argument("--schema-file", required=True, help="JSON schema file path")
    parser.add_argument("--max-api-calls", type=int, default=10, help="Maximum API calls to make per run")
    
    args = parser.parse_args()
    
    # Update global API call limit if specified
    if args.max_api_calls:
        MAX_API_CALLS_PER_RUN = args.max_api_calls
        logger.info(f"API call limit set to {MAX_API_CALLS_PER_RUN}")
    
    # Initialize API usage tracker if available
    if HAVE_TRACKER:
        API_TRACKER = get_tracker(args.output_dir, MAX_API_CALLS_PER_RUN)
        logger.info("API usage tracker initialized")
    
    # Ensure directories exist
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    schema_file = Path(args.schema_file)
    
    output_dir.mkdir(exist_ok=True, parents=True)
    
    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        sys.exit(1)
        
    if not schema_file.exists():
        logger.error(f"Schema file does not exist: {schema_file}")
        sys.exit(1)
    
    # Load schema
    schema = load_schema(schema_file)
    
    # Setup extraction model if available
    if HAVE_LLM:
        setup_extraction_model()
    
    # Process all JSON files in the input directory
    input_files = list(input_dir.glob("*.json"))
    
    if not input_files:
        logger.warning(f"No JSON files found in {input_dir}")
        sys.exit(0)
    
    logger.info(f"Found {len(input_files)} documents to process")
    logger.info(f"Using extraction model: {EXTRACTION_MODEL or 'rule-based only'}")
    
    # Process each document
    success_count = 0
    for file_path in input_files:
        output_path = output_dir / file_path.name
        if extract_structured_data(file_path, output_path, schema):
            success_count += 1
            
        # Report on API usage
        logger.info(f"API calls used so far: {API_CALL_COUNT}/{MAX_API_CALLS_PER_RUN}")
        
        # Check if we've hit the API limit
        if API_CALL_COUNT >= MAX_API_CALLS_PER_RUN:
            logger.warning(f"API call limit of {MAX_API_CALLS_PER_RUN} reached. Stopping further API usage.")
            
            # Continue processing remaining documents using rule-based methods only
            temp_model = EXTRACTION_MODEL
            EXTRACTION_MODEL = None
            
            # Process remaining files with rule-based methods
            for remaining_file in input_files[input_files.index(file_path) + 1:]:
                remaining_output_path = output_dir / remaining_file.name
                if extract_structured_data(remaining_file, remaining_output_path, schema):
                    success_count += 1
                    
            # Restore original model setting for consistency
            EXTRACTION_MODEL = temp_model
            break
    
    logger.info(f"Structured data extraction complete. Processed {success_count}/{len(input_files)} documents successfully.")
    logger.info(f"Total API calls used: {API_CALL_COUNT}")
    
    # Print API usage summary if available
    if HAVE_TRACKER and API_TRACKER:
        usage = API_TRACKER.get_usage_summary()
        logger.info(f"API Usage Summary:")
        logger.info(f"Total calls: {usage['call_count']}")
        logger.info(f"Total tokens: {usage['total_tokens']}")
        logger.info(f"Estimated cost: ${usage['estimated_cost']:.5f}")

if __name__ == "__main__":
    main() 
    main() 