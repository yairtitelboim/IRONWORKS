# Scanner Phase 1 - Quick Start

## Setup

1. **Install dependencies:**
```bash
cd scanner/phase1
npm install
```

2. **Set environment variables** (in `.env` or parent `.env`):
```bash
TAVILY_API_KEY=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
REACT_APP_PRP=your_perplexity_key
SCANNER_DB_PATH=./scanner.db
SCANNER_MAX_PERPLEXITY_CALLS=10
SCANNER_MAX_TOKENS=500
```

## Usage

### Ingest signals
```bash
node scanner-cli.js ingest --query "data center moratorium Texas"
```

Or use a template:
```bash
node scanner-cli.js ingest --template constraint
```

### List signals
```bash
# All signals
node scanner-cli.js list

# Only constraints
node scanner-cli.js list --lane CONSTRAINT

# New signals only
node scanner-cli.js list --status NEW
```

### Review signals
```bash
# Review new constraint signals
node scanner-cli.js review --lane CONSTRAINT
```

### View statistics
```bash
node scanner-cli.js stats
```

### Ingest ERCOT queue data (separate feed)
```bash
# Use default LBL dataset (368 entries)
node scanner-cli.js ercot

# Use GIS reports dataset (89,694 entries)
node scanner-cli.js ercot --gis-reports

# Custom CSV path
node scanner-cli.js ercot --data-path /path/to/ercot.csv
```

**Note:** ERCOT feed is separate from main `ingest` command. It uses Phase 2 adapter pattern and reads from CSV files.

## Pipeline Flow

1. **Tavily Search** → Find signals (API CALL)
2. **Normalize** → Map to schema
3. **Classify** → Regex rules → Perplexity fallback (if needed)
4. **Diff** → Compare with previous snapshot
5. **Store** → Save to database

## API Calls

- **Tavily**: Every `ingest` command
- **Perplexity**: Only when regex confidence < MED (max 10 calls per run)

## Files

- `scanner-cli.js` - Main CLI interface
- `signal-ingester.js` - Orchestrates pipeline
- `signal-classifier.js` - Regex + Perplexity classification
- `signal-normalizer.js` - Schema mapping
- `signal-differ.js` - Change detection
- `api-clients/tavily-client.js` - Tavily API wrapper
- `api-clients/perplexity-client.js` - Perplexity API wrapper
- `storage/signals-db.js` - SQLite database

