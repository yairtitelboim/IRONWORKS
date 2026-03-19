# Importance Tier Color Variation Diagnosis

## Problem
All markers appear in the same super bright color, despite having different importance tiers in the data.

## Investigation Results

### Data Analysis (`analyze_importance_tiers.py`)
- **TMI Cache**: 50.1% medium, 38.4% high, 11.5% critical
- **Susquehanna Cache**: 72.1% medium, 17.3% high, 10.5% critical
- ✅ OSM script correctly sets `strategic_tier` in cache files
- ❌ Cache files don't have `importance_tier` (expected - set at runtime by server)

### Code Flow
1. **OSM Script** (`pa_nuclear_datacenter_osm.py`):
   - Sets `strategic_score` (0-100)
   - Sets `strategic_tier` ("critical", "high", "medium", "low")
   - Stores in `feature.properties.strategic_tier`

2. **Server** (`server.js`):
   - Reads `props.strategic_tier` from cache
   - Should set `feature.properties.importance_tier = featureProps.strategic_tier`
   - Sorts by `importance` (descending)
   - Limits to top 200 features

3. **Frontend** (`MCPSearchResults.jsx`):
   - Reads `props.importance_tier || props.strategic_tier || 'medium'`
   - Maps tier to color:
     - `critical` → brightest color (#e9d5ff purple, #67e8f9 cyan)
     - `high` → bright color (#c084fc purple, #22d3ee cyan)
     - `medium` → base color (#8b5cf6 purple, #06b6d4 cyan)
     - `low` → darker color (#6b21a8 purple, #0891b2 cyan)

## Root Cause Hypothesis

**Most Likely**: After sorting by importance and limiting to top 200, most returned features are "critical" or "high" tier, making them all appear bright.

**Alternative**: Server isn't correctly reading `strategic_tier` from cache, or frontend isn't reading `importance_tier` correctly.

## Solution

1. **Verify server is setting `importance_tier` correctly** - Added debug logging
2. **Check if top 200 features are all same tier** - Need to test API response
3. **If all top features are same tier**: Adjust scoring to create more variation, or increase limit to include more medium-tier features

## Next Steps

1. Run server and test API response with `test_api_response.py`
2. Check server console logs for tier distribution
3. If all top features are same tier, adjust importance scoring to create more variation



