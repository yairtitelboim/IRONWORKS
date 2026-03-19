# MCP Flow Diagram - PA Sites (Three Mile Island & Susquehanna)

## Overview

The MCP (Map Chat Panel) system allows users to search for POWER and WATER infrastructure around Pennsylvania nuclear sites using natural language queries. Here's how it works:

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                             │
│  MCPChatPanel.jsx - Quick Actions                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Three Mile Island Section                                │  │
│  │  • "Substations near Three Mile Island" (POWER)          │  │
│  │  • "Water infrastructure near Three Mile Island" (WATER) │  │
│  │  • "Susquehanna River water near Three Mile Island"      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Susquehanna Section                                       │  │
│  │  • "Substations near Susquehanna" (POWER)                │  │
│  │  • "Transmission lines near Susquehanna" (POWER)         │  │
│  │  • "Water infrastructure near Susquehanna" (WATER)       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Click Quick Action
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              QUERY PROCESSING                                    │
│  MCPChatPanel.jsx → handleSubmit()                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. parseQuery(query)                                     │  │
│  │    → src/mcp/queryParser.js                              │  │
│  │    → Extracts: facilityName, facilityKey, radius,        │  │
│  │                category (power/water)                    │  │
│  │                                                           │  │
│  │ 2. Example: "substations near Three Mile Island"         │  │
│  │    → facilityKey: "three_mile_island_pa"                 │  │
│  │    → category: "substation"                              │  │
│  │    → radius: 5000 (default 5km)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ POST /api/mcp/search
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND API (server.js)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Load Facility Config                                  │  │
│  │    → loadFacilityConfig()                                │  │
│  │    → Reads from src/config/ncPowerSites.js               │  │
│  │    → Gets coordinates & dataPath for PA sites            │  │
│  │                                                           │  │
│  │ 2. Load OSM Data File                                    │  │
│  │    → public/osm/pa_nuclear_tmi.json                      │  │
│  │    → public/osm/pa_nuclear_susquehanna.json              │  │
│  │    → Contains GeoJSON features (substations, lines, etc) │  │
│  │                                                           │  │
│  │ 3. Filter by Category & Distance                         │  │
│  │    → Filters features within radius                      │  │
│  │    → Matches category (power/water)                      │  │
│  │    → Adds distance_m property to each feature            │  │
│  │                                                           │  │
│  │ 4. Return GeoJSON                                        │  │
│  │    → { features: [...], summary: {...} }                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ JSON Response
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND - EVENT BUS                                │
│  MCPChatPanel.jsx → handleSubmit() (continued)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Store Response                                        │  │
│  │    → setQuickActionResponses()                          │  │
│  │    → Shows answer in expanded Quick Action               │  │
│  │                                                           │  │
│  │ 2. Emit to Map                                           │  │
│  │    → window.mapEventBus.emit('mcp:searchResults', {...})│  │
│  │    → Contains: query, parsed, results (GeoJSON)         │  │
│  │                                                           │  │
│  │ 3. Emit to AI Display                                    │  │
│  │    → window.mapEventBus.emit('mcp:displayResults', {...})│  │
│  │    → Contains: formatted text, table data, citations     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Event: 'mcp:searchResults'
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              MAP VISUALIZATION                                   │
│  MCPSearchResults.jsx → useEffect()                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Listen for Results                                    │  │
│  │    → window.mapEventBus.on('mcp:searchResults', ...)     │  │
│  │                                                           │  │
│  │ 2. Cleanup Previous Markers                              │  │
│  │    → cleanup() - removes old MCP markers                 │  │
│  │    → Preserves OSM markers (separate system)             │  │
│  │                                                           │  │
│  │ 3. Add Radius Circle                                     │  │
│  │    → addRadiusCircle()                                   │  │
│  │    → Shows search area on map                            │  │
│  │                                                           │  │
│  │ 4. Add Markers (up to 20 with popups)                   │  │
│  │    → addMarker() - for first 20 features                 │  │
│  │    → addMarkerWithoutPopup() - for remaining            │  │
│  │    → Color: Purple (#8b5cf6) for POWER                   │  │
│  │    → Color: Cyan (#06b6d4) for WATER                    │  │
│  │                                                           │  │
│  │ 5. Add Halo Effects                                     │  │
│  │    → addHaloEffect() - animated circles around markers   │  │
│  │    → Color matches marker (purple/cyan)                  │  │
│  │                                                           │  │
│  │ 6. Auto-Fit Map                                          │  │
│  │    → map.fitBounds() - zooms to show all results         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Event: 'mcp:displayResults'
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI RESPONSE DISPLAY                                 │
│  AIResponseDisplayRefactored.jsx                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Listen for Results                                    │  │
│  │    → window.mapEventBus.on('mcp:displayResults', ...)    │  │
│  │                                                           │  │
│  │ 2. Display Formatted Text                                │  │
│  │    → Shows natural language summary                      │  │
│  │    → Includes Perplexity AI answer (if available)       │  │
│  │                                                           │  │
│  │ 3. Display Table                                         │  │
│  │    → Shows features in sortable table                   │  │
│  │    → Clickable rows zoom to markers                      │  │
│  │                                                           │  │
│  │ 4. Show Citations                                        │  │
│  │    → Displays Perplexity citations                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## File Locations & Responsibilities

### 1. **Quick Actions UI**
**File:** `src/components/Map/components/MCPChatPanel.jsx`
- **Lines 1430-1485:** Three Mile Island Quick Actions
- **Lines 1488-1582:** Susquehanna Quick Actions
- **Function:** `renderQuickActionButton()` (line 250)
- **Function:** `handleSubmit()` (line 708)

**What it does:**
- Renders clickable Quick Action buttons
- Handles click → sets query → submits form
- Stores responses for display in expanded view
- Emits events to map via `window.mapEventBus`

### 2. **Query Parsing**
**File:** `src/mcp/queryParser.js`
- **Function:** `parseQuery(query)` (line 17)
- **Function:** `getFacilityByNameOrKey()` (line 126)

**What it does:**
- Parses natural language: "substations near Three Mile Island"
- Extracts facility key, category, radius
- Matches against `NC_POWER_SITES` config

### 3. **Backend API**
**File:** `server.js`
- **Endpoint:** `POST /api/mcp/search` (line 519)
- **Function:** `loadFacilityConfig()` (top of file)
- **Function:** `buildFacilityMaps()` (top of file)

**What it does:**
- Loads facility config from `ncPowerSites.js`
- Loads OSM GeoJSON files from `public/osm/`
- Filters features by category and distance
- Returns GeoJSON with filtered features

### 4. **Map Visualization**
**File:** `src/components/Map/components/MCPSearchResults.jsx`
- **Function:** `useEffect()` listener (line 213)
- **Function:** `handleSearchResults()` (line 216)
- **Function:** `addMarker()` (line 1013)
- **Function:** `addHaloEffect()` (line 599)
- **Function:** `addRadiusCircle()` (line 519)

**What it does:**
- Listens for `mcp:searchResults` event
- Cleans up previous MCP markers
- Adds markers to map (purple for power, cyan for water)
- Adds animated halo effects
- Adds radius circle showing search area
- Auto-fits map to show all results

### 5. **AI Response Display**
**File:** `src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx`
- **Function:** Listens for `mcp:displayResults` event

**What it does:**
- Displays formatted text response
- Shows table of features
- Displays Perplexity AI answers and citations

## Data Files

### OSM Cache Files (GeoJSON)
Located in: `public/osm/`

1. **Three Mile Island:**
   - `pa_nuclear_tmi.json`
   - Contains: substations, transmission lines, water infrastructure
   - Generated by: `scripts/osm-tools/pa_nuclear_datacenter_osm.py`

2. **Susquehanna:**
   - `pa_nuclear_susquehanna.json`
   - Contains: substations, transmission lines, water infrastructure
   - Generated by: `scripts/osm-tools/pa_nuclear_datacenter_osm.py`

### Configuration
**File:** `src/config/ncPowerSites.js`
- **Lines 76-86:** Three Mile Island config
- **Lines 88-97:** Susquehanna config

Contains:
- `key`: Facility identifier
- `name`: Full name
- `shortName`: Display name
- `dataPath`: Path to OSM cache file
- `coordinates`: { lat, lng }
- `radiusMeters`: Default search radius

## Event Bus Flow

The system uses `window.mapEventBus` for communication:

1. **MCPChatPanel → MCPSearchResults:**
   ```
   window.mapEventBus.emit('mcp:searchResults', {
     query: "...",
     parsed: { facilityKey, category, radius },
     results: { features: [...], summary: {...} }
   })
   ```

2. **MCPChatPanel → AIResponseDisplayRefactored:**
   ```
   window.mapEventBus.emit('mcp:displayResults', {
     query: "...",
     response: "Found 15 substations...",
     tableData: [...],
     perplexityAnswer: "...",
     citations: [...]
   })
   ```

3. **MCPSearchResults → AIResponseDisplayRefactored:**
   ```
   window.mapEventBus.emit('marker:clicked', {
     id: "...",
     name: "...",
     category: "...",
     coordinates: { lng, lat },
     ...
   })
   ```

## Quick Actions Structure

### Three Mile Island (actionIdx: 0, 1, 2)
- **0:** "Substations near Three Mile Island" (POWER)
- **1:** "Water infrastructure near Three Mile Island" (WATER)
- **2:** "Susquehanna River water near Three Mile Island" (WATER)

### Susquehanna (actionIdx: 3, 4, 5)
- **3:** "Substations near Susquehanna" (POWER)
- **4:** "Transmission lines near Susquehanna" (POWER)
- **5:** "Water infrastructure near Susquehanna" (WATER)

## Category Detection

The system determines POWER vs WATER from:
1. **Query text:** "substations" → POWER, "water" → WATER
2. **Feature properties:** `category`, `power`, `man_made`, `waterway`
3. **Visual distinction:**
   - POWER: Purple markers (#8b5cf6)
   - WATER: Cyan markers (#06b6d4)

## Key Functions to Understand

### For Adding New Quick Actions:
1. Add to `MCPChatPanel.jsx` Quick Actions array (lines 1437-1484 or 1971-2018)
2. Ensure query matches `queryParser.js` patterns
3. Verify facility exists in `ncPowerSites.js`

### For Modifying Marker Display:
1. `MCPSearchResults.jsx` → `addMarker()` (line 1013)
2. `MCPSearchResults.jsx` → `addHaloEffect()` (line 599)
3. Color logic: lines 1045-1055 (determines purple vs cyan)

### For Changing Data Source:
1. Update `ncPowerSites.js` → `dataPath`
2. Ensure OSM cache file exists in `public/osm/`
3. File format: GeoJSON FeatureCollection

## Testing the Flow

1. **Open MCP Panel:** Click purple 🔍 button
2. **Click Quick Action:** e.g., "Substations near Three Mile Island"
3. **Watch Console:** Should see:
   - Query parsing logs
   - API call logs
   - Event emission logs
   - Marker creation logs
4. **Check Map:** Should see:
   - Purple markers (substations)
   - Radius circle
   - Animated halos
   - Auto-zoomed view
5. **Check Panel:** Should see:
   - Expanded answer
   - Statistics graph
   - Clickable feature links

## Common Issues & Solutions

### No Markers Appearing
- Check: OSM cache file exists in `public/osm/`
- Check: `window.mapEventBus` is initialized
- Check: `MCPSearchResults` component is mounted in Map

### Wrong Category Colors
- Check: `addMarker()` color logic (line 1045-1055)
- Check: Feature properties have correct `category` field

### Quick Action Not Working
- Check: Query matches `queryParser.js` patterns
- Check: Facility key exists in `ncPowerSites.js`
- Check: Server is running on port 3001

### Event Bus Not Working
- Check: `window.mapEventBus` is initialized in Map component
- Check: Event names match exactly: `'mcp:searchResults'`
- Check: Components are listening before events are emitted

