#!/bin/bash

# Enhanced LA Planning Documents Processing Script
# This script sets up an advanced document processing pipeline for planning documents

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is required but not installed. Please install Python 3 and try again."
    exit 1
fi

# Create a virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate the virtual environment
source venv/bin/activate

# Install enhanced dependencies with version pinning
echo "Installing advanced document processing dependencies..."
pip install -r requirements_planning.txt

# Check if transformers and related models are available
if python3 -c "import transformers" &> /dev/null; then
    echo "✓ Transformer models available"
else
    echo "Installing transformer models for document processing..."
    pip install "transformers>=4.30.0" "sentence-transformers>=2.2.2" "torch>=2.0.0"
fi

# Check if document processing libraries are available
if python3 -c "import unstructured" &> /dev/null; then
    echo "✓ Document processing libraries available"
else
    echo "Installing document processing libraries..."
    pip install "unstructured>=0.10.0" "unstructured[pdf,docx,pptx]>=0.10.0" "layoutparser>=0.3.4" "pdf2image>=1.16.3"
fi

# Check for dotenv and OpenAI libraries
if python3 -c "import dotenv" &> /dev/null; then
    echo "✓ Environment management libraries available"
else
    echo "Installing environment management libraries..."
    pip install "python-dotenv>=1.0.0"
fi

if python3 -c "import openai" &> /dev/null; then
    echo "✓ OpenAI library available"
else
    echo "Installing OpenAI library for Response API..."
    pip install "openai>=1.3.0"
fi

# Load environment variables
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file"
    set -o allexport
    source .env
    set +o allexport
fi

# Create output directories
mkdir -p public/processed_planning_docs
mkdir -p public/processed_planning_docs/extracted_text
mkdir -p public/processed_planning_docs/structured_data
mkdir -p public/processed_planning_docs/geo_referenced
mkdir -p public/processed_planning_docs/embeddings

# Process documents in stages
echo "Starting enhanced document processing pipeline..."

# Parse script arguments
USE_OPENAI="false"
MAX_API_CALLS=5
PROCESS_ALL_STAGES="true"
BATCH_SIZE=3
TEST_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --use-openai)
      USE_OPENAI="true"
      shift
      ;;
    --max-api-calls)
      MAX_API_CALLS="$2"
      shift 2
      ;;
    --stage)
      PROCESS_ALL_STAGES="false"
      STAGE_TO_RUN="$2"
      shift 2
      ;;
    --batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    --test)
      TEST_MODE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./process_planning_docs.sh [--use-openai] [--max-api-calls NUM] [--stage STAGE_NUMBER] [--batch-size BATCH_SIZE] [--test]"
      exit 1
      ;;
  esac
done

# Check if OpenAI API key is available if --use-openai is set
if [[ "$USE_OPENAI" == "true" ]]; then
    if [[ -z "${OPENAI_API_KEY}" && -z "${OPENROUTER_API_KEY2}" ]]; then
        echo "Warning: OpenAI API requested but no API key found in environment variables."
        echo "Will fall back to rule-based extraction or local models."
        USE_OPENAI="false"
    else
        echo "OpenAI Response API enabled for structured data extraction"
        echo "API call limit set to $MAX_API_CALLS calls"
    fi
fi

# Function to run a stage with proper messaging
run_stage() {
    local stage_num=$1
    local stage_name=$2
    local command=$3
    
    if [[ "$PROCESS_ALL_STAGES" == "true" || "$STAGE_TO_RUN" == "$stage_num" ]]; then
        echo "Stage $stage_num/5: $stage_name..."
        eval $command
        if [ $? -ne 0 ]; then
            echo "Error in Stage $stage_num. Check logs for details."
            return 1
        fi
    fi
    return 0
}

# Stage 1: Document Analysis and Extraction
echo "Stage 1/5: Document analysis and text extraction..."

# Get all PDF files
PDF_FILES=(public/planningDocs/*.pdf)
TOTAL_FILES=${#PDF_FILES[@]}
BATCHES=$(( (TOTAL_FILES + BATCH_SIZE - 1) / BATCH_SIZE ))

for ((i=0; i<BATCHES; i++)); do
  START=$((i * BATCH_SIZE))
  END=$((START + BATCH_SIZE - 1))
  if [ $END -ge $TOTAL_FILES ]; then
    END=$((TOTAL_FILES - 1))
  fi
  
  echo "Processing batch $((i+1))/$BATCHES (files $((START+1)) to $((END+1)) of $TOTAL_FILES)"
  
  # Create temporary directory for this batch
  BATCH_DIR="public/planningDocs/batch_$i"
  mkdir -p "$BATCH_DIR"
  
  # Copy files for this batch
  for ((j=START; j<=END; j++)); do
    cp "${PDF_FILES[j]}" "$BATCH_DIR/"
  done
  
  # Process this batch
  STAGE1_CMD="python3 planning_processor/extract_document_content.py \
    --docs-dir $BATCH_DIR \
    --output-dir public/processed_planning_docs/extracted_text \
    --use-vision-model"
  
  echo "Running batch $((i+1)) extraction..."
  eval $STAGE1_CMD
  
  # Clean up batch directory
  rm -rf "$BATCH_DIR"
  
  echo "Batch $((i+1)) complete"
  echo "Waiting 5 seconds before next batch..."
  sleep 5
done

# Stage 2: Structural Analysis and Metadata Extraction
STAGE2_CMD="python3 planning_processor/extract_structured_data.py \
  --input-dir public/processed_planning_docs/extracted_text \
  --output-dir public/processed_planning_docs/structured_data \
  --schema-file planning_processor/schemas/planning_schema.json"

# Add OpenAI API arguments if enabled
if [[ "$USE_OPENAI" == "true" ]]; then
    STAGE2_CMD="$STAGE2_CMD --max-api-calls $MAX_API_CALLS"
fi

run_stage "2" "Extracting structured data and metadata" "$STAGE2_CMD" || exit 1

# Stage 3: Geographic Reference Extraction
STAGE3_CMD="python3 planning_processor/geo_reference_extractor.py \
  --input-dir public/processed_planning_docs/structured_data \
  --zoning-geojson public/optimized_zoning/zoning_medium_detail.geojson \
  --output-dir public/processed_planning_docs/geo_referenced"

run_stage "3" "Extracting and validating geographic references" "$STAGE3_CMD" || exit 1

# Stage 4: Generate Document Embeddings
STAGE4_CMD="python3 planning_processor/generate_embeddings.py \
  --input-dir public/processed_planning_docs/geo_referenced \
  --output-dir public/processed_planning_docs/embeddings \
  --model-name \"intfloat/e5-large\""

run_stage "4" "Generating document embeddings for search and retrieval" "$STAGE4_CMD" || exit 1

# Stage 5: Create Searchable Index and Integration Layer
STAGE5_CMD="python3 planning_processor/create_search_index.py \
  --embeddings-dir public/processed_planning_docs/embeddings \
  --structured-data-dir public/processed_planning_docs/geo_referenced \
  --output-dir public/processed_planning_docs \
  --integration-file public/processed_planning_docs/planning_data_integration.json"

run_stage "5" "Creating searchable index and integration data" "$STAGE5_CMD" || exit 1

# Check if the processing was successful
if [ $? -eq 0 ]; then
    echo "Planning documents processed successfully!"
    echo "Output files are in public/processed_planning_docs/"
    echo "Integration file created at public/processed_planning_docs/planning_data_integration.json"
    
    # Display API usage summary if applicable
    if [[ "$USE_OPENAI" == "true" ]]; then
        if [ -f "public/processed_planning_docs/api_usage_summary.txt" ]; then
            echo "API Usage Summary:"
            cat public/processed_planning_docs/api_usage_summary.txt
        else
            echo "API used for structured data extraction (max calls: $MAX_API_CALLS)"
        fi
    fi
    
    echo "You can now view and query the planning documents in the map interface."
else
    echo "Error processing planning documents. Check the output above for details."
fi

# Deactivate the virtual environment
deactivate 