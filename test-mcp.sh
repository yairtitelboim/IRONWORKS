#!/bin/bash

# Quick test script for MCP Infrastructure Search
# This script helps verify the setup before manual testing

echo "🔍 MCP Infrastructure Search - Quick Test"
echo "=========================================="
echo ""

# Check if server is running
echo "1. Checking if server is running on port 3001..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✅ Server is running"
else
    echo "   ❌ Server is NOT running"
    echo "   → Start server with: node server.js"
    exit 1
fi

# Check if OSM data files exist
echo ""
echo "2. Checking OSM data files..."
if [ -f "public/osm/nc_power_tsmc_phoenix.json" ]; then
    echo "   ✅ TSMC Phoenix data file exists"
    FILE_SIZE=$(ls -lh public/osm/nc_power_tsmc_phoenix.json | awk '{print $5}')
    echo "   → File size: $FILE_SIZE"
else
    echo "   ⚠️  TSMC Phoenix data file not found"
fi

# Test API endpoint
echo ""
echo "3. Testing API endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/mcp/search \
  -H "Content-Type: application/json" \
  -d '{
    "facilityKey": "tsmc_phoenix",
    "radius": 5000,
    "category": null
  }')

if echo "$RESPONSE" | grep -q "FeatureCollection"; then
    FEATURE_COUNT=$(echo "$RESPONSE" | grep -o '"features":\[' | wc -l || echo "0")
    echo "   ✅ API endpoint is working"
    echo "   → Response contains FeatureCollection"
else
    echo "   ❌ API endpoint returned error"
    echo "   → Response: $RESPONSE"
fi

echo ""
echo "=========================================="
echo "✅ Setup check complete!"
echo ""
echo "Next steps:"
echo "1. Make sure React app is running: npm start"
echo "2. Open http://localhost:3000 in browser"
echo "3. Click the purple 🔍 button in the nested circle button group"
echo "4. Try query: 'substations near TSMC'"
echo ""

