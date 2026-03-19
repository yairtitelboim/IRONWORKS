#!/bin/bash

# Perplexity Gentrification Analysis Query Script (Simple Version)
set -e

# Load environment variables
if [[ -f ".env" ]]; then
  source .env
fi

if [[ -z "$PERPLEXITY_API_KEY" ]]; then
  echo "Error: PERPLEXITY_API_KEY environment variable not set"
  echo "Create .env file with: PERPLEXITY_API_KEY=your_key_here"
  exit 1
fi

# Ensure spatial analysis has been run
if [[ ! -f "./public/gentrification-analysis-prompt.json" ]]; then
  echo "Running gentrification spatial analyzer..."
  node gentrification-spatial-analyzer.js
fi

# Extract the analysis prompt (without jq)
ANALYSIS_PROMPT=$(cat ./public/gentrification-analysis-prompt.json | grep -o '"prompt":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$ANALYSIS_PROMPT" ]]; then
  echo "Error: Could not extract analysis prompt"
  exit 1
fi

echo "Sending gentrification analysis to Perplexity..."

# Query Perplexity with proper JSON handling (without jq)
curl -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"sonar\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are a spatial analysis expert specializing in urban gentrification patterns. Always respond with specific geographic coordinates in GeoJSON format when analyzing urban development scenarios.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"$ANALYSIS_PROMPT\"
      }
    ],
    \"max_tokens\": 2000,
    \"temperature\": 0.3
  }" > perplexity-gentrification-response.json

echo "Analysis completed. Response saved to perplexity-gentrification-response.json"
