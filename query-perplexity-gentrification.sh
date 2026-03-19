#!/bin/bash

# Perplexity Gentrification Analysis Query Script
# This script queries Perplexity AI with gentrification analysis data

# Set your Perplexity API key
export PERPLEXITY_API_KEY="YOUR_PERPLEXITY_API_KEY"

# Read and properly escape the gentrification analysis data
GENTRIFICATION_DATA=$(cat gentrification-analysis-geojson.json | jq -c .)

# Create the curl command with proper JSON escaping
curl -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- << EOF | jq '.' > perplexity-gentrification-response.json
{
  "model": "sonar",
  "messages": [
    {
      "role": "system",
      "content": "You are a spatial analysis expert specializing in urban gentrification patterns. Always respond with specific geographic coordinates in GeoJSON format when analyzing urban development scenarios."
    },
    {
      "role": "user",
      "content": $(echo "Analyze the following gentrification risk data for Houston and provide insights on which areas are most vulnerable to displacement when FIFA investment triggers gentrification.\n\nGentrification Analysis Data:\n$GENTRIFICATION_DATA\n\nREQUIRED OUTPUT: Return your analysis as GeoJSON features with specific coordinates for high-risk blocks in THREE DISTINCT AREAS:\n1. DOWNTOWN HOUSTON (around 29.7604, -95.3698)\n2. MIDTOWN HOUSTON (around 29.7400, -95.3800) \n3. EADO (EAST DOWNTOWN) (around 29.7500, -95.3500)\n\nInclude properties: gentrification_risk (0-1), timeline_to_unaffordable (months), displacement_risk_factors (array), investment_cluster_proximity (string), development_momentum_score (0-10), impact_radius_meters (number representing the radius in meters of the gentrification impact zone), and neighborhood_name (string: 'Downtown', 'Midtown', or 'EaDo'). The impact_radius_meters should reflect the actual geographic extent of displacement risk and investment influence. Focus on blocks with gentrification_risk >= 0.8 and provide detailed reasoning for each high-risk area. Ensure you have at least one marker in each of the three distinct neighborhoods." | jq -R -s .)
    }
  ],
  "max_tokens": 2000,
  "temperature": 0.3
}
EOF

echo "✅ Perplexity query completed. Response saved to perplexity-gentrification-response.json"
echo "📊 Analysis focused on gentrification risk patterns in downtown Houston"
echo "🗺️  GeoJSON response ready for map visualization"
