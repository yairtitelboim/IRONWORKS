#!/bin/bash
# Quick script to export only projects (COMMITMENT) in South Central US

cd "$(dirname "$0")"

export TAVILY_API_KEY=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
export PRP=YOUR_PERPLEXITY_API_KEY

echo "📊 Exporting projects (COMMITMENT) from South Central US..."
node export-signals.js html

# Open the most recent export
LATEST=$(ls -t signals_export_*.html | head -1)
if [ -n "$LATEST" ]; then
  echo "✅ Opening: $LATEST"
  open "$LATEST"
else
  echo "❌ No export file found"
fi

