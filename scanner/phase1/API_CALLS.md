# Phase 1 API Call Locations

## Overview

**Only one API is used in Phase 1: Perplexity AI**

All API calls go to: `https://api.perplexity.ai/chat/completions`

---

## API Call #1: Discovery/Ingestion

**Location**: `signal-ingester.js` → `api-clients/perplexity-client.js`

**When**: User runs `node scanner-cli.js ingest --query "..."`

**Flow**:
```
scanner-cli.js
  ↓
signal-ingester.js
  ↓
perplexity-client.js
  ↓
POST https://api.perplexity.ai/chat/completions
```

**Request**:
```javascript
{
  method: 'POST',
  url: 'https://api.perplexity.ai/chat/completions',
  headers: {
    'Authorization': `Bearer ${process.env.REACT_APP_PRP}`,
    'Content-Type': 'application/json'
  },
  body: {
    model: 'sonar-pro',  // or 'sonar' for cheaper
    messages: [{
      role: 'user',
      content: 'Recent data center moratoriums or zoning denials in Texas'
    }],
    max_tokens: 2000,
    temperature: 0.1,
    return_citations: true
  }
}
```

**Purpose**: Find signals via Perplexity search queries

**Cost Governor**: Limited by `SCANNER_MAX_PERPLEXITY_CALLS` (default: 10 per run)

---

## API Call #2: Classification Fallback

**Location**: `signal-classifier.js` → `api-clients/perplexity-client.js`

**When**: Regex classification confidence < MED (or no match)

**Flow**:
```
signal-classifier.js
  ↓ (only if regex fails)
perplexity-client.js
  ↓
POST https://api.perplexity.ai/chat/completions
```

**Request**:
```javascript
{
  method: 'POST',
  url: 'https://api.perplexity.ai/chat/completions',
  headers: {
    'Authorization': `Bearer ${process.env.REACT_APP_PRP}`,
    'Content-Type': 'application/json'
  },
  body: {
    model: 'sonar-pro',
    messages: [{
      role: 'user',
      content: `Classify this signal into COMMITMENT or CONSTRAINT:

Signal: {headline}
Raw text: {raw_text}
Source: {source_type}

Return JSON:
{
  "lane": "COMMITMENT" | "CONSTRAINT" | "CONTEXT",
  "event_type": "...",
  "confidence": "LOW" | "MED" | "HIGH",
  "reasoning": "brief explanation"
}`
    }],
    max_tokens: 500,  // Smaller for classification
    temperature: 0.1
  }
}
```

**Purpose**: Classify ambiguous signals when regex rules don't match

**Cost Governor**: 
- Only called if regex confidence < MED
- Limited by `SCANNER_MAX_PERPLEXITY_CALLS`
- Results cached by `dedupe_key`

---

## No Other API Calls

**Phase 1 does NOT call:**
- ❌ Tavily API
- ❌ OpenAI API
- ❌ Mixtral API
- ❌ Any other external APIs

**All external communication is via Perplexity AI only.**

---

## Cost Control

**Settings** (in `.env`):
```bash
SCANNER_MAX_PERPLEXITY_CALLS=10    # Max calls per ingestion run
SCANNER_MAX_TOKENS=500              # Max tokens per call (classification)
SCANNER_PERPLEXITY_MODEL=sonar-pro  # or 'sonar' for cheaper
```

**Caching**:
- Classification results cached by `dedupe_key`
- Same signal won't trigger multiple classification calls

**Skip Conditions**:
- Classification API call skipped if regex confidence ≥ MED
- Discovery API call always made (it's the primary ingestion method)

---

## Example Flow

**User runs**: `node scanner-cli.js ingest --query "data center moratorium Texas"`

1. **API Call #1** (Discovery):
   - `signal-ingester.js` calls Perplexity
   - Gets search results about data center moratoriums
   - Returns array of articles/signals

2. **Normalization**:
   - Each result normalized to schema
   - No API calls

3. **Classification**:
   - Regex rules run first (no API call)
   - If regex matches → classification done (no API call)
   - If regex fails → **API Call #2** (Classification Fallback)

4. **Change Detection**:
   - Compare against previous snapshot
   - No API calls

5. **Storage**:
   - Save to database
   - No API calls

**Total API Calls**: 1-2 per signal (1 discovery + 0-1 classification)

