# Phase 2 Implementation Reflection

## Executive Summary

The Phase 2 plan is **well-architected** with a solid adapter pattern and clear priorities. However, there are several **critical gaps** that need addressing before implementation, particularly around change detection for structured sources, error handling, and integration of deduplication.

**Overall Assessment:** ✅ Ready to proceed with modifications

---

## Strengths

### 1. Adapter Pattern Design
- **Excellent abstraction**: `RawSignal` interface makes downstream components source-agnostic
- **Clean separation**: Each adapter handles source-specific logic independently
- **Extensible**: Easy to add new sources without touching core pipeline

### 2. Priority Ordering
- **ERCOT first** is correct: Highest value, structured data, clear change signals
- **PUC second** makes sense: Official source, high signal-to-noise
- **RSS third** is pragmatic: Easier than courts, good coverage
- **Courts last** is wise: Most complex, can defer if needed

### 3. Phase 1 Reuse
- Smart to reuse normalizer, classifier, differ
- Minimizes code duplication
- Validates Phase 1 architecture

### 4. Change Detection Focus
- Correctly emphasizes "what changed?" over "what exists?"
- Snapshot-based diffing is the right approach

---

## Critical Gaps & Recommendations

### 1. **Change Detection for Structured Sources** ⚠️ HIGH PRIORITY

**Problem:**
- Current `SignalDiffer` compares by `url` (line 39-50 in `signal-differ.js`)
- ERCOT entries may not have unique URLs, but have `queue_id` (source_id)
- PUC filings have `docket_number` (source_id)
- Need flexible comparison key per source type

**Solution:**
Enhance `SignalDiffer` to support multiple comparison strategies:

```javascript
// In signal-differ.js
diff(newSignals, previousSnapshot, comparisonKey = 'url') {
  // comparisonKey can be: 'url', 'source_id', or custom function
  const getKey = (signal) => {
    if (comparisonKey === 'url') return signal.url;
    if (comparisonKey === 'source_id') return signal.source_id;
    if (typeof comparisonKey === 'function') return comparisonKey(signal);
    return signal[comparisonKey];
  };
  
  // Use getKey() instead of hardcoded s.url
}
```

**In adapter configuration:**
```javascript
// ERCOT adapter
const ERCOT_COMPARISON_KEY = (signal) => signal.source_id || signal.metadata?.queue_id;

// PUC adapter  
const PUC_COMPARISON_KEY = (signal) => signal.source_id || signal.metadata?.docket_number;

// RSS adapter (keep URL-based)
const RSS_COMPARISON_KEY = 'url';
```

**Action:** Update `signal-differ.js` before building ERCOT adapter

---

### 2. **Deduplication Integration** ⚠️ HIGH PRIORITY

**Problem:**
- `SignalDeduplicator` is defined but **not integrated** into `SignalIngesterV2` flow
- Should run **before classification** to avoid processing duplicates
- Multi-source deduplication is critical for Phase 2 success metric (<5% duplicate rate)

**Solution:**
Update `signal-ingester-v2.js` to include deduplication step:

```javascript
async ingestFromSource(sourceType) {
  // ... fetch and normalize ...
  
  // NEW: Step 3.5 - Deduplicate across sources
  console.log(`\n3.5️⃣ [Ingester] Checking for duplicates...`);
  const deduplicatedSignals = [];
  for (const signal of normalizedSignals) {
    const duplicate = await this.deduplicator.findDuplicates(signal, this.db);
    if (!duplicate) {
      deduplicatedSignals.push(signal);
    } else {
      console.log(`   🔗 Duplicate found: ${signal.headline} matches ${duplicate.signal_id}`);
      // Optionally link signals
      await this.deduplicator.linkRelatedSignals(signal, duplicate, this.db);
    }
  }
  
  // Continue with deduplicatedSignals instead of normalizedSignals
  // ...
}
```

**Action:** Integrate `SignalDeduplicator` into ingester flow before building adapters

---

### 3. **Error Handling & Resilience** ⚠️ MEDIUM PRIORITY

**Problem:**
- Adapters will fail (network issues, format changes, rate limits)
- No retry logic, exponential backoff, or graceful degradation
- Health checker exists but doesn't handle failures gracefully

**Solution:**
Add to `BaseAdapter`:

```javascript
export class BaseAdapter {
  constructor(config) {
    this.sourceType = config.sourceType;
    this.config = config;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // ms
  }

  async fetch() {
    throw new Error('fetch() must be implemented by subclass');
  }

  async fetchWithRetry() {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.fetch();
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`⚠️ [${this.sourceType}] Fetch failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  async getLastKnownGoodSnapshot(db) {
    // Fallback: return last successful snapshot if fetch fails
    const lastSnapshot = await db.getLatestSnapshot(this.sourceType, null);
    if (lastSnapshot) {
      console.warn(`⚠️ [${this.sourceType}] Using last known good snapshot from ${lastSnapshot.captured_at}`);
      return JSON.parse(lastSnapshot.raw_payload);
    }
    return [];
  }
}
```

**Action:** Add retry logic and fallback mechanisms before production deployment

---

### 4. **ERCOT Data Format Research** ⚠️ CRITICAL - BLOCKER

**Problem:**
- Plan assumes CSV/JSON or HTML scraping
- **No actual research done** on ERCOT queue format
- Could be:
  - Public API (unlikely but possible)
  - CSV/Excel download
  - HTML table (needs scraping)
  - JavaScript-rendered (needs Puppeteer)
  - Behind authentication (needs credentials)

**Solution:**
**DO THIS FIRST** before writing any code:

1. **Manual investigation** (1-2 hours):
   - Visit https://www.ercot.com/gridinfo/queue
   - Check browser DevTools → Network tab
   - Look for API calls, JSON responses
   - Check for "Download CSV" or "Export" buttons
   - Inspect HTML structure
   - Check robots.txt

2. **Document findings:**
   - Create `scanner/phase2/research/ERCOT_FORMAT.md`
   - Document: format, access method, update frequency, authentication needs

3. **Choose implementation approach:**
   - If API: Use `fetch()` directly
   - If CSV: Use `csv-parse` library
   - If HTML table: Use `cheerio` for parsing
   - If JS-rendered: Use `puppeteer` (slower, more complex)

**Action:** Research ERCOT format before Week 1-2 implementation starts

---

### 5. **Rate Limiting & Politeness** ⚠️ MEDIUM PRIORITY

**Problem:**
- RSS adapter runs every 2 hours (12 times/day per feed)
- No rate limiting per feed
- No respect for `robots.txt`
- Could get IP-banned or blocked

**Solution:**
Add rate limiting to `RSSAdapter`:

```javascript
class RSSAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.feeds = config.feeds;
    this.minDelayBetweenFeeds = 5000; // 5 seconds between feeds
    this.lastFetchTime = new Map(); // Track per feed
  }

  async fetch() {
    const allSignals = [];
    
    for (const feedConfig of this.feeds) {
      // Rate limiting: respect minimum delay
      const lastFetch = this.lastFetchTime.get(feedConfig.url);
      if (lastFetch) {
        const timeSinceLastFetch = Date.now() - lastFetch;
        if (timeSinceLastFetch < this.minDelayBetweenFeeds) {
          await new Promise(resolve => 
            setTimeout(resolve, this.minDelayBetweenFeeds - timeSinceLastFetch)
          );
        }
      }
      
      try {
        // Fetch RSS feed
        const signals = await this.fetchFeed(feedConfig);
        allSignals.push(...signals);
        this.lastFetchTime.set(feedConfig.url, Date.now());
      } catch (error) {
        console.error(`❌ [RSS] Failed to fetch ${feedConfig.url}:`, error.message);
        // Continue with other feeds
      }
    }
    
    return allSignals;
  }
}
```

**Action:** Add rate limiting before RSS adapter goes live

---

### 6. **Scheduler Error Handling** ⚠️ MEDIUM PRIORITY

**Problem:**
- Cron jobs in `scheduler.js` have no error handling
- If one adapter fails, others still run (good)
- But no alerting, no logging to file, no dead letter queue

**Solution:**
Enhance scheduler:

```javascript
cron.schedule('0 6 * * *', async () => {
  console.log('⏰ Running ERCOT ingestion...');
  try {
    const result = await this.ingester.ingestFromSource('ERCOT');
    // Log success
    await this.logResult('ERCOT', result);
  } catch (error) {
    // Log error
    console.error(`❌ ERCOT ingestion failed:`, error);
    await this.logError('ERCOT', error);
    // Optional: Send alert (email, Slack, etc.)
    await this.sendAlert('ERCOT', error);
  }
});
```

**Action:** Add error handling and logging before production

---

### 7. **Database Query Methods Missing** ⚠️ MEDIUM PRIORITY

**Problem:**
- `SignalDeduplicator` calls methods that may not exist:
  - `db.getSignalByUrl()`
  - `db.getSignalsByFuzzyHeadline()`
  - `db.getSignalsByCompanyAndLocation()`
- Need to verify these exist in `signals-db.js` or implement them

**Solution:**
Check `scanner/phase1/storage/signals-db.js` and add missing methods:

```javascript
// In signals-db.js
async getSignalByUrl(url) {
  const result = await this.db.get(
    'SELECT * FROM signals WHERE url = ? LIMIT 1',
    [url]
  );
  return result || null;
}

async getSignalsByFuzzyHeadline(headline, threshold = 0.8) {
  // Use SQLite FTS or implement fuzzy matching
  // For now, simple LIKE query (upgrade later)
  const pattern = `%${headline.substring(0, 20)}%`;
  return await this.db.all(
    'SELECT * FROM signals WHERE headline LIKE ?',
    [pattern]
  );
}

async getSignalsByCompanyAndLocation(company, county, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return await this.db.all(
    `SELECT * FROM signals 
     WHERE (company_entities LIKE ? OR metadata LIKE ?)
     AND county = ?
     AND ingested_at >= ?`,
    [`%${company}%`, `%${company}%`, county, cutoffDate.toISOString()]
  );
}
```

**Action:** Verify/add database query methods before building deduplicator

---

## Architecture Improvements

### 1. **Adapter Change Detection Strategy**

**Current Plan:** Adapter returns all entries, ingester diffs

**Alternative (Consider):** Adapter handles its own change detection

**Pros of Alternative:**
- More efficient (only return new/changed)
- Adapter can optimize for source-specific change detection
- Reduces data transfer

**Cons of Alternative:**
- Duplicates change detection logic
- Harder to debug (change detection in multiple places)
- Less consistent

**Recommendation:** Keep current plan (adapter returns all, ingester diffs) for consistency, but enhance differ to support `source_id` comparison.

---

### 2. **Normalization Strategy**

**Current Plan:** `normalizeRawSignal()` in normalizer-v2

**Consideration:** Should adapters normalize, or should normalizer handle all normalization?

**Recommendation:** Keep adapter `normalize()` method for source-specific formatting, but have normalizer-v2 do final schema compliance. This gives flexibility while maintaining consistency.

---

## Implementation Timeline Adjustments

### Original Timeline: 4-6 weeks

**Recommended Adjustments:**

**Week 0 (Before Week 1):** Research Phase
- Research ERCOT format (1-2 days)
- Research PUC format (1 day)
- Identify RSS feeds (1 day)
- **Total: 3-4 days**

**Week 1-2:** ERCOT Adapter (as planned)
- But add: Enhanced differ with `source_id` support
- Add: Deduplication integration
- **Deliverable:** ERCOT working + enhanced pipeline

**Week 3-4:** PUC Adapter (as planned)
- **Deliverable:** PUC working

**Week 5:** RSS Adapter (as planned)
- But add: Rate limiting
- **Deliverable:** RSS working

**Week 6:** Polish & Monitoring (as planned)
- Add: Error handling/retries
- Add: Scheduler error handling
- Add: Health checks
- **Deliverable:** Production-ready

**New Total: 6-7 weeks** (add 1 week for research and enhancements)

---

## Missing Considerations

### 1. **Testing Strategy Needs Detail**

**Current:** Mentions unit/integration tests but no specifics

**Add:**
- Mock adapters for testing
- Test fixtures for ERCOT/PUC data formats
- Integration test that runs full pipeline
- Test change detection with real snapshots

### 2. **Monitoring & Observability**

**Current:** Health checker exists but no metrics/alerting

**Add:**
- Metrics: signals/day per source, error rates, processing time
- Alerts: adapter failures, high error rates, duplicate rate > threshold
- Dashboard: Simple web UI showing health status (optional)

### 3. **Data Retention**

**Current:** No mention of snapshot retention

**Add:**
- Policy: Keep last N snapshots per source (e.g., last 30 days)
- Cleanup job: Remove old snapshots
- Archive: Optionally archive old snapshots to cold storage

### 4. **Configuration Management**

**Current:** Hardcoded feed URLs, schedules

**Add:**
- Config file: `scanner/phase2/config/adapters.json`
- Environment-specific configs (dev/staging/prod)
- Runtime config updates (without code changes)

---

## Questions to Resolve

### Before Starting Implementation:

1. **ERCOT Format:** ⚠️ BLOCKER
   - What is the actual data format?
   - Is authentication required?
   - How often does it update?

2. **PUC Format:** 
   - Is there a searchable database or just HTML listings?
   - What's the update frequency?

3. **RSS Feeds:**
   - Which feeds are most relevant? (Plan has examples but needs validation)
   - How to filter for infrastructure-related content? (Keywords list needs refinement)

4. **Court Dockets:**
   - Defer for now? (Plan says "lower priority")
   - Or start research in parallel?

5. **Database:**
   - Keep SQLite or move to PostgreSQL?
   - SQLite fine for Phase 2, but PostgreSQL better for Phase 3

---

## Recommended Action Plan

### Immediate (Before Coding):

1. ✅ **Research ERCOT format** (1-2 days)
   - Document in `scanner/phase2/research/ERCOT_FORMAT.md`
   - Decide on implementation approach

2. ✅ **Enhance SignalDiffer** (1 day)
   - Add `source_id` comparison support
   - Test with mock ERCOT data

3. ✅ **Integrate Deduplicator** (1 day)
   - Add to ingester flow
   - Verify database query methods exist

### Week 1-2 (ERCOT):

4. ✅ **Build BaseAdapter** (1 day)
   - Add retry logic
   - Add error handling

5. ✅ **Build ERCOTAdapter** (1 week)
   - Implement fetch() based on research
   - Test with Phase 1 pipeline
   - Verify change detection

6. ✅ **Add to scheduler** (1 day)
   - Daily cron job
   - Error handling
   - Logging

### Week 3-4 (PUC):

7. ✅ **Research PUC format** (1 day)
8. ✅ **Build PUCAdapter** (1 week)
9. ✅ **Add to scheduler** (1 day)

### Week 5 (RSS):

10. ✅ **Identify RSS feeds** (1 day)
11. ✅ **Build RSSAdapter** (3 days)
    - Add rate limiting
12. ✅ **Add to scheduler** (1 day)

### Week 6 (Polish):

13. ✅ **Add monitoring** (2 days)
14. ✅ **Add error handling** (2 days)
15. ✅ **Test all adapters** (1 day)
16. ✅ **Document** (1 day)

---

## Success Criteria Validation

### Original Metrics:
- ✅ **500+ signals/day** - Reasonable if ERCOT + PUC + RSS all working
- ✅ **<5% duplicate rate** - Achievable with good deduplication
- ✅ **95%+ uptime** - Requires robust error handling (addressed above)

### Additional Metrics to Track:
- **Adapter success rate** (per source, per day)
- **Average processing time** (per source)
- **Classification accuracy** (manual spot checks)
- **Change detection accuracy** (verify no false positives/negatives)

---

## Conclusion

**Phase 2 plan is solid** but needs these enhancements before implementation:

1. ⚠️ **Research ERCOT format** (blocker)
2. ⚠️ **Enhance differ for `source_id` comparison** (critical)
3. ⚠️ **Integrate deduplicator** (critical)
4. ⚠️ **Add error handling/retries** (important)
5. ⚠️ **Add rate limiting** (important)

**Timeline:** 6-7 weeks (add 1 week for research and enhancements)

**Recommendation:** ✅ Proceed with Phase 2, but address critical gaps first.

