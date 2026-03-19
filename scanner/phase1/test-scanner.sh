#!/bin/bash
cd "$(dirname "$0")"

export TAVILY_API_KEY=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
export PRP=YOUR_PERPLEXITY_API_KEY

echo "🧪 Testing Scanner Phase 1..."
echo ""

echo "1️⃣ Ingesting signals..."
node scanner-cli.js ingest --query "data center moratorium Texas"
echo ""

echo "2️⃣ Listing CONSTRAINT signals..."
node scanner-cli.js list --lane CONSTRAINT --limit 5
echo ""

echo "3️⃣ Viewing statistics..."
node scanner-cli.js stats
echo ""

echo "✅ Test complete!"
