# Complete System Overview: News Pressure Sensor Implementation

## Executive Summary

This document provides a complete overview of:
1. **All changes made** to implement the News pressure sensor
2. **How the entire system works** end-to-end
3. **Data flow** from ingestion to display
4. **Key differences** between News and ERCOT workflows

---

## Part 1: Complete List of Changes

### 1. Backend: Anchor Extraction (`scanner/phase1/signal-normalizer.js`)

**Added:**
- `extractAnchors(headline, content)` method
  - Extracts **Who**: Company/developer names using regex patterns
  - Extracts **Where**: County/city from location hints
  - Extracts **Asset**: Project name (quoted) or asset type
  - Extracts **Friction Type**: moratorium, lawsuit, zoning, opposition, environmental, permit_denial

**Modified:**
- `normalizeTavilyResult()` now calls `extractAnchors()` for News signals
- Stores anchors in existing database fields:
  - `company_entities` ← who
  - `county`/`city` ← where
  - `asset_type_guess` ← asset
  - (friction type stored in tags via classifier)

**Files Changed:**
- `scanner/phase1/signal-normalizer.js` (added ~70 lines)

---

### 2. Backend: Recurrence Detection (`scanner/phase1/signal-ingester.js`)

**Added:**
- `detectRecurrence(signal)` method
  - Queries database for previous News signals with matching anchors
  - Uses OR logic: matches if ANY anchor matches (who OR where OR asset)
  - Returns count of previous signals
  - Adds `recurrence:X` tag to signal

**Modified:**
- `ingest()` method now calls `detectRecurrence()` after classification
- Only runs for News signals (`source_type === 'TAVILY'`)

**Database Query:**
```sql
SELECT COUNT(*) 
FROM signals
WHERE source_type = 'TAVILY'
  AND signal_id != ?
  AND (company_entities = ? OR county = ? OR asset_type_guess = ?)
```

**Files Changed:**
- `scanner/phase1/signal-ingester.js` (added ~50 lines)

---

### 3. Backend: Friction Type Extraction (`scanner/phase1/signal-classifier.js`)

**Added:**
- `extractFrictionType(text)` method
  - Detects friction types using regex patterns
  - Returns array of friction types found
  - Adds `friction:*` tags to signal

**Modified:**
- `classify()` method now extracts friction types for News signals
  - Adds friction tags: `friction:moratorium`, `friction:lawsuit`, etc.

**Friction Types Detected:**
- `moratorium`: Ban, prohibition, halt
- `lawsuit`: Legal challenge, court filing
- `zoning`: Zoning change, denial, rezoning
- `opposition`: Community pushback, protests
- `environmental`: EPA, emissions, pollution
- `permit_denial`: Permit rejection, appeal

**Files Changed:**
- `scanner/phase1/signal-classifier.js` (added ~25 lines)

---

### 4. Frontend: News Card Display (`src/components/Map/components/ScannerSignalsPanel.jsx`)

**Added:**
- `generateWhySurfaced(signal)` function
  - Generates machine-generated, opinionated explanations
  - Uses ONLY real extracted data (no synthetic data)
  - Examples: "Third data center lawsuit in Brazos County this quarter"
  
- News-specific card rendering:
  - "Why this surfaced" line (at top)
  - Anchors display (Who, Where, Asset)
  - Recurrence badge (color-coded by pressure level)
  - Friction type badges (red badges)
  - Lane + Confidence display

**Modified:**
- Sorting logic: News signals sorted by recurrence count (highest pressure first)
- Card rendering: Different display for News vs ERCOT signals
- Tag filtering: Hides recurrence/friction tags from generic tag list (shown separately)

**Files Changed:**
- `src/components/Map/components/ScannerSignalsPanel.jsx` (added ~150 lines, modified ~30 lines)

---

### 5. Documentation

**Created:**
- `scanner/phase1/NEWS_PRESSURE_SENSOR_IMPLEMENTATION.md` - Implementation details
- `scanner/phase1/COMPLETE_SYSTEM_OVERVIEW.md` - This document

**Files Changed:**
- None (new files only)

---

## Part 2: How The System Works (End-to-End)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  ScannerSignalsPanel.jsx (React Component)                   │
│  - News/ERCOT filter buttons                                 │
│  - Refresh buttons (News, ERCOT)                             │
│  - Signal cards with "Why this surfaced"                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP API Calls
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    EXPRESS SERVER                            │
│  server.js                                                   │
│  - GET /api/scanner/signals (fetch signals)                 │
│  - POST /api/scanner/ingest/news (trigger News ingestion)  │
│  - POST /api/scanner/ingest/ercot (trigger ERCOT ingestion) │
│  - POST /api/scanner/signals/:id/status (mark reviewed)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Module Imports
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌─────────▼────────┐
│  NEWS WORKFLOW │          │ ERCOT WORKFLOW   │
│  (Phase 1)     │          │ (Phase 2)         │
└───────┬────────┘          └─────────┬────────┘
        │                             │
        │                             │
┌───────▼─────────────────────────────▼────────┐
│         SIGNAL PROCESSING PIPELINE           │
│  - Normalizer (extract anchors)              │
│  - Classifier (detect friction, lane)         │
│  - Recurrence Detector (News only)            │
│  - Differ (change detection)                  │
│  - Database (SQLite)                          │
└───────────────────────────────────────────────┘
```

---

### News Workflow (Step-by-Step)

#### Step 1: User Clicks "News" Refresh Button

**Frontend** (`ScannerSignalsPanel.jsx`):
```javascript
handleRefreshNews() {
  // Shows notification: "Starting News ingestion..."
  // POST /api/scanner/ingest/news
  // Body: { query: "data center (moratorium OR lawsuit OR zoning) Texas" }
}
```

#### Step 2: Server Receives Request

**Backend** (`server.js`):
```javascript
POST /api/scanner/ingest/news
  → Creates SignalIngester (Phase 1)
  → Calls ingester.ingest(query, 'TAVILY')
  → Returns 202 (Accepted) immediately (non-blocking)
```

#### Step 3: Tavily API Search

**Tavily Client** (`tavily-client.js`):
```javascript
TavilyClient.search(query, maxResults=10)
  → POST https://api.tavily.com/search
  → Returns array of articles:
     {
       title: "Article headline",
       url: "https://...",
       content: "Article content...",
       published_date: "2024-01-15"
     }
```

#### Step 4: Normalize Results

**Normalizer** (`signal-normalizer.js`):
```javascript
normalizeTavilyResult(tavilyResult, 'TAVILY')
  → Generates signal_id, dedupe_key
  → Calls extractAnchors(headline, content)
     - Extracts: who, where, asset, friction_type
  → Stores in signal:
     - company_entities ← who
     - county/city ← where
     - asset_type_guess ← asset
  → Returns normalized signal
```

**Anchor Extraction Details:**
- **Who**: Regex patterns match "Company Name proposes", "by Company", etc.
- **Where**: Extracts county/city from location hints
- **Asset**: Looks for quoted project names, falls back to asset type guess
- **Friction**: Regex patterns detect moratorium, lawsuit, zoning, etc.

#### Step 5: Change Detection

**Differ** (`signal-differ.js`):
```javascript
differ.diff(newResults, previousSnapshot)
  → Compares by URL (dedupe_key)
  → Returns:
     - newItems: Articles not in previous snapshot
     - changedItems: Articles that exist but changed
     - withdrawnItems: Articles in snapshot but not in new results
```

#### Step 6: Classify Signals

**Classifier** (`signal-classifier.js`):
```javascript
classifier.classify(signal)
  → Checks static content rules
  → Checks change_type rules
  → Checks constraint rules (moratorium, lawsuit, etc.)
  → Checks commitment rules
  → Extracts friction types (for News)
     - Calls extractFrictionType(text)
     - Adds friction:* tags
  → Returns: { lane, event_type, confidence, change_type, tags }
```

#### Step 7: Detect Recurrence (News Only)

**Ingester** (`signal-ingester.js`):
```javascript
detectRecurrence(signal)
  → Queries database:
     SELECT COUNT(*) FROM signals
     WHERE source_type = 'TAVILY'
       AND signal_id != ?
       AND (company_entities = ? OR county = ? OR asset_type_guess = ?)
  → Returns count of previous signals
  → Adds recurrence:X tag
```

#### Step 8: Store Signals

**Database** (`signals-db.js`):
```javascript
db.insertSignal(signal)
  → Stores in SQLite database
  → Fields include:
     - signal_id, headline, raw_text, url
     - company_entities, county, city, asset_type_guess
     - lane, event_type, confidence, tags
     - published_at, ingested_at
```

#### Step 9: Store Snapshot

**Database** (`signals-db.js`):
```javascript
db.insertSnapshot(snapshot)
  → Stores raw Tavily results
  → Used for change detection in next run
```

#### Step 10: Frontend Refreshes

**Frontend** (`ScannerSignalsPanel.jsx`):
```javascript
fetchSignals(selectedSource)
  → GET /api/scanner/signals?source_type=TAVILY
  → Receives array of signals
  → Renders cards with:
     - "Why this surfaced" (generateWhySurfaced)
     - Anchors (Who, Where, Asset)
     - Recurrence badge
     - Friction type badges
     - Lane + Confidence
```

---

### ERCOT Workflow (For Comparison)

#### Step 1: User Clicks "ERCOT" Refresh Button

**Frontend** (`ScannerSignalsPanel.jsx`):
```javascript
handleRefreshErcot() {
  // POST /api/scanner/ingest/ercot
  // Body: { useGisReports: true, downloadFresh: true }
}
```

#### Step 2: Server Receives Request

**Backend** (`server.js`):
```javascript
POST /api/scanner/ingest/ercot
  → Creates ERCOTAdapter (Phase 2)
  → Creates SignalIngesterV2
  → Calls ingester.ingestFromSource('ERCOT')
```

#### Step 3: Download ERCOT Data

**ERCOT Downloader** (`ercot-downloader.js`):
```javascript
ERCOTDownloader.downloadLatestReport()
  → Uses Playwright to navigate to ERCOT website
  → Finds latest XLSX file
  → Downloads and converts to CSV
  → Returns CSV path
```

#### Step 4: Parse ERCOT CSV

**ERCOT Adapter** (`ercot-adapter.js`):
```javascript
ERCOTAdapter.fetch()
  → Reads CSV file
  → Parses rows into RawSignal format
  → Maps fields: queue_id, capacity, fuel_type, status, county, developer
  → Returns array of raw signals
```

#### Step 5: Normalize & Deduplicate

**Normalizer V2** (`signal-normalizer-v2.js`):
```javascript
normalize(rawSignal)
  → Generates signal_id, dedupe_key
  → Fills defaults
```

**Deduplicator** (`signal-deduplicator.js`):
```javascript
deduplicate(signals)
  → Links related signals across sources
  → Removes duplicates
```

#### Step 6: Change Detection

**Differ** (`signal-differ.js`):
```javascript
differ.diff(newSignals, previousSnapshot, 'source_id')
  → Compares by source_id (queue_id)
  → Detects: NEW_ITEM, CHANGED_ITEM, WITHDRAWN
```

#### Step 7: Classify Signals

**Classifier** (`signal-classifier.js`):
```javascript
classifier.classify(signal)
  → ERCOT-specific logic:
     - Auto-classifies as COMMITMENT
     - Sets event_type based on status
     - Sets change_type (NEW, UPDATED, WITHDRAWN)
```

#### Step 8: Store Signals

**Database** (`signals-db.js`):
```javascript
db.insertSignal(signal)
  → Stores ERCOT queue entry
```

#### Step 9: Frontend Displays

**Frontend** (`ScannerSignalsPanel.jsx`):
```javascript
→ Renders ERCOT cards with:
   - "New"/"Updated" badges
   - Capacity, fuel type, status
   - Power scale visualization
   - Developer context
   - County, POI location
```

---

## Part 3: Data Flow Diagram

### News Signal Lifecycle

```
Tavily API Article
    ↓
[1] Normalize
    ├─ Extract anchors (who, where, asset, friction)
    ├─ Generate signal_id, dedupe_key
    └─ Store in signal object
    ↓
[2] Change Detection
    ├─ Compare with previous snapshot
    └─ Mark as NEW/CHANGED/WITHDRAWN
    ↓
[3] Classify
    ├─ Detect friction types
    ├─ Assign lane (CONSTRAINT/COMMITMENT/CONTEXT)
    └─ Set confidence, event_type
    ↓
[4] Recurrence Detection
    ├─ Query database for matching anchors
    └─ Add recurrence:X tag
    ↓
[5] Store in Database
    ├─ Insert signal
    └─ Store snapshot
    ↓
[6] Frontend Display
    ├─ Generate "Why this surfaced"
    ├─ Show anchors, recurrence, friction
    └─ Sort by recurrence (highest first)
```

### ERCOT Signal Lifecycle

```
ERCOT CSV File
    ↓
[1] Download (Playwright)
    └─ Get latest GIS report
    ↓
[2] Parse CSV
    ├─ Read rows
    └─ Map to RawSignal
    ↓
[3] Normalize
    ├─ Generate signal_id, dedupe_key
    └─ Fill defaults
    ↓
[4] Deduplicate
    └─ Link related signals
    ↓
[5] Change Detection
    ├─ Compare by source_id
    └─ Mark as NEW/CHANGED/WITHDRAWN
    ↓
[6] Classify
    ├─ Auto-classify as COMMITMENT
    └─ Set event_type, change_type
    ↓
[7] Store in Database
    └─ Insert signal
    ↓
[8] Frontend Display
    ├─ Show "New"/"Updated" badges
    ├─ Display capacity, developer, location
    └─ Sort by capacity (largest first)
```

---

## Part 4: Key Differences: News vs ERCOT

| Aspect | News (Pressure Sensor) | ERCOT (State Machine) |
|--------|------------------------|----------------------|
| **Data Source** | Tavily API (real-time web search) | ERCOT CSV (monthly GIS reports) |
| **Update Frequency** | On-demand (button click) | On-demand (button click) |
| **Data Structure** | Unstructured (article text) | Structured (CSV rows) |
| **Extraction** | Regex patterns (anchors, friction) | Direct field mapping |
| **Change Detection** | By URL (dedupe_key) | By queue_id (source_id) |
| **Indicators** | Recurrence badge | "New"/"Updated" badges |
| **Sorting** | By recurrence (pressure) | By capacity (size) |
| **Context** | Friction types, recurrence | Developer projects, power scale |
| **Goal** | Early detection of friction | Track what changed |
| **Actionability** | Low (warning system) | High (structured data) |
| **Classification** | CONSTRAINT/COMMITMENT/CONTEXT | Always COMMITMENT |
| **Recurrence** | ✅ Detected and displayed | ❌ Not applicable |
| **"Why surfaced"** | ✅ Machine-generated explanation | ❌ Not shown |

---

## Part 5: Database Schema

### Signals Table

```sql
CREATE TABLE signals (
  signal_id TEXT PRIMARY KEY,
  ingested_at DATETIME,
  published_at DATETIME,
  source_type TEXT,              -- 'TAVILY' or 'ERCOT_QUEUE'
  source_name TEXT,
  url TEXT,
  headline TEXT,
  raw_text TEXT,
  summary_3bullets TEXT,
  tags TEXT,                     -- JSON array: ["friction:lawsuit", "recurrence:3"]
  state TEXT,
  county TEXT,                   -- Extracted location (News) or from CSV (ERCOT)
  city TEXT,
  asset_type_guess TEXT,         -- Extracted asset type
  company_entities TEXT,          -- Extracted company/developer
  lane TEXT,                     -- 'CONSTRAINT', 'COMMITMENT', 'CONTEXT'
  event_type TEXT,
  confidence TEXT,                -- 'LOW', 'MED', 'HIGH'
  dedupe_key TEXT,
  status TEXT,                   -- 'NEW', 'REVIEWED'
  change_type TEXT,              -- 'NEW_ITEM', 'CHANGED_ITEM', 'WITHDRAWN'
  ...
)
```

### Source Snapshots Table

```sql
CREATE TABLE source_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  source_type TEXT,
  query TEXT,                    -- For News: search query; For ERCOT: null
  captured_at DATETIME,
  raw_payload TEXT               -- JSON string of raw results
)
```

---

## Part 6: "Why This Surfaced" Generation

### Function: `generateWhySurfaced(signal)`

**Input:** Signal object with extracted data

**Process:**
1. Parse tags for `recurrence:X` and `friction:*`
2. Get entity context from `company_entities` or `asset_type_guess`
3. Get location from `county` or `city`
4. Build explanation parts:
   - Ordinal (First, Second, Third...) from recurrence count
   - Entity (company or asset type)
   - Friction type or event type
   - Location
   - Time context (this quarter/month)
   - ERCOT reference (if detected in text)

**Output:** String like "Third data center lawsuit in Brazos County this quarter"

**Validation:**
- Only generates if enough real data available
- Returns `null` if insufficient data (no explanation shown)
- Uses ONLY extracted data (no synthetic/example data)

---

## Part 7: File Structure

```
scanner/
├── phase1/
│   ├── signal-normalizer.js          [MODIFIED] Added extractAnchors()
│   ├── signal-ingester.js            [MODIFIED] Added detectRecurrence()
│   ├── signal-classifier.js           [MODIFIED] Added extractFrictionType()
│   ├── storage/
│   │   └── signals-db.js              [UNCHANGED] Existing schema works
│   └── NEWS_PRESSURE_SENSOR_IMPLEMENTATION.md  [NEW]
│   └── COMPLETE_SYSTEM_OVERVIEW.md    [NEW] This file
│
├── phase2/
│   └── adapters/
│       └── ercot-adapter.js           [UNCHANGED] ERCOT workflow
│
└── config/
    └── scanner-config.js              [UNCHANGED] Regex rules

src/components/Map/components/
└── ScannerSignalsPanel.jsx            [MODIFIED] Added News card display + generateWhySurfaced()

server.js                              [UNCHANGED] API endpoints already exist
```

---

## Part 8: Testing

### Test Anchor Extraction

```bash
# Run News ingestion
node scanner/phase1/scanner-cli.js ingest "data center moratorium Texas"

# Check database
sqlite3 scanner.db "SELECT headline, company_entities, county, asset_type_guess, tags FROM signals WHERE source_type='TAVILY' LIMIT 5;"
```

### Test Recurrence Detection

```bash
# Run ingestion twice with similar articles
node scanner/phase1/scanner-cli.js ingest "data center lawsuit Brazos County"
# Wait...
node scanner/phase1/scanner-cli.js ingest "data center lawsuit Brazos County"

# Check for recurrence tags
sqlite3 scanner.db "SELECT headline, tags FROM signals WHERE source_type='TAVILY' AND tags LIKE '%recurrence%';"
```

### Test UI Display

1. Start server: `node server.js`
2. Start React app: `npm start`
3. Navigate to map view
4. Click "News" filter button
5. Click "News" refresh button
6. Verify:
   - "Why this surfaced" line appears
   - Anchors (Who, Where, Asset) displayed
   - Recurrence badge shown (if applicable)
   - Friction type badges shown
   - Cards sorted by recurrence (highest first)

---

## Part 9: Summary

### What Was Built

1. ✅ **Anchor Extraction**: Extracts who, where, asset, friction from articles
2. ✅ **Recurrence Detection**: Detects when same anchors appear again
3. ✅ **Friction Type Detection**: Identifies types of pressure (lawsuit, moratorium, etc.)
4. ✅ **"Why This Surfaced"**: Machine-generated explanations
5. ✅ **News Card Display**: Distinct from ERCOT, focused on pressure

### Key Principles

- **News = Pressure Sensor**: Detects friction and repetition, not precision
- **ERCOT = State Machine**: Tracks what changed, structured data
- **Real Data Only**: No synthetic/example data in "Why this surfaced"
- **Different Feel**: News and ERCOT should never feel the same

### System Status

✅ **Fully Implemented**
- All backend components working
- Frontend display complete
- Database schema supports all features
- Documentation complete

---

## Part 10: Future Considerations

### Not Implemented (By Design)

- ❌ ERCOT-style status semantics for News
- ❌ Over-cleaned News cards
- ❌ Linking News to structured ERCOT projects
- ❌ "New"/"Updated" badges for News (those are for state machines)

### Potential Enhancements (Future)

- Improve anchor extraction accuracy (LLM-based?)
- Add more friction types
- Enhance recurrence matching (fuzzy matching?)
- Add time-based recurrence (this week, this month, this quarter)
- Export recurrence trends

---

**End of Document**

