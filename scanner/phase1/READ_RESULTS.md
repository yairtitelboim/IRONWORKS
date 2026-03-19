# How to Read Phase 1 Results

## Database Location

**SQLite Database:** `scanner/scanner.db`

**Full Path:** `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/3MI/scanner/scanner.db`

---

## Method 1: Using CLI Commands

### List all signals
```bash
cd scanner/phase1
TAVILY_API_KEY=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 \
PRP=YOUR_PERPLEXITY_API_KEY \
node scanner-cli.js list
```

### List only CONSTRAINT signals
```bash
node scanner-cli.js list --lane CONSTRAINT
```

### List only COMMITMENT signals
```bash
node scanner-cli.js list --lane COMMITMENT
```

### Review new signals (detailed view)
```bash
node scanner-cli.js review --lane CONSTRAINT
```

### View statistics
```bash
node scanner-cli.js stats
```

---

## Method 2: Direct SQLite Query

### Install SQLite (if not installed)
```bash
# macOS
brew install sqlite3

# Or use system sqlite3
which sqlite3
```

### Query the database

**Basic query:**
```bash
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/3MI
sqlite3 scanner/scanner.db "SELECT * FROM signals LIMIT 5;"
```

**Better formatted:**
```bash
sqlite3 scanner/scanner.db -header -column "SELECT signal_id, headline, lane, event_type, url FROM signals LIMIT 10;"
```

**Export to CSV:**
```bash
sqlite3 scanner/scanner.db -header -csv "SELECT * FROM signals;" > signals_export.csv
```

**Export to JSON:**
```bash
sqlite3 scanner/scanner.db -json "SELECT * FROM signals LIMIT 10;" > signals_sample.json
```

---

## Method 3: Sample Queries

### Get all CONSTRAINT signals
```bash
sqlite3 scanner/scanner.db -header -column "
SELECT 
  headline,
  lane,
  event_type,
  confidence,
  url,
  tags
FROM signals 
WHERE lane = 'CONSTRAINT'
ORDER BY ingested_at DESC
LIMIT 10;"
```

### Get signals by event type
```bash
sqlite3 scanner/scanner.db -header -column "
SELECT 
  headline,
  event_type,
  url
FROM signals 
WHERE event_type = 'MORATORIUM'
ORDER BY ingested_at DESC;"
```

### Get signals with tags
```bash
sqlite3 scanner/scanner.db -header -column "
SELECT 
  headline,
  tags,
  confidence,
  url
FROM signals 
WHERE tags IS NOT NULL
ORDER BY ingested_at DESC
LIMIT 10;"
```

### Get statistics
```bash
sqlite3 scanner/scanner.db "
SELECT 
  lane,
  COUNT(*) as count
FROM signals
GROUP BY lane;"
```

---

## Method 4: Using a Database Browser

### Install DB Browser for SQLite
```bash
# macOS
brew install --cask db-browser-for-sqlite
```

Then:
1. Open DB Browser for SQLite
2. File → Open Database
3. Navigate to: `scanner/scanner.db`
4. Browse tables, run queries, export data

---

## Method 5: Python Script (if you prefer)

**File:** `scanner/phase1/read_signals.py`

```python
import sqlite3
import json

db_path = '../scanner.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Get all signals
cursor = conn.execute("SELECT * FROM signals ORDER BY ingested_at DESC LIMIT 10")
signals = [dict(row) for row in cursor]

# Print
for signal in signals:
    print(f"\n{signal['headline']}")
    print(f"  Lane: {signal['lane']}")
    print(f"  Event: {signal['event_type']}")
    print(f"  URL: {signal['url']}")
    print(f"  Tags: {signal['tags']}")

conn.close()
```

---

## Database Schema

**Table: `signals`**

Key columns:
- `signal_id` - Unique identifier
- `headline` - Signal title
- `raw_text` - Full content
- `summary_3bullets` - Summary
- `lane` - CONSTRAINT, COMMITMENT, or CONTEXT
- `event_type` - MORATORIUM, LAWSUIT, APPROVED, etc.
- `confidence` - LOW, MED, HIGH
- `tags` - JSON array of matched rules
- `url` - Source URL
- `source_type` - TAVILY, ERCOT_QUEUE, etc.
- `status` - NEW, REVIEWED, LINKED, etc.
- `ingested_at` - When signal was added
- `published_at` - When signal was published

**Table: `source_snapshots`**

- Stores raw payloads for change detection
- Used to detect new/changed/withdrawn signals

---

## Quick Sample Queries

### Get 5 random signals
```bash
sqlite3 scanner/scanner.db -header -column "
SELECT 
  headline,
  lane,
  event_type,
  url
FROM signals 
ORDER BY RANDOM()
LIMIT 5;"
```

### Get most recent signals
```bash
sqlite3 scanner/scanner.db -header -column "
SELECT 
  headline,
  lane,
  event_type,
  ingested_at,
  url
FROM signals 
ORDER BY ingested_at DESC
LIMIT 10;"
```

### Get signals by confidence
```bash
sqlite3 scanner/scanner.db -header -column "
SELECT 
  headline,
  confidence,
  event_type,
  tags
FROM signals 
WHERE confidence = 'HIGH'
ORDER BY ingested_at DESC
LIMIT 10;"
```

---

## Export All Data

### Export to CSV
```bash
sqlite3 scanner/scanner.db -header -csv "
SELECT 
  signal_id,
  headline,
  lane,
  event_type,
  confidence,
  url,
  source_type,
  status,
  ingested_at,
  tags
FROM signals;" > scanner_results.csv
```

### Export to JSON
```bash
sqlite3 scanner/scanner.db -json "
SELECT * FROM signals;" > scanner_results.json
```

---

## View in Terminal (Pretty Print)

```bash
sqlite3 scanner/scanner.db -header -column -box "
SELECT 
  headline,
  lane,
  event_type,
  confidence
FROM signals 
LIMIT 10;"
```

---

## Check Database Size

```bash
ls -lh scanner/scanner.db
sqlite3 scanner/scanner.db "SELECT COUNT(*) as total_signals FROM signals;"
```

