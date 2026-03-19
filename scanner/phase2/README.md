# Scanner Phase 2: Production Ingestion Layer

## Status: 🚧 In Progress

Phase 2 builds on the validated Phase 1 pipeline to add **real source adapters** for automated, high-throughput ingestion from official sources.

## What's Implemented

✅ **Core Infrastructure:**
- Enhanced `SignalDiffer` with `source_id` comparison support
- Enhanced database methods for deduplication
- `BaseAdapter` class with retry logic and error handling
- `SignalNormalizerV2` for RawSignal format
- `SignalDeduplicator` for multi-source deduplication
- `SignalIngesterV2` using adapters

✅ **Adapter Pattern:**
- Base adapter with retry/fallback logic
- Placeholder ERCOT adapter (needs research)

## What's Next

### 1. Research ERCOT Format (CRITICAL - BLOCKER)
- **File:** `scanner/phase2/research/ERCOT_FORMAT.md`
- **Time:** 1-2 days
- **Action:** Research ERCOT queue data format and document findings

### 2. Implement ERCOT Adapter
- **File:** `scanner/phase2/adapters/ercot-adapter.js`
- **Time:** 1 week
- **Action:** Implement `fetch()` method based on research

### 3. Create PUC Adapter
- **Time:** 1 week
- **Action:** Research PUC format, build adapter

### 4. Create RSS Adapter
- **Time:** 3-4 days
- **Action:** Build RSS feed monitor with rate limiting

### 5. Add Scheduler
- **Time:** 1 day
- **Action:** Create cron-based scheduler for automated runs

### 6. Add Monitoring
- **Time:** 2 days
- **Action:** Health checks, error logging, alerts

## Architecture

```
Adapter.fetch() → RawSignal[]
    ↓
SignalNormalizerV2.normalizeRawSignal() → Signal (schema)
    ↓
SignalDeduplicator.findDuplicates() → Filter duplicates
    ↓
SignalDiffer.diff() → Change Detection (NEW/CHANGED/WITHDRAWN)
    ↓
SignalClassifier.classify() → Classified Signal
    ↓
SignalsDB.insertSignal() → Stored
```

## Key Features

### Enhanced Change Detection
- Supports `url` comparison (RSS, news)
- Supports `source_id` comparison (ERCOT, PUC)
- Detects status changes (e.g., ERCOT queue status updates)

### Multi-Source Deduplication
- URL matching
- Source ID matching
- Fuzzy headline matching
- Company + location + date matching

### Error Handling
- Exponential backoff retries
- Fallback to last known good snapshot
- Graceful degradation

## Usage

### Basic Example

```javascript
import SignalsDB from '../phase1/storage/signals-db.js';
import SignalIngesterV2 from './signal-ingester-v2.js';
import ERCOTAdapter from './adapters/ercot-adapter.js';

const db = new SignalsDB();
await db.connect();
await db.init();

const adapters = {
  ERCOT: new ERCOTAdapter()
};

const ingester = new SignalIngesterV2(db, adapters);

// Ingest from single source
const result = await ingester.ingestFromSource('ERCOT');

// Or ingest from all sources
const results = await ingester.ingestAll();
```

## Comparison Key Strategies

Different sources use different comparison keys:

- **ERCOT_QUEUE:** `source_id` (queue_id)
- **TX_PUC:** `source_id` (docket_number)
- **RSS:** `url`
- **COURT_DOCKET:** `source_id` (case_number)

The `SignalDiffer` automatically selects the right strategy based on source type.

## Files

```
scanner/phase2/
├── adapters/
│   ├── base-adapter.js          # Base class with retry logic
│   └── ercot-adapter.js        # ERCOT adapter (placeholder)
├── monitor/
│   └── (health-checker.js)     # TODO
├── research/
│   └── ERCOT_FORMAT.md         # Research notes
├── signal-ingester-v2.js        # Main ingester using adapters
├── signal-normalizer-v2.js     # Enhanced normalizer
├── signal-deduplicator.js      # Multi-source deduplication
└── README.md                    # This file
```

## Dependencies

Phase 2 will need additional dependencies (install when needed):

```bash
npm install node-cron          # For scheduling
npm install rss-parser          # For RSS feeds
npm install cheerio             # For HTML scraping (if needed)
npm install puppeteer           # For JavaScript-heavy sites (if needed)
npm install csv-parse           # For CSV parsing (if ERCOT uses CSV)
```

## Testing

### Test Enhanced Differ

```javascript
import SignalDiffer from '../phase1/signal-differ.js';

const differ = new SignalDiffer();

// Test with source_id comparison
const diffResult = differ.diff(newSignals, previousSnapshot, 'source_id');
```

### Test Deduplication

```javascript
import SignalDeduplicator from './signal-deduplicator.js';

const deduplicator = new SignalDeduplicator();
const duplicate = await deduplicator.findDuplicates(signal, db);
```

## Success Metrics

- ✅ **ERCOT ingestion**: Daily runs, captures new queue entries
- ✅ **PUC ingestion**: Daily runs, captures new filings
- ✅ **RSS ingestion**: Every 2 hours, captures news
- ✅ **<5% duplicate rate** across all sources
- ✅ **95%+ uptime** for all adapters
- ✅ **500+ signals/day** from all sources combined

## See Also

- `docs/SCANNER_PHASE2_PLAN.md` - Detailed Phase 2 plan
- `docs/PHASE2_IMPLEMENTATION_REFLECTION.md` - Implementation reflection and recommendations
- `scanner/phase1/README.md` - Phase 1 documentation

