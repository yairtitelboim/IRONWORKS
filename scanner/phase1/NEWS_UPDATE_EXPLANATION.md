# News Update Process - How It Works

## Overview

The **News** refresh button uses **Tavily API** to search for recent news articles matching a specific query, then processes and stores them as signals.

---

## How It Works

### 1. User Clicks "News" Refresh Button

When the user clicks the News refresh button in the UI:
- Frontend sends `POST /api/scanner/ingest/news` 
- Includes a search query: `"data center" (moratorium OR lawsuit OR zoning) Texas`
- Shows notification: "Starting News ingestion..."

### 2. Backend Triggers Tavily Search

The server endpoint (`server.js`):
- Creates a `SignalIngester` (Phase 1, not Phase 2)
- Uses the provided query or defaults to: `"data center" (moratorium OR lawsuit OR zoning) Texas`
- Calls `ingester.ingest(query, 'TAVILY')`
- **Returns immediately** (non-blocking, async processing)

### 3. Tavily API Search (`tavily-client.js`)

The `TavilyClient`:
- Makes POST request to `https://api.tavily.com/search`
- Sends:
  ```json
  {
    "api_key": "YOUR_TAVILY_API_KEY",
    "query": "\"data center\" (moratorium OR lawsuit OR zoning) Texas",
    "search_depth": "advanced",
    "max_results": 10
  }
  ```
- Tavily searches across news sources, blogs, and websites
- Returns array of results with:
  - `title`: Article headline
  - `url`: Article URL
  - `content`: Article content/snippet
  - `published_date`: When article was published
  - `score`: Relevance score

### 4. Signal Processing (`signal-ingester.js`)

The `SignalIngester` processes Tavily results:

**Step 1: Normalize Results**
- Converts Tavily results to `RawSignal` format
- Maps fields: `title` → `headline`, `content` → `body_text`, etc.
- Generates `signal_id` and `dedupe_key`

**Step 2: Load Previous Snapshot**
- Gets the latest snapshot for this query from database
- Used for change detection

**Step 3: Change Detection**
- Compares new results against previous snapshot
- Detects:
  - **New items**: Articles not in previous snapshot
  - **Changed items**: Articles that were updated
  - **Withdrawn items**: Articles that disappeared from results

**Step 4: Classify Signals**
- Uses `SignalClassifier` to determine:
  - `lane`: CONSTRAINT, COMMITMENT, or CONTEXT
  - `event_type`: MORATORIUM, LAWSUIT, ZONING, etc.
  - `confidence`: HIGH, MEDIUM, or LOW
  - `tags`: Relevant tags

**Step 5: Store Signals**
- Stores new and changed signals in database
- Creates new snapshot with current results

### 5. Frontend Updates

The frontend:
- Waits 3 seconds after API call
- Refreshes the signal list (`fetchSignals`)
- Shows notification: "News signals refreshed!"

---

## Key Differences from ERCOT

| Aspect | News (Tavily) | ERCOT (GIS Reports) |
|--------|---------------|---------------------|
| **Data Source** | Tavily API (search engine) | ERCOT website (CSV files) |
| **Update Frequency** | **Real-time** (searches current web) | **Monthly** (published reports) |
| **Query-Based** | ✅ Yes - searches for specific terms | ❌ No - downloads entire dataset |
| **Ingester** | Phase 1 (`SignalIngester`) | Phase 2 (`SignalIngesterV2`) |
| **Change Detection** | URL-based comparison | `source_id`-based comparison |
| **API Dependency** | Requires Tavily API key | No API key needed |
| **Cost** | API calls cost credits | Free (web scraping) |

---

## Default Search Query

The default query used is:
```
"data center" (moratorium OR lawsuit OR zoning) Texas
```

This searches for:
- Articles containing "data center"
- AND one of: moratorium, lawsuit, or zoning
- Related to Texas

**Why this query?**
- Focuses on **constraints** (moratoriums, lawsuits, zoning issues)
- Targets **data center** projects specifically
- Limits to **Texas** (ERCOT jurisdiction)

---

## Update Frequency

**News updates are REAL-TIME**:
- Each click searches Tavily's current index
- Tavily indexes news from thousands of sources
- Results reflect what's currently available online
- No fixed schedule - searches happen on-demand

**When to refresh:**
- **As needed**: Click when you want to check for new articles
- **Daily**: Check once per day for new developments
- **After events**: Check after major news events

---

## Tavily API Details

### Endpoint
- **URL**: `https://api.tavily.com/search`
- **Method**: POST
- **Authentication**: API key in request body

### Parameters
- `api_key`: Your Tavily API key
- `query`: Search query string
- `search_depth`: "basic" or "advanced" (advanced = deeper search)
- `max_results`: Number of results to return (default: 10)

### Rate Limits
- Depends on your Tavily plan
- Free tier: Limited requests
- Paid tiers: Higher limits
- Check usage: `scanner/phase1/test-tavily-api.js`

---

## Change Detection Logic

News uses **URL-based change detection**:
- Compares new results against previous snapshot by URL
- If same URL appears again → "CHANGED" (content may have updated)
- If new URL → "NEW"
- If URL disappeared → "WITHDRAWN"

**Why URL-based?**
- News articles have unique URLs
- Same article can be updated over time
- Articles can disappear from search results

---

## Classification Rules

The `SignalClassifier` analyzes article content to determine:

**CONSTRAINT** (Red badge):
- Keywords: "moratorium", "ban", "prohibition", "lawsuit", "opposition"
- Indicates barriers to development

**COMMITMENT** (Green badge):
- Keywords: "approved", "permit", "construction", "groundbreaking"
- Indicates confirmed projects

**CONTEXT** (Blue badge):
- General news, discussions, planning stages
- Default if no specific keywords found

---

## Error Handling

**If Tavily API fails:**
- Error logged to console
- Frontend shows error notification
- No signals stored
- Previous signals remain in database

**If API key is invalid:**
- Tavily returns 401 Unauthorized
- Error message indicates API key issue
- Check `TAVILY_API_KEY` environment variable

**If no results found:**
- Returns success with 0 signals
- No error - just means no articles matched query

---

## Cost Considerations

**Tavily API Usage:**
- Each search = 1 API call
- Costs depend on your Tavily plan
- Free tier: Limited credits
- Paid tiers: More credits available

**Optimization:**
- Default query returns max 10 results
- Can adjust `max_results` in `tavily-client.js`
- Consider caching results if running frequently

---

## Files Involved

1. **Frontend**: `src/components/Map/components/ScannerSignalsPanel.jsx`
   - `handleRefreshNews()` function

2. **Backend API**: `server.js`
   - `/api/scanner/ingest/news` endpoint

3. **Ingester**: `scanner/phase1/signal-ingester.js`
   - Main ingestion logic

4. **Tavily Client**: `scanner/phase1/api-clients/tavily-client.js`
   - API communication

5. **Normalizer**: `scanner/phase1/signal-normalizer.js`
   - Converts Tavily results to signals

6. **Classifier**: `scanner/phase1/signal-classifier.js`
   - Categorizes signals

---

## Example Flow

```
User clicks "News" button
  ↓
Frontend: POST /api/scanner/ingest/news
  ↓
Server: Create SignalIngester
  ↓
TavilyClient: Search API
  ↓
Tavily API: Returns 10 articles
  ↓
SignalIngester: Normalize results
  ↓
SignalDiffer: Compare with snapshot
  ↓
SignalClassifier: Classify each article
  ↓
Database: Store new/changed signals
  ↓
Frontend: Refresh signal list
  ↓
User sees new articles in feed
```

---

## Testing

To test Tavily API directly:
```bash
node scanner/phase1/test-tavily-api.js
```

This will:
- Check API key validity
- Test a search query
- Show usage/credits remaining
- Display result structure

---

## Summary

**News updates are:**
- ✅ **Real-time**: Searches current web content
- ✅ **Query-based**: Searches for specific terms
- ✅ **On-demand**: Happens when button is clicked
- ✅ **API-powered**: Uses Tavily search service
- ✅ **Change-aware**: Detects new/updated articles

**Unlike ERCOT:**
- ERCOT = Monthly CSV downloads
- News = Real-time web search

