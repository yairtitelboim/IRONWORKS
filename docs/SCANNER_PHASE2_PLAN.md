# Scanner Phase 2: Production Ingestion Layer

## Overview

Phase 2 builds on the validated Phase 1 pipeline to add **real source adapters** for automated, high-throughput ingestion from official sources. The goal is to move from bootstrap search APIs (Tavily) to structured, reliable data sources (ERCOT, PUC, RSS, Courts).

**Timeline:** 4-6 weeks  
**Goal:** Automated daily ingestion from ERCOT, PUC, RSS feeds  
**Success Metric:** 500+ signals/day from all sources, <5% duplicate rate, 95%+ uptime

---

## Architecture: Adapter Pattern

### Core Principle

All sources output the same `RawSignal` format, making everything downstream (normalizer, classifier, differ) **source-agnostic**.

### RawSignal Interface

```typescript
type RawSignal = {
  source_type: string        // 'ERCOT_QUEUE', 'TX_PUC', 'RSS', 'COURT_DOCKET'
  source_id?: string         // Queue ID, docket #, permit #, etc.
  published_at?: string      // ISO date string
  url?: string               // Source URL
  headline: string           // Title/subject
  body_text?: string         // Full content or excerpt
  metadata?: {               // Source-specific data
    [key: string]: any
  }
}
```

### Adapter Base Class

**File:** `scanner/phase2/adapters/base-adapter.js`

```javascript
export class BaseAdapter {
  constructor(config) {
    this.sourceType = config.sourceType;
    this.config = config;
  }

  /**
   * Fetch raw signals from source
   * Must be implemented by each adapter
   */
  async fetch() {
    throw new Error('fetch() must be implemented by subclass');
  }

  /**
   * Normalize source-specific format to RawSignal
   * Can be overridden for custom normalization
   */
  normalize(rawData) {
    return rawData; // Default: assume already in RawSignal format
  }

  /**
   * Get last fetch timestamp (for change detection)
   */
  async getLastFetchTime() {
    // Implementation: query database for last snapshot
  }
}
```

---

## Source Adapters (Priority Order)

### 1. ERCOT Queue Monitor (Highest Priority)

**Why First:**
- Structured data (JSON/CSV)
- Clear change signals (new entries, status changes)
- High value (direct infrastructure commitments)
- Relatively easy to parse

**Source:** ERCOT Interconnection Queue
- **URL:** https://www.ercot.com/gridinfo/queue
- **Format:** Likely HTML table or downloadable CSV
- **Frequency:** Daily (morning run)

**What to Extract:**
- New queue entries (status: "New", "Active")
- Status changes (approved, withdrawn, in-service)
- Project details:
  - Queue ID
  - Company name
  - Project name
  - MW capacity
  - Location (county, coordinates if available)
  - Fuel type
  - Interconnection point

**Implementation:** `scanner/phase2/adapters/ercot-adapter.js`

**Adapter Logic:**
```javascript
class ERCOTAdapter extends BaseAdapter {
  async fetch() {
    // 1. Scrape ERCOT queue page or download CSV
    // 2. Parse entries
    // 3. Compare with previous snapshot
    // 4. Return only new/changed entries as RawSignal[]
  }

  normalize(ercotEntry) {
    return {
      source_type: 'ERCOT_QUEUE',
      source_id: ercotEntry.queue_id,
      published_at: ercotEntry.date_added,
      url: `https://www.ercot.com/gridinfo/queue/${ercotEntry.queue_id}`,
      headline: `${ercotEntry.project_name} - ${ercotEntry.mw}MW ${ercotEntry.fuel_type}`,
      body_text: `Company: ${ercotEntry.company}\nLocation: ${ercotEntry.county}\nStatus: ${ercotEntry.status}`,
      metadata: {
        mw: ercotEntry.mw,
        fuel_type: ercotEntry.fuel_type,
        county: ercotEntry.county,
        company: ercotEntry.company,
        status: ercotEntry.status
      }
    };
  }
}
```

**Change Detection:**
- Track by `queue_id`
- Detect: NEW (new entry), CHANGED (status changed), WITHDRAWN (removed from queue)

**Classification Hints:**
- Status = "Approved" → COMMITMENT, event_type = "APPROVED"
- Status = "Withdrawn" → CONSTRAINT, event_type = "WITHDRAWN"
- Status = "New" → COMMITMENT, event_type = "FILED"

---

### 2. Texas PUC Filings

**Why Second:**
- Structured, official source
- High signal-to-noise ratio
- Important for regulatory constraints/commitments

**Source:** Texas Public Utility Commission
- **URL:** https://www.puc.texas.gov/
- **Format:** HTML listings, possibly searchable database
- **Frequency:** Daily

**What to Extract:**
- New filings (docket numbers)
- Filing type (rate case, infrastructure application, etc.)
- Company/utility name
- Filing date
- Summary/description
- Status (pending, approved, denied)

**Implementation:** `scanner/phase2/adapters/puc-adapter.js`

**Adapter Logic:**
```javascript
class PUCAdapter extends BaseAdapter {
  async fetch() {
    // 1. Scrape PUC filings page
    // 2. Filter for infrastructure-related filings
    // 3. Compare with previous snapshot
    // 4. Return new/changed filings as RawSignal[]
  }

  normalize(pucFiling) {
    return {
      source_type: 'TX_PUC',
      source_id: pucFiling.docket_number,
      published_at: pucFiling.filing_date,
      url: pucFiling.url,
      headline: `PUC Filing: ${pucFiling.title} (${pucFiling.docket_number})`,
      body_text: pucFiling.description,
      metadata: {
        docket_number: pucFiling.docket_number,
        filing_type: pucFiling.filing_type,
        company: pucFiling.company,
        status: pucFiling.status
      }
    };
  }
}
```

**Classification Hints:**
- Filing type = "Rate Case" → Could be COMMITMENT or CONSTRAINT
- Status = "Approved" → COMMITMENT
- Status = "Denied" → CONSTRAINT

---

### 3. RSS Feed Monitor

**Why Third:**
- Easier than courts
- Good coverage of news/press releases
- Multiple sources in one adapter

**Sources:**
- News sites (Austin Business Journal, Houston Chronicle, etc.)
- Press releases (utility companies, regulators)
- Industry publications

**Format:** RSS/Atom feeds
**Frequency:** Every 2 hours

**Implementation:** `scanner/phase2/adapters/rss-adapter.js`

**Adapter Logic:**
```javascript
class RSSAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.feeds = config.feeds; // Array of RSS feed URLs
  }

  async fetch() {
    const allSignals = [];
    
    for (const feedUrl of this.feeds) {
      // 1. Fetch RSS feed
      // 2. Parse entries
      // 3. Filter for infrastructure-related (keywords)
      // 4. Compare with previous snapshot
      // 5. Add to allSignals
    }
    
    return allSignals;
  }

  normalize(rssEntry) {
    return {
      source_type: 'RSS',
      source_id: rssEntry.guid || rssEntry.link,
      published_at: rssEntry.pubDate,
      url: rssEntry.link,
      headline: rssEntry.title,
      body_text: rssEntry.description || rssEntry.content,
      metadata: {
        feed_source: rssEntry.feedSource,
        author: rssEntry.author
      }
    };
  }
}
```

**Feed Configuration:**
```javascript
const RSS_FEEDS = [
  {
    url: 'https://www.bizjournals.com/austin/rss',
    source_name: 'Austin Business Journal',
    keywords: ['data center', 'power', 'infrastructure', 'zoning']
  },
  {
    url: 'https://www.houstonchronicle.com/rss',
    source_name: 'Houston Chronicle',
    keywords: ['data center', 'ERCOT', 'power plant']
  },
  // Add more feeds...
];
```

---

### 4. Court Docket Monitor (Lower Priority)

**Why Last:**
- Messy, fragmented (multiple court systems)
- Harder to parse
- Lower signal-to-noise

**Sources:**
- County court databases
- State court databases
- Federal court databases (if needed)

**Format:** Various (HTML, PDF, databases)
**Frequency:** Daily

**Implementation:** `scanner/phase2/adapters/court-adapter.js`

**Adapter Logic:**
```javascript
class CourtAdapter extends BaseAdapter {
  async fetch() {
    // 1. Query court databases for infrastructure-related cases
    // 2. Filter by keywords (data center, power plant, etc.)
    // 3. Compare with previous snapshot
    // 4. Return new cases as RawSignal[]
  }

  normalize(courtCase) {
    return {
      source_type: 'COURT_DOCKET',
      source_id: courtCase.case_number,
      published_at: courtCase.filing_date,
      url: courtCase.case_url,
      headline: `${courtCase.case_type}: ${courtCase.plaintiff} v. ${courtCase.defendant}`,
      body_text: courtCase.description,
      metadata: {
        case_number: courtCase.case_number,
        court: courtCase.court,
        case_type: courtCase.case_type,
        status: courtCase.status
      }
    };
  }
}
```

**Note:** This is the most complex adapter. Consider deferring or using a third-party service.

---

## Integration with Phase 1 Pipeline

### Reuse Phase 1 Components

All Phase 1 components work with adapters:

```
Adapter.fetch() → RawSignal[]
    ↓
SignalNormalizer.normalize() → Signal (schema)
    ↓
SignalClassifier.classify() → Classified Signal
    ↓
SignalDiffer.diff() → Change Detection
    ↓
SignalsDB.insertSignal() → Stored
```

**No changes needed to:**
- `signal-normalizer.js` (already handles RawSignal format)
- `signal-classifier.js` (works on any signal)
- `signal-differ.js` (compares by URL/source_id)
- `storage/signals-db.js` (schema already supports all sources)

**Only need to:**
- Create adapter classes
- Update `signal-ingester.js` to use adapters instead of Tavily

---

## Updated Signal Ingester

**File:** `scanner/phase2/signal-ingester-v2.js`

```javascript
import ERCOTAdapter from './adapters/ercot-adapter.js';
import PUCAdapter from './adapters/puc-adapter.js';
import RSSAdapter from './adapters/rss-adapter.js';
// ... other adapters

export class SignalIngesterV2 {
  constructor(db) {
    this.db = db;
    this.adapters = {
      ERCOT: new ERCOTAdapter({ sourceType: 'ERCOT_QUEUE' }),
      PUC: new PUCAdapter({ sourceType: 'TX_PUC' }),
      RSS: new RSSAdapter({ 
        sourceType: 'RSS',
        feeds: RSS_FEEDS 
      })
    };
    // Reuse Phase 1 components
    this.normalizer = new SignalNormalizer();
    this.classifier = new SignalClassifier();
    this.differ = new SignalDiffer();
  }

  async ingestFromSource(sourceType) {
    const adapter = this.adapters[sourceType];
    if (!adapter) {
      throw new Error(`Unknown source type: ${sourceType}`);
    }

    // 1. Fetch from adapter
    const rawSignals = await adapter.fetch();
    
    // 2. Normalize (already in RawSignal format, but ensure schema compliance)
    const normalizedSignals = rawSignals.map(s => 
      this.normalizer.normalizeRawSignal(s) // New method for RawSignal
    );

    // 3. Get previous snapshot
    const previousSnapshot = await this.db.getLatestSnapshot(sourceType, null);

    // 4. Diff
    const diffResult = this.differ.diff(normalizedSignals, previousSnapshot);

    // 5. Classify
    const classifiedSignals = [];
    for (const signal of normalizedSignals) {
      const classification = await this.classifier.classify(signal);
      signal.lane = classification.lane;
      signal.event_type = classification.event_type;
      signal.confidence = classification.confidence;
      signal.tags = JSON.stringify(classification.tags);
      classifiedSignals.push(signal);
    }

    // 6. Store
    for (const signal of classifiedSignals) {
      await this.db.insertSignal(signal);
    }

    // 7. Store snapshot
    await this.db.insertSnapshot({
      snapshot_id: generateSnapshotId(),
      source_type: sourceType,
      query: null, // No query for structured sources
      raw_payload: JSON.stringify(rawSignals)
    });

    return {
      source: sourceType,
      signalsFound: rawSignals.length,
      signalsNew: diffResult.newItems.length,
      signalsChanged: diffResult.changedItems.length
    };
  }

  async ingestAll() {
    const results = [];
    
    for (const [sourceType, adapter] of Object.entries(this.adapters)) {
      try {
        console.log(`\n📥 Ingesting from ${sourceType}...`);
        const result = await this.ingestFromSource(sourceType);
        results.push(result);
      } catch (error) {
        console.error(`❌ ${sourceType} ingestion failed:`, error.message);
        results.push({
          source: sourceType,
          error: error.message
        });
      }
    }

    return results;
  }
}
```

---

## Scheduler for Automated Runs

**File:** `scanner/phase2/scheduler.js`

```javascript
import cron from 'node-cron';
import SignalIngesterV2 from './signal-ingester-v2.js';
import SignalsDB from '../phase1/storage/signals-db.js';

export class ScannerScheduler {
  constructor() {
    this.db = new SignalsDB();
    this.ingester = null;
  }

  async start() {
    await this.db.connect();
    await this.db.init();
    this.ingester = new SignalIngesterV2(this.db);

    // ERCOT: Daily at 6 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('⏰ Running ERCOT ingestion...');
      await this.ingester.ingestFromSource('ERCOT');
    });

    // PUC: Daily at 7 AM
    cron.schedule('0 7 * * *', async () => {
      console.log('⏰ Running PUC ingestion...');
      await this.ingester.ingestFromSource('PUC');
    });

    // RSS: Every 2 hours
    cron.schedule('0 */2 * * *', async () => {
      console.log('⏰ Running RSS ingestion...');
      await this.ingester.ingestFromSource('RSS');
    });

    console.log('✅ Scheduler started');
  }

  async stop() {
    await this.db.close();
  }
}
```

**Run as service:**
```bash
node scanner/phase2/scheduler.js
```

---

## Enhanced Normalizer for RawSignal

**Update:** `scanner/phase2/signal-normalizer-v2.js`

Add method to handle RawSignal format:

```javascript
normalizeRawSignal(rawSignal) {
  // RawSignal is already close to our schema
  // Just need to generate signal_id, dedupe_key, and fill defaults
  
  const signalId = this.generateSignalId(
    rawSignal.source_type,
    rawSignal.source_id,
    rawSignal.url,
    rawSignal.published_at
  );
  
  const dedupeKey = this.generateDedupeKey(
    rawSignal.headline,
    rawSignal.url,
    rawSignal.source_type
  );

  return {
    ...rawSignal, // Keep all RawSignal fields
    signal_id: signalId,
    dedupe_key: dedupeKey,
    ingested_at: new Date().toISOString(),
    // Fill defaults if missing
    jurisdiction: rawSignal.metadata?.jurisdiction || DEFAULTS.jurisdiction,
    state: rawSignal.metadata?.state || DEFAULTS.state,
    // ... other defaults
  };
}
```

---

## Multi-Source Deduplication

**File:** `scanner/phase2/signal-deduplicator.js`

Link signals from different sources about the same event:

```javascript
export class SignalDeduplicator {
  /**
   * Find duplicate or related signals across sources
   */
  async findDuplicates(signal, db) {
    // Strategy 1: Exact URL match
    if (signal.url) {
      const urlMatch = await db.getSignalByUrl(signal.url);
      if (urlMatch) return urlMatch;
    }

    // Strategy 2: Fuzzy headline match
    const similarSignals = await db.getSignalsByFuzzyHeadline(
      signal.headline,
      threshold = 0.8
    );

    // Strategy 3: Company name + location + date match
    if (signal.metadata?.company && signal.metadata?.county) {
      const companyMatch = await db.getSignalsByCompanyAndLocation(
        signal.metadata.company,
        signal.metadata.county,
        dateRange = '30 days'
      );
      if (companyMatch.length > 0) {
        return companyMatch[0]; // Return most recent
      }
    }

    return null;
  }

  /**
   * Link related signals (same project, different sources)
   */
  async linkRelatedSignals(signal, db) {
    // Find signals with same company + location
    // Or same project name
    // Or same coordinates (if available)
  }
}
```

---

## Health Monitoring

**File:** `scanner/phase2/monitor/health-checker.js`

```javascript
export class HealthChecker {
  async checkAdapterHealth(adapter, sourceType) {
    try {
      const startTime = Date.now();
      const signals = await adapter.fetch();
      const duration = Date.now() - startTime;

      return {
        source: sourceType,
        status: 'healthy',
        signalsFound: signals.length,
        duration: duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        source: sourceType,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkAllAdapters(adapters) {
    const health = [];
    for (const [sourceType, adapter] of Object.entries(adapters)) {
      health.push(await this.checkAdapterHealth(adapter, sourceType));
    }
    return health;
  }
}
```

---

## Implementation Plan

### Week 1-2: ERCOT Adapter

**Tasks:**
1. Research ERCOT queue data format
   - Check if CSV/JSON available
   - Or need to scrape HTML
2. Build `ercot-adapter.js`
3. Test with Phase 1 pipeline
4. Verify change detection works
5. Add to scheduler

**Deliverable:** ERCOT queue monitoring working daily

### Week 3-4: PUC Adapter

**Tasks:**
1. Research PUC filings format
2. Build `puc-adapter.js`
3. Test with Phase 1 pipeline
4. Add to scheduler

**Deliverable:** PUC filings monitoring working daily

### Week 5: RSS Adapter

**Tasks:**
1. Identify relevant RSS feeds
2. Build `rss-adapter.js`
3. Test with Phase 1 pipeline
4. Add to scheduler (every 2 hours)

**Deliverable:** RSS monitoring working

### Week 6: Polish & Monitoring

**Tasks:**
1. Add health checks
2. Add error handling/retries
3. Add logging
4. Test all adapters together
5. Document

**Deliverable:** Production-ready Phase 2

---

## File Structure

```
scanner/
├── phase1/                    # Keep Phase 1 as-is
│   ├── scanner-cli.js
│   ├── signal-ingester.js
│   ├── signal-classifier.js
│   ├── signal-normalizer.js
│   ├── signal-differ.js
│   └── ...
├── phase2/
│   ├── adapters/
│   │   ├── base-adapter.js
│   │   ├── ercot-adapter.js
│   │   ├── puc-adapter.js
│   │   ├── rss-adapter.js
│   │   └── court-adapter.js
│   ├── signal-ingester-v2.js   # Updated ingester using adapters
│   ├── signal-normalizer-v2.js # Enhanced normalizer
│   ├── signal-deduplicator.js  # Multi-source deduplication
│   ├── scheduler.js             # Automated runs
│   └── monitor/
│       └── health-checker.js
└── config/
    └── scanner-config.js       # Shared config
```

---

## Success Metrics

### Phase 2 Goals:
- ✅ **ERCOT ingestion**: Daily runs, captures new queue entries
- ✅ **PUC ingestion**: Daily runs, captures new filings
- ✅ **RSS ingestion**: Every 2 hours, captures news
- ✅ **<5% duplicate rate** across all sources
- ✅ **95%+ uptime** for all adapters
- ✅ **500+ signals/day** from all sources combined

### Validation:
- Run all adapters for 1 week
- Verify change detection works correctly
- Verify deduplication doesn't collapse distinct projects
- Check health monitoring catches failures

---

## Dependencies to Add

```bash
cd scanner/phase2
npm install node-cron          # For scheduling
npm install rss-parser          # For RSS feeds
npm install cheerio             # For HTML scraping (if needed)
npm install puppeteer           # For JavaScript-heavy sites (if needed)
```

---

## Testing Strategy

### Unit Tests:
- Test each adapter's `fetch()` method
- Test normalization to RawSignal format
- Test change detection with mock snapshots

### Integration Tests:
- Test adapter → normalizer → classifier → differ → store pipeline
- Test scheduler runs
- Test health checks

### Manual Testing:
- Run each adapter manually
- Verify signals appear in database
- Verify change detection works
- Check for duplicates

---

## Risk Mitigation

### Adapter Failures:
- **Problem**: Source website changes format
- **Solution**: Health checks alert, fallback to cached data

### Rate Limiting:
- **Problem**: Too many requests to source
- **Solution**: Respect robots.txt, add delays, cache aggressively

### Parsing Errors:
- **Problem**: HTML structure changes
- **Solution**: Robust error handling, log failures, manual review queue

### Duplicate Signals:
- **Problem**: Same event from multiple sources
- **Solution**: Multi-source deduplication, fuzzy matching

---

## Next Steps

1. **Research ERCOT queue format** (1-2 days)
   - Check if API available
   - Check if CSV/JSON download available
   - Or need to scrape HTML

2. **Build ERCOT adapter** (1 week)
   - Implement `fetch()` method
   - Test with Phase 1 pipeline
   - Verify change detection

3. **Add to scheduler** (1 day)
   - Daily cron job
   - Error handling
   - Logging

4. **Repeat for PUC, RSS** (2-3 weeks)

5. **Add monitoring** (1 week)
   - Health checks
   - Alerts
   - Dashboard

---

## Questions to Answer Before Starting

1. **ERCOT Queue Format:**
   - Is there an API?
   - Is there a CSV/JSON download?
   - Or do we need to scrape HTML?

2. **PUC Filings:**
   - Is there a searchable database?
   - Or do we need to scrape listings?

3. **RSS Feeds:**
   - Which feeds are most relevant?
   - How to filter for infrastructure-related content?

4. **Court Dockets:**
   - Which court systems to monitor?
   - Is there a unified database?
   - Or need to scrape multiple systems?

---

## Ready to Start?

**First Task:** Research ERCOT queue data format and build the first adapter.

**Command to start:**
```bash
cd scanner/phase2
# Research ERCOT format, then build ercot-adapter.js
```

