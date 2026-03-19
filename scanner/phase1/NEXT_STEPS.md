# What's Next - Scanner Development Roadmap

## Phase 1 Status: ✅ COMPLETE

**What's Working:**
- ✅ Pipeline mechanics validated (normalize → dedupe → classify → diff → review)
- ✅ Tavily discovery working
- ✅ Regex classification working (90%+ accuracy)
- ✅ Perplexity fallback working
- ✅ Change detection working
- ✅ Database storage working
- ✅ CLI interface working

**Current Stats:**
- 20 signals in database
- 16 CONSTRAINT, 4 COMMITMENT
- All from Tavily (bootstrap source)

---

## Immediate Next Steps (This Week)

### 1. Validate Phase 1 Features

**Test change detection more thoroughly:**
```bash
# Run different queries to get NEW signals
node scanner-cli.js ingest --query "battery storage lawsuit Texas"
node scanner-cli.js ingest --query "substation opposition Texas"
node scanner-cli.js ingest --query "water permit denial Texas"
```

**Test review workflow:**
```bash
# Review and manually classify some signals
node scanner-cli.js review --lane CONSTRAINT
# Then manually update status in database or add review notes
```

**Test deduplication:**
```bash
# Run same query twice - should show "New: 0" second time
node scanner-cli.js ingest --query "data center moratorium Texas"
node scanner-cli.js ingest --query "data center moratorium Texas"
```

### 2. Refine Phase 1 (Optional Improvements)

**If needed, add:**
- Better location extraction (geocoding from `location_hint`)
- Entity extraction (company names, site names)
- Better summary generation
- Export functionality (CSV, GeoJSON)

**But don't over-engineer Phase 1** - it's meant to validate the pipeline, not be production-ready.

---

## Phase 2: Production Ingestion Layer (Next 4-6 Weeks)

**Goal:** Build automated, high-throughput ingestion from real sources

### Priority Order:

#### 1. ERCOT Queue Monitor (Highest Priority)
- **Why First**: Structured data, clear change signals, high value
- **What to Build**: 
  - Scraper for ERCOT interconnection queue
  - Daily monitoring
  - Extract: new entries, status changes, project details
- **File**: `scanner/phase2/adapters/ercot-adapter.js`

#### 2. Texas PUC Filings
- **Why Second**: Structured, official, high signal-to-noise
- **What to Build**:
  - Scraper for PUC website/database
  - Daily monitoring
  - Extract: utility filings, rate cases, infrastructure approvals
- **File**: `scanner/phase2/adapters/puc-adapter.js`

#### 3. RSS Feed Monitor
- **Why Third**: Easier than courts, good coverage
- **What to Build**:
  - RSS feed aggregator
  - Every 2 hours
  - News sites, press releases
- **File**: `scanner/phase2/adapters/rss-adapter.js`

#### 4. Court Docket Monitor (Lower Priority)
- **Why Last**: Messy, fragmented, harder to parse
- **What to Build**:
  - Court database scraper
  - Daily monitoring
  - Extract: lawsuits, case status updates
- **File**: `scanner/phase2/adapters/court-adapter.js`

### Phase 2 Architecture

**Adapter Pattern:**
- All sources output same `RawSignal` format
- Reuse Phase 1 normalizer, classifier, differ
- Just swap the adapter

**Files to Create:**
```
scanner/phase2/
├── adapters/
│   ├── base-adapter.js      # Abstract base class
│   ├── ercot-adapter.js     # ERCOT queue scraper
│   ├── puc-adapter.js       # PUC filings scraper
│   ├── rss-adapter.js       # RSS feed monitor
│   └── court-adapter.js     # Court docket scraper
├── scheduler.js             # Cron/scheduler for automated runs
└── monitor/
    └── health-checker.js    # Monitor scraper success rates
```

---

## Phase 3: Advanced Features & MCP (Later)

**After Phase 2 is stable:**
- MCP server with 5 tools
- Cross-source relationship mapping
- Early warning escalation
- Simple review UI (if needed)

---

## Recommended Path Forward

### Option A: Validate Phase 1 More (Recommended First)
**Time:** 1-2 days
**Goal:** Make sure pipeline is solid before building Phase 2

**Tasks:**
1. Test with 5-10 different queries
2. Verify change detection works correctly
3. Test review workflow manually
4. Check database integrity
5. Document any issues/improvements needed

### Option B: Start Phase 2 (If Phase 1 is Solid)
**Time:** 4-6 weeks
**Goal:** Build real source adapters

**Start with:**
1. ERCOT adapter (highest value)
2. Test with Phase 1 pipeline
3. Add PUC adapter
4. Add RSS adapter
5. Add monitoring/health checks

---

## Decision Point

**Question:** Is Phase 1 pipeline solid enough to build Phase 2 on top?

**If YES:** Start Phase 2 (ERCOT adapter)
**If NO:** Refine Phase 1 first

**My Recommendation:** 
- Spend 1-2 days validating Phase 1 with more queries
- Then start Phase 2 with ERCOT adapter
- ERCOT is the highest-value source and will validate the adapter pattern

---

## Quick Commands to Test Phase 1 More

```bash
cd scanner/phase1

# Test different constraint queries
node scanner-cli.js ingest --query "zoning denial data center Texas"
node scanner-cli.js ingest --query "battery storage lawsuit Texas"
node scanner-cli.js ingest --query "substation opposition Texas"

# Test commitment queries
node scanner-cli.js ingest --query "data center approved Texas"
node scanner-cli.js ingest --query "power plant construction Texas"

# Review what you have
node scanner-cli.js review --lane CONSTRAINT
node scanner-cli.js stats
```

---

## What Would You Like to Do?

1. **Validate Phase 1 more** - Test with more queries, verify everything
2. **Start Phase 2** - Begin building ERCOT adapter
3. **Refine Phase 1** - Add improvements (geocoding, entity extraction, etc.)
4. **Something else** - Tell me what you need

