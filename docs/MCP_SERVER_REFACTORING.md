# MCP Server Refactoring - PA Sites Support

## Overview

This document describes the refactoring of the MCP search endpoint in `server.js` to use `ncPowerSites.js` as the single source of truth for facility configuration, with specific improvements for Pennsylvania nuclear sites (Three Mile Island and Susquehanna).

## Problems Identified

### 1. **Hardcoded Duplication**
- Facility mappings were hardcoded in `server.js` (lines 552-569, 650-667)
- Duplicated data from `ncPowerSites.js` config file
- Comment on line 547 indicated this needed refactoring: "For now, we'll use a simple lookup - in production, import the module properly"

### 2. **Incomplete Name Matching**
- Missing variations for PA sites:
  - "tmi" → `three_mile_island_pa`
  - "three mile island nuclear" → `three_mile_island_pa`
  - "susquehanna steam electric" → `susquehanna_nuclear_pa`

### 3. **Maintenance Burden**
- Adding new facilities required updating multiple places
- Risk of data inconsistency between config and server

## Solution

### Refactored Architecture

1. **Dynamic Config Loading**
   - Uses `await import()` to load ES module config in CommonJS context
   - Falls back to minimal hardcoded config if import fails (ensures PA sites always work)
   - Caches config after first load

2. **Dynamic Map Building**
   - `buildFacilityMaps()` function creates lookup tables from config
   - Generates name variations automatically from `name`, `shortName`, and `key`
   - Adds special handling for PA sites with common variations

3. **Improved Name Matching**
   - Supports exact matches, partial matches, and word-based matching
   - Better error messages with suggestions for PA sites

## Code Changes

### New Helper Functions

```javascript
// Load facility configuration from ncPowerSites.js
async function loadFacilityConfig() {
  // Tries dynamic import, falls back to minimal hardcoded config
}

// Build facility lookup maps from config
function buildFacilityMaps(sites) {
  // Creates facilityDataPaths, facilityCoords, and nameToKey mappings
  // Includes special handling for PA sites
}
```

### Updated Endpoint

The `/api/mcp/search` endpoint now:
1. Loads config using `loadFacilityConfig()`
2. Builds maps using `buildFacilityMaps()`
3. Uses improved name matching logic
4. Provides better error messages with PA site suggestions

## PA Sites Support

### Three Mile Island (`three_mile_island_pa`)
- **Name Variations Supported:**
  - "three mile island"
  - "three mile"
  - "tmi"
  - "three mile island nuclear"
  - Full name: "Three Mile Island Nuclear Plant"
  - Short name: "Three Mile Island"

- **Data Path:** `/osm/pa_nuclear_tmi.json`
- **Coordinates:** `{ lat: 40.1500, lng: -76.7300 }`

### Susquehanna (`susquehanna_nuclear_pa`)
- **Name Variations Supported:**
  - "susquehanna"
  - "susquehanna nuclear"
  - "susquehanna steam"
  - "susquehanna steam electric"
  - Full name: "Susquehanna Steam Electric Station"
  - Short name: "Susquehanna Nuclear"

- **Data Path:** `/osm/pa_nuclear_susquehanna.json`
- **Coordinates:** `{ lat: 41.1000, lng: -76.1500 }`

## Testing

### Test Queries

1. **Exact Key:**
   ```json
   { "facilityKey": "three_mile_island_pa" }
   ```

2. **Name Variations:**
   ```json
   { "facilityName": "tmi" }
   { "facilityName": "three mile island" }
   { "facilityName": "susquehanna" }
   { "facilityName": "susquehanna nuclear" }
   ```

3. **Natural Language (via MCPChatPanel):**
   - "substations near Three Mile Island"
   - "water infrastructure near Susquehanna"
   - "transmission lines near TMI"

### Expected Behavior

- ✅ All name variations resolve to correct facility key
- ✅ Coordinates come from config (not hardcoded)
- ✅ Data paths come from config
- ✅ Error messages suggest PA site names if query fails
- ✅ Fallback config ensures PA sites work even if import fails

## Benefits

1. **Single Source of Truth**
   - All facility data comes from `ncPowerSites.js`
   - No duplication between config and server

2. **Easier Maintenance**
   - Add new facilities by updating `ncPowerSites.js` only
   - Server automatically picks up changes

3. **Better PA Site Support**
   - More name variations supported
   - Better error messages
   - Guaranteed to work even if import fails

4. **Future-Proof**
   - Easy to extend for more facilities
   - Config-driven approach scales well

## Migration Notes

- **Backward Compatible:** Existing queries continue to work
- **No Breaking Changes:** API contract unchanged
- **Performance:** Config cached after first load (minimal overhead)

## Next Steps

1. ✅ Refactor server.js to use config
2. ✅ Add PA site name variations
3. ⏳ Test with actual OSM data files
4. ⏳ Update MCPChatPanel quick actions if needed
5. ⏳ Document in MCP_TESTING_GUIDE.md

## Related Files

- `server.js` - MCP search endpoint (refactored)
- `src/config/ncPowerSites.js` - Facility configuration (source of truth)
- `src/components/Map/components/MCPChatPanel.jsx` - Frontend search UI
- `src/components/Map/components/MCPSearchResults.jsx` - Map visualization
- `src/mcp/queryParser.js` - Natural language query parsing

