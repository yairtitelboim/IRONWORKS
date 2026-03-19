# MCP Natural Language Infrastructure Search Integration Plan

This document outlines the integration of Arion's Model Context Protocol (MCP) concept to enable natural language infrastructure search queries on the map. The implementation focuses on the highest value-to-complexity use case: **allowing users to ask questions like "Show me all substations within 5km of TSMC Phoenix"** and receiving instant visual responses on the map.

---

## 0. Prerequisites

- Node.js 18+ with npm/yarn for MCP server dependencies.
- Existing OSM infrastructure data cached in `public/osm/*.json` files.
- Map event bus (`window.mapEventBus`) operational for component communication.
- Turf.js installed for geospatial operations (distance, buffer, point-in-polygon).
- Mapbox GL JS map instance accessible via React ref in `BaseCard.jsx` or parent component.

---

## 1. Core Value Proposition

**User Ask**: "I want to query infrastructure near facilities using natural language instead of clicking through layers."

**Solution**: An MCP-powered chat interface that:
1. Parses natural language queries (e.g., "substations near TSMC", "water infrastructure within 10km of Intel").
2. Translates them into spatial operations using existing cached OSM data.
3. Highlights results on the map with markers, halos, and info cards.
4. Returns structured summaries (count, distance, category breakdown).

**Why This Use Case?**
- ✅ **High Value**: Answers real planning questions instantly.
- ✅ **Low Complexity**: Uses existing data and map infrastructure.
- ✅ **Foundation**: Establishes MCP patterns for future advanced queries.
- ✅ **No New Data Pipelines**: Leverages precomputed OSM caches.

---

## 2. MCP Server Architecture

### 2.1 Create MCP Server Module

**File**: `src/mcp/infraSearchServer.js`

**Responsibilities**:
- Expose `searchInfrastructure` tool via MCP protocol.
- Accept parameters: `query` (string), `facilityName` (string), `radius` (number in meters), `category` (optional filter).
- Return GeoJSON FeatureCollection of matching infrastructure.

**Implementation Checklist**:
1. Install MCP dependencies:
   ```bash
   npm install @modelcontextprotocol/sdk zod
   ```
2. Define tool schema using Zod for parameter validation.
3. Implement tool handler that:
   - Loads cached OSM data for relevant sites (e.g., `nc_power_tsmc_phoenix.json`).
   - Filters features by category (e.g., `substation`, `water`, `pipeline`).
   - Calculates distance from facility using Turf.js `distance()`.
   - Returns features within radius sorted by distance.
4. Expose tool via MCP `@modelcontextprotocol/sdk/server/index.js` `Server` class.

> ✅ Result: MCP server can execute infrastructure search queries and return GeoJSON results.

---

## 3. Tool Execution & Map Integration

### 3.1 Create MCP Tool Executor Hook

**File**: `src/hooks/useMCPTools.js`

**Responsibilities**:
- Connect to MCP server (WebSocket or HTTP).
- List available tools on mount.
- Execute tool calls with parameters.
- Emit results via map event bus for visualization.

**Implementation Checklist**:
1. Create React hook that initializes MCP client:
   ```javascript
   const { listTools, callTool } = useMCPTools({ serverUrl: '/api/mcp' });
   ```
2. `callTool(toolName, params)` should:
   - Send request to MCP server.
   - Receive GeoJSON response.
   - Emit `mcp:searchResults` event via `window.mapEventBus`.
3. Handle loading states, errors, and timeouts gracefully.

> ✅ Result: React components can call MCP tools and receive results via event bus.

### 3.2 Add Event Bus Listener in Map Component

**File**: `src/components/Map/components/MCPSearchResults.jsx` (new component)

**Responsibilities**:
- Listen for `mcp:searchResults` event.
- Add result markers to map with custom halos.
- Show popup cards with feature details (name, category, distance).
- Cleanup markers/layers when new query is executed or component unmounts.

**Implementation Checklist**:
1. Create component that:
   - Subscribes to `window.mapEventBus.on('mcp:searchResults', handler)` on mount.
   - Parses GeoJSON from event payload.
   - Adds markers using `new mapboxgl.Marker()` with color-coded pins (match category).
   - Adds circle layer for search radius visualization.
2. Store marker refs for cleanup.
3. Integrate popup cards using existing `PopupCards.jsx` formatters.
4. Auto-fly map to bounding box of results using `map.fitBounds()`.

> ✅ Result: MCP search results automatically appear on map with visual feedback.

---

## 4. Chat Interface UI

### 4.1 Create MCP Chat Panel

**File**: `src/components/Map/components/MCPChatPanel.jsx`

**Design**:
- Slide-in panel (right side, similar to existing tool cards).
- Text input for natural language queries.
- Chat history showing user queries and system responses.
- Quick action buttons: "Substations near TSMC", "Water infra within 10km of Intel".

**Implementation Checklist**:
1. Add state for:
   - `messages` (array of `{ role: 'user' | 'assistant', content: string }`).
   - `isLoading` (boolean).
   - `currentQuery` (string).
2. On submit:
   - Parse query to extract facility name, radius, category using regex or simple NLP.
   - Call `callTool('searchInfrastructure', { facilityName, radius, category })` from `useMCPTools`.
   - Add user message and assistant response to chat history.
3. Style with Tailwind, match existing card aesthetics (glassmorphism, theme colors).
4. Add toggle button in `NestedCircleButton.jsx` (new purple "MCP Search" circle).

> ✅ Result: Users can type queries and see conversational responses with map updates.

### 4.2 Natural Language Parsing

**File**: `src/mcp/queryParser.js`

**Responsibilities**:
- Extract structured parameters from natural language queries.
- Handle variations: "substations near TSMC", "show water infra around Intel within 5km", "pipelines 10 miles from Amkor".

**Implementation Checklist**:
1. Use regex patterns to extract:
   - **Facility names**: Match against known sites from `ncPowerSites.js`.
   - **Radius**: Extract numbers + units (km, miles, meters), convert to meters.
   - **Category**: Match keywords (substation, water, pipeline, tower, line).
2. Fallback to defaults:
   - Radius: 5000m (5km).
   - Category: all (no filter).
3. Return structured object: `{ facilityName, radius, category, confidence }`.

> ✅ Result: Queries like "substations near TSMC" are reliably parsed into tool parameters.

---

## 5. Backend API Route

### 5.1 Create MCP API Endpoint

**File**: `src/pages/api/mcp/search.js` (Next.js) or `server.js` (Express)

**Responsibilities**:
- Receive MCP tool calls via HTTP POST.
- Load OSM data from `public/osm/*.json`.
- Execute spatial queries using Turf.js.
- Return GeoJSON results.

**Implementation Checklist**:
1. Add route handler:
   ```javascript
   POST /api/mcp/search
   Body: { facilityName, radius, category }
   Response: { type: 'FeatureCollection', features: [...] }
   ```
2. Load facility coordinates from `ncPowerSites.js` by name lookup.
3. Load OSM cache for facility (e.g., `tsmc_phoenix` → `public/osm/nc_power_tsmc_phoenix.json`).
4. Filter features:
   - By category if provided (match `properties.power`, `properties.man_made`, etc.).
   - By distance using `turf.distance(facilityPoint, featurePoint)`.
5. Sort by distance, limit to top 50 results.
6. Add `distance_m` property to each feature for display.

> ✅ Result: API reliably returns infrastructure features matching query parameters.

---

## 6. Enhanced Features (Optional Phase 2)

Once core search is working, consider adding:

1. **Multi-Facility Queries**: "Compare substations near TSMC vs Intel" (side-by-side results).
2. **Aggregated Stats**: "Total water demand within 10km of TSMC" (sum capacity from features).
3. **Gap Analysis**: "Where are power infrastructure gaps between TSMC and Amkor?" (spatial clustering).
4. **Export Results**: Download GeoJSON or CSV of search results.
5. **Query History**: Save past queries for quick re-run.

---

## 7. Testing Checklist

### 7.1 Unit Tests
- [ ] `queryParser.js` correctly extracts facility, radius, category from various query phrasings.
- [ ] `/api/mcp/search` returns valid GeoJSON for known facilities.
- [ ] Distance calculations match expected values (spot check with Turf.js).
- [ ] Category filtering correctly includes/excludes features.

### 7.2 Integration Tests
- [ ] Typing "substations near TSMC" triggers search and shows markers.
- [ ] Results highlight on map with correct colors (match category theme).
- [ ] Clicking result marker shows popup with feature details.
- [ ] Search radius circle appears and matches query parameter.
- [ ] Map auto-flies to results bounding box.
- [ ] Starting new search clears previous markers/layers.

### 7.3 Edge Cases
- [ ] Query with unknown facility name returns helpful error message.
- [ ] Query with no results displays "No infrastructure found" message.
- [ ] Very large radius (100km+) is clamped to prevent performance issues.
- [ ] Concurrent queries cancel previous in-flight requests.

### 7.4 User Experience
- [ ] Chat panel loads within 200ms.
- [ ] Search executes within 500ms for typical queries.
- [ ] Results appear smoothly with animation (fade in markers).
- [ ] Error messages are user-friendly (no raw stack traces).
- [ ] Quick action buttons provide helpful query templates.

---

## 8. File Structure Summary

```
src/
├── mcp/
│   ├── infraSearchServer.js      # MCP server definition & tool handlers
│   ├── queryParser.js             # NLP parsing for queries
│   └── mcpClient.js               # MCP client wrapper
├── hooks/
│   └── useMCPTools.js             # React hook for MCP tool execution
├── components/Map/components/
│   ├── MCPChatPanel.jsx           # Chat UI for queries
│   ├── MCPSearchResults.jsx       # Map layer manager for results
│   └── NestedCircleButton.jsx     # Add MCP toggle button
└── pages/api/mcp/
    └── search.js                  # API route for search execution

public/osm/
└── nc_power_*.json                # Existing OSM caches (reused)
```

---

## 9. Success Metrics

After implementation, measure:
- **Query Success Rate**: % of queries that return relevant results.
- **Response Time**: Average time from query to map visualization.
- **User Engagement**: Number of queries per session.
- **Query Types**: Most common categories and facilities searched.

Target: **90%+ success rate**, **<500ms response time**, **3+ queries per engaged session**.

---

## 10. Future Extensions

Once infrastructure search is stable, extend MCP to:
1. **Demand Analysis**: "What's the total water demand within 10km of TSMC?"
2. **Temporal Queries**: "Show water usage trends for TSMC over last 5 years."
3. **Multi-Modal Search**: "Find substations with capacity > 100MW near TSMC."
4. **Comparative Analysis**: "Compare grid density: TSMC vs Intel vs Amkor."

Each extension reuses the same MCP architecture: define new tool, add handler, update UI.

---

## 11. Implementation Phases

### ✅ Phase 1 (MVP) - COMPLETED

**Status**: ✅ **COMPLETE** (2025-01-XX)

**Implemented Components**:
1. ✅ **Query Parser** (`src/mcp/queryParser.js`)
   - Natural language parsing for facility names, radius, and categories
   - Supports queries like "substations near TSMC", "water infrastructure within 10km of Intel"
   - Extracts structured parameters: `{ facilityName, facilityKey, radius, category, confidence }`

2. ✅ **API Route** (`server.js` - `/api/mcp/search`)
   - POST endpoint that accepts `{ facilityName, facilityKey, radius, category }`
   - Loads OSM cache files from `public/osm/*.json`
   - Filters features by category and distance using Turf.js
   - Returns GeoJSON FeatureCollection with distance metadata
   - Handles missing files gracefully

3. ✅ **Chat Panel UI** (`src/components/Map/components/MCPChatPanel.jsx`)
   - Simple text input for natural language queries
   - Quick action buttons for common queries
   - Error handling and loading states
   - Emits results via `window.mapEventBus` event bus

4. ✅ **Map Results Component** (`src/components/Map/components/MCPSearchResults.jsx`)
   - Listens for `mcp:searchResults` events
   - Adds markers to map for each result feature
   - Visualizes search radius with circle layer
   - Auto-fits map bounds to results
   - Popup cards with feature details (name, category, distance)

5. ✅ **UI Integration** (`NestedCircleButton.jsx`)
   - Purple "🔍" button added to nested circle button group
   - Toggles MCP chat panel on/off
   - Integrated into existing button layout

**Files Created**:
- `src/mcp/queryParser.js` - Query parsing logic
- `src/components/Map/components/MCPChatPanel.jsx` - Chat UI
- `src/components/Map/components/MCPSearchResults.jsx` - Map visualization
- Updated `server.js` - Added `/api/mcp/search` endpoint
- Updated `NestedCircleButton.jsx` - Added MCP button
- Updated `src/components/Map/index.jsx` - Integrated MCPSearchResults

**Testing Status**: Ready for manual testing
- [ ] Test query: "substations near TSMC"
- [ ] Test query: "water infrastructure within 10km of Intel"
- [ ] Verify markers appear on map
- [ ] Verify radius circle displays
- [ ] Verify popup cards show correct data
- [ ] Verify map auto-fits to results

### ✅ Phase 2 (Enhanced) - COMPLETED

**Status**: ✅ **COMPLETE** (2025-01-XX)

**Implemented Enhancements**:
1. ✅ **Message History** (`MCPChatPanel.jsx`)
   - Conversation log showing user queries and system responses
   - Scrollable message area with timestamps
   - Error messages displayed in conversation
   - Clear history button

2. ✅ **Summary Statistics** (`MCPChatPanel.jsx`)
   - Real-time statistics display after each search
   - Shows: total results, average/min/max distances
   - Category breakdown with counts
   - Visual category badges

3. ✅ **Enhanced Popup Cards** (`MCPSearchResults.jsx`)
   - More detailed feature information
   - Shows: name, category, distance (km and meters)
   - Additional properties: power, voltage, material, operator, type
   - Better styling with purple theme

4. ✅ **Export Functionality** (`MCPChatPanel.jsx`)
   - Export results as GeoJSON (with metadata)
   - Export results as CSV (spreadsheet-friendly)
   - One-click download buttons in statistics panel
   - Includes query metadata and timestamps

**Files Modified**:
- `src/components/Map/components/MCPChatPanel.jsx` - Added history, stats, export
- `src/components/Map/components/MCPSearchResults.jsx` - Enhanced popups

**Testing Status**: Ready for testing
- [ ] Test message history persistence
- [ ] Test statistics calculation accuracy
- [ ] Test GeoJSON export
- [ ] Test CSV export
- [ ] Test enhanced popup details

**Phase 3 (Production - 2-3 days)**:
- Unit and integration tests
- Performance optimization (cache results, debounce queries)
- Analytics and logging
- Error recovery and retry logic

**Total Estimated Time**: 7-11 days for full production-ready feature.

---

## 12. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| NLP parsing fails for complex queries | Start with simple regex patterns, add LLM fallback later |
| Large datasets cause slow queries | Limit results to 50, add pagination for more |
| Multiple concurrent queries conflict | Cancel in-flight requests, debounce input |
| Users enter invalid facility names | Provide autocomplete dropdown from `ncPowerSites.js` |
| OSM cache missing for a facility | Gracefully fail with message, offer to load on-demand |

---

## 13. Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation.
- **zod**: Schema validation for tool parameters.
- **@turf/turf**: Geospatial operations (distance, buffer, bbox).
- **mapbox-gl**: Marker and layer management (already installed).
- **React 18+**: Hooks for state management (already installed).

Install new dependencies:
```bash
npm install @modelcontextprotocol/sdk zod
```

---

## Conclusion

This plan delivers **immediate value** (natural language infrastructure search) with **minimal complexity** (reuses existing data and UI patterns). It establishes the MCP foundation for future advanced queries while keeping scope manageable and testable.

**Next Steps**: Review plan, approve scope, begin Phase 1 implementation with MCP server setup.

