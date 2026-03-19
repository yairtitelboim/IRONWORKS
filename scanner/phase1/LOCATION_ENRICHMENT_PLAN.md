# Location Enrichment Plan: Increasing News County Coverage

## Current State

**Database Analysis:**
- **Total News Signals**: 71
- **With County**: 8 (11.3%)
- **With City**: 2 (2.8%)
- **No Location**: 61 (85.9%)

**By Lane:**
- **COMMITMENT**: 22 total, 3 with county (13.6%)
- **CONSTRAINT**: 29 total, 1 with county (3.4%)
- **CONTEXT**: 20 total, 4 with county (20%)

**Key Insight**: CONTEXT stories may legitimately have no location - they're general news, not location-specific events.

---

## Strategy: Multi-Layer Location Extraction

### Phase 1: Enhanced Regex Extraction (No API Cost)

**Current Issues:**
- Only 3 basic patterns
- Doesn't extract from URLs
- Doesn't handle city-to-county mapping
- Misses addresses

**Improvements:**

1. **URL Pattern Extraction**
   - Extract from domain: `fortworthreport.org` → Fort Worth → Tarrant County
   - Extract from path: `/austin/...` → Austin → Travis County
   - Extract from subdomain: `dallas.news.com` → Dallas → Dallas County

2. **Enhanced Text Patterns**
   - Address patterns: `123 Main St, Austin, TX` → Austin → Travis County
   - City + State: `in Dallas, Texas` → Dallas → Dallas County
   - County mentions: `Hood County` → Hood County
   - Regional: `North Texas`, `DFW area` → Map to counties

3. **City-to-County Mapping**
   - Texas major cities database
   - Fort Worth → Tarrant County
   - San Marcos → Hays County
   - Austin → Travis County
   - Dallas → Dallas County
   - Houston → Harris County
   - etc.

4. **Address Parsing**
   - `123 Main St, Austin, TX 78701` → Austin → Travis County
   - `near Austin` → Austin → Travis County
   - `Austin area` → Austin → Travis County

**Expected Improvement**: 11.3% → ~30-40% (no API cost)

---

### Phase 2: Perplexity Location Enrichment (Selective API Use)

**When to Use:**
- Only for CONSTRAINT/COMMITMENT signals (not CONTEXT)
- Only when regex extraction fails
- Only when signal has location hints but no county

**Implementation:**

1. **New Method**: `enrichLocationWithPerplexity(signal)`
   - Check if already has county → skip
   - Check if CONTEXT lane → skip (legitimately may have no location)
   - Check if has location hints (city, address, region) → enrich
   - Call Perplexity with focused prompt

2. **Perplexity Prompt:**
```
Extract the specific Texas county from this news article. 
If no county is mentioned, return null.

Article: {headline}
Content: {raw_text}

Return JSON only:
{
  "county": "Travis" | null,
  "city": "Austin" | null,
  "confidence": "HIGH" | "MED" | "LOW",
  "reasoning": "brief explanation"
}
```

3. **Cost Control:**
   - Only for CONSTRAINT/COMMITMENT (51 signals)
   - Only when regex fails (~40 signals)
   - Max 40 API calls per ingestion run
   - Cache results by `dedupe_key`

**Expected Improvement**: 30-40% → ~50-60% (with API cost)

---

### Phase 3: Post-Processing Enhancement

**After Extraction:**

1. **Validation**
   - Check if extracted county exists in Texas counties list
   - Normalize county names (remove "County" suffix)
   - Handle common misspellings

2. **Confidence Scoring**
   - HIGH: Direct county mention or city-to-county mapping
   - MED: Perplexity extraction with good reasoning
   - LOW: Inferred from region or weak signals

3. **Fallback Logic**
   - If county extraction fails but city found → use city-to-county mapping
   - If region found → mark as "Region: DFW" (not clickable, but informative)

---

## Implementation Plan

### Step 1: Enhanced Regex Extraction

**File**: `scanner/phase1/signal-normalizer.js`

**Add Methods:**
1. `extractLocationFromUrl(url)` - Extract from URL patterns
2. `extractLocationFromAddress(text)` - Parse addresses
3. `mapCityToCounty(city)` - City-to-county lookup
4. `extractLocationFromRegion(text)` - Regional patterns

**Texas Cities Database:**
```javascript
const TEXAS_CITY_TO_COUNTY = {
  'Austin': 'Travis',
  'Dallas': 'Dallas',
  'Fort Worth': 'Tarrant',
  'Houston': 'Harris',
  'San Antonio': 'Bexar',
  'San Marcos': 'Hays',
  'El Paso': 'El Paso',
  // ... more cities
};
```

### Step 2: Perplexity Location Enrichment

**File**: `scanner/phase1/api-clients/perplexity-client.js`

**Add Method:**
```javascript
async extractLocation(signal) {
  // Only for CONSTRAINT/COMMITMENT
  // Only when regex fails
  // Only when has location hints
}
```

**File**: `scanner/phase1/signal-normalizer.js`

**Modify**: `normalizeTavilyResult()`
- Try regex extraction first
- If fails and is CONSTRAINT/COMMITMENT → try Perplexity
- Store result with confidence level

### Step 3: Integration

**File**: `scanner/phase1/signal-ingester.js`

**Modify**: `ingest()`
- After normalization, check for missing counties
- For CONSTRAINT/COMMITMENT signals without county → enrich
- Track enrichment stats

---

## Expected Outcomes

### Coverage Improvement

| Phase | Method | Expected Coverage | API Calls |
|-------|--------|-------------------|-----------|
| Current | Basic regex | 11.3% (8/71) | 0 |
| Phase 1 | Enhanced regex | 30-40% (21-28/71) | 0 |
| Phase 2 | + Perplexity | 50-60% (35-43/71) | ~40 max |
| Phase 3 | + Validation | 55-65% (39-46/71) | ~40 max |

### By Lane (After Phase 2)

- **CONSTRAINT**: 29 signals → ~15-20 with county (52-69%)
- **COMMITMENT**: 22 signals → ~12-15 with county (55-68%)
- **CONTEXT**: 20 signals → ~4-8 with county (20-40%) - *legitimately may have no location*

---

## Cost Analysis

**Perplexity API:**
- Cost: ~$0.001-0.002 per call (sonar-pro model)
- Max calls per run: 40 (only CONSTRAINT/COMMITMENT without county)
- Max cost per run: ~$0.04-0.08
- Monthly (10 runs): ~$0.40-0.80

**Cost-Benefit**: Very low cost for significant coverage improvement.

---

## Implementation Priority

1. **Phase 1 (Enhanced Regex)** - Immediate
   - No API cost
   - Quick to implement
   - 2-3x coverage improvement

2. **Phase 2 (Perplexity)** - Next
   - Low API cost
   - Significant improvement
   - Only for high-value signals (CONSTRAINT/COMMITMENT)

3. **Phase 3 (Validation)** - Polish
   - Quality improvements
   - Better confidence scoring

---

## Key Considerations

1. **CONTEXT Signals**: May legitimately have no location - don't force enrichment
2. **Cost Control**: Only use Perplexity for CONSTRAINT/COMMITMENT signals
3. **Caching**: Cache Perplexity results to avoid duplicate calls
4. **Confidence**: Track confidence levels for future filtering
5. **Fallback**: Always have graceful fallback if Perplexity fails

---

## Testing Plan

1. **Test Enhanced Regex**:
   - Run on existing 71 signals
   - Measure improvement
   - Verify no false positives

2. **Test Perplexity Enrichment**:
   - Test on 10 signals without county
   - Verify accuracy
   - Check cost

3. **Test Full Pipeline**:
   - Run complete ingestion
   - Measure final coverage
   - Verify clickable county buttons work

---

## Success Metrics

- **Coverage**: 11.3% → 50-60% (4-5x improvement)
- **Cost**: <$1/month for Perplexity calls
- **Accuracy**: >90% correct county extraction
- **Performance**: <2s additional processing time per signal

---

## Next Steps

1. Implement Phase 1 (Enhanced Regex)
2. Test on existing signals
3. Implement Phase 2 (Perplexity) if needed
4. Monitor coverage and cost
5. Iterate based on results

