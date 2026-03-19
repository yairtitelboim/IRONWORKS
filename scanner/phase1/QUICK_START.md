# Scanner Phase 1 - Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies
```bash
cd scanner/phase1
npm init -y
npm install sqlite3 dotenv axios commander
# Optional: npm install express (only if you need server)
```

### 2. Environment Variables
Add to your `.env` file:
```bash
# Phase 1 API (Perplexity only)
REACT_APP_PRP=your_perplexity_api_key_here
# OR
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Scanner Config
SCANNER_DB_PATH=./scanner.db
SCANNER_MAX_PERPLEXITY_CALLS=10
SCANNER_MAX_TOKENS=500
SCANNER_PERPLEXITY_MODEL=sonar-pro  # or 'sonar' for cheaper
```

### 3. Create Database
```bash
node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./scanner.db');
db.serialize(() => {
  // Signals table
  db.run(\`
    CREATE TABLE IF NOT EXISTS signals (
      signal_id TEXT PRIMARY KEY,
      ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME,
      source_type TEXT,
      source_name TEXT,
      source_id TEXT,
      url TEXT,
      headline TEXT,
      raw_text TEXT,
      summary_3bullets TEXT,
      tags TEXT,
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
    )
  \`);
  
  // Source snapshots for change detection
  db.run(\`
    CREATE TABLE IF NOT EXISTS source_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      source_type TEXT,
      query TEXT,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_payload TEXT
    )
  \`);
  
  console.log('✅ Database created (signals + source_snapshots)');
});
"
```

## First Test (2 minutes)

### 1. Ingest First Signal (CLI)
**API CALL**: This will call Perplexity API
```bash
node scanner-cli.js ingest --query "data center moratorium Texas"
```

**What happens:**
- `scanner-cli.js` → `signal-ingester.js` → `perplexity-client.js` → **API CALL** to `https://api.perplexity.ai/chat/completions`
- Perplexity returns search results
- Results normalized and stored in database

### 2. Check Results
```bash
node scanner-cli.js list --lane CONSTRAINT --status NEW
```

### 3. Test Change Detection
```bash
# Run ingestion twice - should detect no new items on second run
# First run: API CALL to Perplexity
node scanner-cli.js ingest --query "data center moratorium Texas"
# Second run: API CALL to Perplexity, but should detect no new items
node scanner-cli.js ingest --query "data center moratorium Texas"
# Should show: "0 new items, 0 changed items"
```

## Expected Output

You should see:
- ✅ Signal ingested with `signal_id`
- ✅ `lane` set to `CONSTRAINT` (from regex)
- ✅ `event_type` set to `MORATORIUM`
- ✅ `confidence` set to `HIGH`
- ✅ `tags` field populated: `["moratorium"]` (which rule hit)
- ✅ `raw_text` field contains full content
- ✅ All schema fields populated
- ✅ Change detection works (new/changed/withdrawn)

## Verify Pipeline Mechanics

Run through the full pipeline:
1. **Ingest** (API CALL): `node scanner-cli.js ingest --query "zoning denial data center Texas"`
   - Calls Perplexity API for discovery
2. **Normalize**: Check database - all fields populated
3. **Classify**: Check `lane`, `event_type`, `tags` fields
   - If regex fails, calls Perplexity API for classification
4. **Diff**: Run again - should detect no changes
5. **Review**: `node scanner-cli.js review` (opens simple viewer)

## API Call Summary

**All Perplexity API calls in Phase 1:**

1. **Discovery/Ingestion** (Primary):
   - Location: `signal-ingester.js` → `perplexity-client.js`
   - Endpoint: `POST https://api.perplexity.ai/chat/completions`
   - When: Every `ingest` command
   - Model: `sonar-pro` (or `sonar`)

2. **Classification Fallback** (Only if needed):
   - Location: `signal-classifier.js` → `perplexity-client.js`
   - Endpoint: `POST https://api.perplexity.ai/chat/completions`
   - When: Regex confidence < MED
   - Model: `sonar-pro` (or `sonar`)

**No other API calls in Phase 1.**

## Next Steps

1. Test constraint-first queries (see constraint query templates in plan)
2. Test LLM fallback (use ambiguous signal that regex misses)
3. Verify cost governor (check LLM calls are limited)
4. Move to Phase 2 (real sources: ERCOT, PUC)

