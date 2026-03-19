# Scanner Implementation Plan - Three Phases

## Overview

The Scanner is a high-throughput, partially automated early-warning inbox that continuously ingests and normalizes public signals related to infrastructure, energy, water, and data-center development. This plan outlines three phases of implementation, starting with a base system using existing API access.

## Key Design Principles

1. **Change Detection First**: This is a scanner, not a search app. Focus on "what changed?" not "what exists?"
2. **Pipeline Validation**: Phase 1 proves mechanics (normalize → dedupe → classify → diff → review), not throughput
3. **Cost-Governed LLM Usage**: LLM only for ambiguous cases, with strict budgets and caching
4. **Constraint-First**: Opposition is the binding constraint - prioritize constraint signals
5. **Detection, Not Prediction**: Flag patterns and early warnings, don't make claims you can't defend

---

## Phase 1: Pipeline Validation & Change Detection
**Goal**: Prove the pipeline mechanics: normalize → dedupe → classify → diff → review

**Timeline**: 2-3 weeks  
**APIs Used**: Perplexity AI only

**Critical**: Phase 1 is about **pipeline validation**, not throughput. Perplexity is temporary bootstrap while building real ingestion pattern.

### 1.1 Core Infrastructure

#### Files to Create:
```
scanner/
├── phase1/
│   ├── scanner-cli.js             # CLI runner (primary interface)
│   ├── scanner-server.js          # Optional Express server (minimal endpoints)
│   ├── signal-ingester.js          # Main ingestion orchestrator
│   │                                # → API CALL: Perplexity (discovery queries)
│   ├── signal-classifier.js       # Regex-based classification
│   │                                # → API CALL: Perplexity (only if regex fails)
│   ├── signal-normalizer.js       # Schema normalization
│   ├── signal-differ.js            # Change detection (new/changed/withdrawn)
│   ├── cost-governor.js            # Perplexity API call budget limiter
│   ├── api-clients/
│   │   └── perplexity-client.js   # Perplexity API wrapper
│   │                                # → API CALL: https://api.perplexity.ai/chat/completions
│   └── storage/
│       └── signals-db.js           # SQLite storage
├── config/
│   └── scanner-config.js          # Source configs, regex rules, query templates
└── tests/
    └── test-signal-classification.js
```

#### Database Schema (SQLite for Phase 1):
```sql
CREATE TABLE signals (
    signal_id TEXT PRIMARY KEY,
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME,
    source_type TEXT,
    source_name TEXT,
    source_id TEXT,
    url TEXT,
    headline TEXT,
    raw_text TEXT,                  -- Full content for classification
    summary_3bullets TEXT,
    tags TEXT,                      -- JSON array: ["moratorium", "zoning_denial"]
    jurisdiction TEXT,
    state TEXT,
    county TEXT,
    city TEXT,
    asset_type_guess TEXT,
    company_entities TEXT,
    site_entities TEXT,
    location_hint TEXT,
    lat REAL,
    lon REAL,
    lane TEXT DEFAULT 'CONTEXT',
    event_type TEXT,
    commitment_hint TEXT DEFAULT 'NONE',
    confidence TEXT DEFAULT 'LOW',
    dedupe_key TEXT,
    status TEXT DEFAULT 'NEW',
    candidate_project_id TEXT,
    review_notes_1line TEXT,
    requires_followup INTEGER DEFAULT 0,
    change_type TEXT,
    previous_ref TEXT
);

-- Source snapshots for change detection
CREATE TABLE source_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    source_type TEXT,
    query TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_payload TEXT                -- Full raw response for diffing
);
```

### 1.2 Data Sources (Phase 1 - Perplexity Only)

**Important**: Perplexity is temporary bootstrap. Real sources (ERCOT, PUC, etc.) come in Phase 2.

#### Source: Perplexity AI (Bootstrap + Classification)

**Two Use Cases for Perplexity API:**

##### 1. Discovery Queries (Primary Ingestion)
- **Purpose**: Find signals via Perplexity search
- **Location**: `signal-ingester.js` → `perplexity-client.js` → **API CALL**
- **Endpoint**: `POST https://api.perplexity.ai/chat/completions`
- **Query Templates** (Constraint-first):
  - `"Recent data center moratoriums or zoning denials in Texas"`
  - `"New lawsuits filed against battery storage projects in Texas"`
  - `"Substation opposition or permit denials Texas 2024"`
  - `"Data center noise complaints city council Texas"`
  - `"Water permit denials or appeals Texas infrastructure"`
- **Frequency**: Manual runs for testing
- **Implementation**: `api-clients/perplexity-client.js`
- **Note**: This is NOT the production source pattern. It's for pipeline validation.

##### 2. Classification Fallback (Only if Regex Fails)
- **Purpose**: Classify ambiguous signals when regex confidence is LOW
- **Location**: `signal-classifier.js` → `perplexity-client.js` → **API CALL**
- **Endpoint**: `POST https://api.perplexity.ai/chat/completions`
- **Trigger**: Only when regex confidence < MED
- **Use Cases**:
  - Low-confidence signals from regex
  - Complex entity extraction (if needed)
- **Implementation**: Same `perplexity-client.js`, different prompt

### 1.3 Classification System

#### Regex Rules (from requirements)
**File**: `config/scanner-config.js`

```javascript
const CONSTRAINT_RULES = {
  moratorium: {
    regex: /\bmoratorium\b|\btemporary ban\b|\bban on\b|\bpaused\b.*\bpermits?\b|\bhalt(ed)?\b.*\bdevelopment\b/,
    event_type: 'MORATORIUM',
    confidence: 'HIGH'
  },
  zoning_denial: {
    regex: /\bdenied\b.*\b(zoning|rezon(e|ing)|permit|variance|site plan)\b|\brejected\b.*\b(zoning|permit|variance|site plan)\b/,
    event_type: 'ZONING_DENIAL',
    confidence: 'HIGH'
  },
  lawsuit: {
    regex: /\blawsuit\b|\bsued\b|\bsuing\b|\bcomplaint filed\b|\bpetition filed\b|\btemporary restraining order\b|\bTRO\b|\binjunction\b/,
    event_type: 'LAWSUIT',
    confidence: 'HIGH'
  },
  // ... (all other rules from requirements)
};
```

#### Perplexity Classification (for ambiguous cases only)
- **Trigger**: Only when regex confidence is LOW or no match
- **Location**: `signal-classifier.js` → `perplexity-client.js` → **API CALL**
- **Endpoint**: `POST https://api.perplexity.ai/chat/completions`
- **Model**: `sonar-pro` (or `sonar` for cheaper)
- **Cost Governor**: 
  - Max Perplexity calls per run (configurable, default: 10)
  - Max tokens per call (default: 500)
  - Skip Perplexity if regex confidence ≥ MED
  - Cache results by `dedupe_key`
- **Prompt Template**:
```
Classify this signal into COMMITMENT or CONSTRAINT:

Signal: {headline}
Raw text: {raw_text}
Source: {source_type}

Return JSON:
{
  "lane": "COMMITMENT" | "CONSTRAINT" | "CONTEXT",
  "event_type": "...",
  "confidence": "LOW" | "MED" | "HIGH",
  "reasoning": "brief explanation"
}
```

### 1.4 Change Detection (Core Feature)

#### Diffing Mechanism
- **Every ingestion run**:
  1. Store raw payload in `source_snapshots` table
  2. Compare against previous snapshot
  3. Compute: `NEW_ITEM`, `CHANGED_ITEM`, `WITHDRAWN`
  4. Set `change_type` and `previous_ref` fields
- **Implementation**: `signal-differ.js`

This is how you become **"what changed?"** instead of **"what exists?"**

### 1.5 Interface (CLI-First, Optional Server)

#### Primary: CLI Runner
```bash
# Run ingestion (calls Perplexity API)
node scanner-cli.js ingest --query "data center moratorium Texas"

# Check signals
node scanner-cli.js list --lane CONSTRAINT --status NEW

# Review signals (opens in simple viewer)
node scanner-cli.js review
```

#### Optional: Minimal Express Server
Only if you need programmatic access. Keep endpoints minimal:

- `POST /ingest/run` - Trigger ingestion run (calls Perplexity API)
- `GET /signals?filters=...` - List signals with filters

**Note**: Don't build a full API unless you need it. CLI is sufficient for Phase 1.

### 1.6 API Call Locations (Explicit)

**All Perplexity API calls happen in these locations:**

1. **Discovery/Ingestion**: 
   - `signal-ingester.js` → `perplexity-client.js` → `POST https://api.perplexity.ai/chat/completions`
   - Called when: User runs `ingest` command
   - Purpose: Find signals via search queries

2. **Classification Fallback**:
   - `signal-classifier.js` → `perplexity-client.js` → `POST https://api.perplexity.ai/chat/completions`
   - Called when: Regex confidence < MED
   - Purpose: Classify ambiguous signals

**No other API calls in Phase 1.**

### 1.6 Testing & Validation

#### Test Cases:
1. **Pipeline End-to-End**: Ingest → normalize → classify → diff → review
2. **Perplexity Discovery**: Test Perplexity query → should return signals
3. **Regex Classification**: Test all regex rules, verify `tags` field populated
4. **Perplexity Fallback**: Test ambiguous signal → Perplexity classification (only if regex fails)
5. **Change Detection**: Ingest same query twice → should detect no new items
6. **Deduplication**: Ingest duplicate signal → should dedupe correctly
7. **Cost Governor**: Verify Perplexity calls are limited and cached
8. **Schema Validation**: Ensure all fields (including `raw_text`, `tags`) map correctly

#### Success Criteria (Revised):
- ✅ **Pipeline mechanics work**: normalize → dedupe → classify → diff → review
- ✅ **Lane classification works** with explainability (which rule hit, stored in `tags`)
- ✅ **Change detection works**: new/changed/withdrawn correctly identified
- ✅ **Deduplication works**: same signal not duplicated
- ✅ **Review workflow works**: can review signals in <10 minutes/week
- ✅ **Cost controlled**: LLM calls limited, cached, only for ambiguous cases

---

## Phase 2: Production Ingestion Layer
**Goal**: Build automated, high-throughput ingestion from real sources

**Timeline**: 4-6 weeks  
**Focus**: ERCOT, PUC, RSS, Court Dockets (in priority order)

### 2.1 Ingestion Adapter Pattern

**Standardize all sources** to output the same object:

```typescript
type RawSignal = {
  source_type: string
  source_id?: string
  published_at?: string
  url?: string
  headline: string
  body_text?: string
  metadata?: Record<string, any>
}
```

Then everything downstream (normalizer, classifier, differ) is source-agnostic.

**Implementation**: `adapters/base-adapter.js` (abstract class)

### 2.2 Automated Source Integrations (Priority Order)

#### 1. ERCOT Queue Monitor (Highest Priority)
- **Source**: ERCOT interconnection queue (web scraping or API if available)
- **Frequency**: Daily
- **What to Extract**:
  - New queue entries
  - Status changes (approved, withdrawn)
  - Project details (MW, location, company)
- **Implementation**: `adapters/ercot-adapter.js`
- **Why First**: Structured data, clear change signals, high value

#### 2. Texas PUC Filings
- **Source**: PUC website/database
- **Frequency**: Daily
- **What to Extract**:
  - Utility filings
  - Rate cases
  - Infrastructure approvals
- **Implementation**: `adapters/puc-adapter.js`
- **Why Second**: Structured, official, high signal-to-noise

#### 3. RSS Feed Monitor
- **Sources**: News sites, press releases
- **Frequency**: Every 2 hours
- **Implementation**: `adapters/rss-adapter.js`
- **Why Third**: Easier than courts, good coverage

#### 4. Court Docket Monitor (Lower Priority)
- **Source**: County/state court databases
- **Frequency**: Daily
- **What to Extract**:
  - New lawsuits
  - Case status updates
  - Filings related to infrastructure
- **Implementation**: `adapters/court-adapter.js`
- **Why Last**: Messy, fragmented, harder to parse

### 2.3 Enhanced Classification

#### Multi-Source Deduplication
- Link signals from different sources about same event
- Use fuzzy matching on company names, locations, dates
- **Implementation**: `signal-deduplicator.js`

#### Entity Extraction
- Extract company names, site names, locations
- Use LLM only for complex cases (cost-governed)
- **Implementation**: `entity-extractor.js`

### 2.4 Storage Upgrade

#### Move to PostgreSQL (or keep SQLite if small scale)
- Better for concurrent writes
- Full-text search capabilities
- Better indexing for deduplication

**Note**: Change tracking already implemented in Phase 1 via `source_snapshots` table.

### 2.5 Monitoring & Alerts

#### Health Checks
- Monitor scraper success rates
- Alert on source failures
- **Implementation**: `monitor/health-checker.js`

#### Simple Dashboard (Optional)
- Real-time signal feed
- Statistics by source, lane, status
- **Implementation**: `dashboard/scanner-dashboard.jsx`
- **Note**: Keep it simple. Full UI comes later if needed.

---

## Phase 3: Advanced Features & MCP Integration
**Goal**: Add intelligent orchestration, cross-source linking, and MCP tools

**Timeline**: 4-6 weeks  
**Focus**: MCP protocol, advanced LLM features, production hardening

### 3.1 MCP Server Implementation

#### MCP Tools to Expose:

**Tool 1: `classify_ambiguous_signal`**
```javascript
{
  name: "classify_ambiguous_signal",
  description: "Classify a signal when regex rules are uncertain",
  inputSchema: {
    signal_id: "string",
    signal_text: "string",
    source_type: "string"
  }
}
```

**Tool 2: `extract_entities`**
```javascript
{
  name: "extract_entities",
  description: "Extract company names, site names, locations from signal text",
  inputSchema: {
    signal_text: "string"
  }
}
```

**Tool 3: `deduplicate_signals`**
```javascript
{
  name: "deduplicate_signals",
  description: "Check if two signals are duplicates or related",
  inputSchema: {
    signal1_id: "string",
    signal2_id: "string"
  }
}
```

**Tool 4: `link_related_signals`**
```javascript
{
  name: "link_related_signals",
  description: "Find all signals related to a given signal",
  inputSchema: {
    signal_id: "string"
  }
}
```

**Tool 5: `research_signal`**
```javascript
{
  name: "research_signal",
  description: "Perform natural language research query about a signal",
  inputSchema: {
    signal_id: "string",
    query: "string"
  }
}
```

#### MCP Server Setup:
- **File**: `mcp/scanner-mcp-server.js`
- **Protocol**: Use `@modelcontextprotocol/sdk`
- **Transport**: stdio or HTTP
- **Integration**: Connect to Scanner database and API

### 3.2 Advanced LLM Features

#### Intelligent Source Selection
- LLM decides which sources to check based on recent signals
- "If we see a new ERCOT queue entry, check for related news and court cases"
- **Implementation**: `llm-orchestrator.js`

#### Early Warning Escalation (Non-Predictive)
- **Detection-based rules** (not prediction):
  - If a project has 3+ constraint signals in 30 days → flag it
  - If a county has a new moratorium → flag it
  - If a company has multiple zoning denials → flag it
- **Implementation**: `early-warning-escalator.js`
- **Note**: This is detection, not prediction. We're flagging patterns, not forecasting.

#### Cross-Source Relationship Mapping
- Build graph of related signals
- Track project lifecycle across sources
- **Implementation**: `relationship-mapper.js`

### 3.3 Production Hardening

#### Rate Limiting & Cost Control
- Track API costs per source
- Implement rate limiting
- **Implementation**: `rate-limiter.js`

#### Error Handling & Retries
- Robust error handling for all sources
- Exponential backoff retries
- **Implementation**: `error-handler.js`

#### Data Quality Monitoring
- Track classification accuracy
- Flag low-quality signals
- **Implementation**: `quality-monitor.js`

### 3.4 User Interface (Deferred)

**Note**: Defer public UI for now. A Notion-like UI becomes a product, and you don't need that to learn.

Focus Phase 3 on:
- MCP tools (for programmatic access)
- CLI improvements
- Simple review interface (CLI-based or minimal web)

Full UI can come later if needed.

---

## Implementation Priority

### Phase 1 (Start Here):
1. ✅ Set up SQLite database with schema (signals + source_snapshots tables)
2. ✅ Implement Perplexity client (`api-clients/perplexity-client.js`)
3. ✅ Implement regex classification rules (with `tags` field)
4. ✅ Build change detection (diffing mechanism)
5. ✅ Build CLI runner (primary interface)
6. ✅ Add cost governor (limit Perplexity API calls)
7. ✅ Test pipeline end-to-end: ingest → normalize → classify → diff → review

**API Call Locations:**
- `signal-ingester.js` → Perplexity (discovery)
- `signal-classifier.js` → Perplexity (fallback classification)

### Phase 2 (After Phase 1 validated):
1. Build ERCOT scraper
2. Build PUC scraper
3. Implement RSS monitor
4. Add deduplication
5. Build dashboard

### Phase 3 (After Phase 2 stable):
1. Implement MCP server
2. Add advanced LLM features
3. Build UI
4. Production hardening

---

## Environment Variables Needed

```bash
# Phase 1 API (Perplexity only)
REACT_APP_PRP=your_perplexity_api_key
# OR
PERPLEXITY_API_KEY=your_perplexity_api_key

# Phase 1 Config
SCANNER_DB_PATH=./scanner.db
SCANNER_MAX_PERPLEXITY_CALLS=10  # Max calls per ingestion run
SCANNER_MAX_TOKENS=500            # Max tokens per Perplexity call
SCANNER_PERPLEXITY_MODEL=sonar-pro  # or 'sonar' for cheaper

# Phase 2 (add later)
ERCOT_API_KEY=...
PUC_API_KEY=...
COURT_API_KEY=...

# Phase 3
MCP_SERVER_URL=http://localhost:3002
```

---

## Success Metrics

### Phase 1 (Revised):
- ✅ **Pipeline mechanics work**: ingest + normalize + dedupe + classify + diff + review
- ✅ **Lane classification works** with explainability (which rule hit, stored in `tags`)
- ✅ **Change detection works**: new/changed/withdrawn correctly identified
- ✅ **Review workflow works**: can review signals in <10 minutes/week
- ✅ **Cost controlled**: LLM calls limited, cached, only for ambiguous cases

**Not about throughput** - it's about proving the pipeline works.

### Phase 2:
- ✅ **ERCOT/PUC ingestion runs reliably** (daily, automated)
- ✅ **Weekly digest shows meaningful diffs** (what changed this week)
- ✅ **Dedupe doesn't collapse distinct projects** incorrectly
- ✅ **<5% duplicate rate** across all sources
- ✅ **95%+ uptime** for scrapers

### Phase 3:
- ✅ **MCP tools respond in <2s**
- ✅ **Cross-source linking finds 30%+ relationships**
- ✅ **Early warning escalation flags patterns** (not predictions)
- ✅ **MCP tools reduce manual effort** without auto-deciding

---

## Next Steps

1. **Review this plan** - Confirm priorities and scope
2. **Set up Phase 1 directory structure** - Create `scanner/phase1/` folder
3. **Implement database schema** - SQLite setup
4. **Build Perplexity client** - First working ingestion
5. **Test with sample queries** - Validate end-to-end flow

