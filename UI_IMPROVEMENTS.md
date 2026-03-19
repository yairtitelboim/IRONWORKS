# UI Improvements (PHA / Switchyard)

This doc outlines a lightweight set of UI changes to turn the existing **LocationSearchCard** into a “killer feature” for the 4–6 week test.

**Goal:** When a user searches an address, they should immediately see a clear, shareable verdict (a scorecard) using **deterministic, DB-backed metrics** (no paid AI calls per search).

**Primary component:**
- `src/components/Map/components/Cards/LocationSearchCard.jsx`

**Related logic (data contract):**
- `src/hooks/useAIQuery.js` (creates `responseMetadata`)
- `api/location-queue-metrics.js` (serverless queue metrics endpoint; KV cached)

---

## 0) Guiding Principles

- **Fast + mobile-first:** First meaningful paint should not wait on long network calls.
- **Deterministic:** Use Supabase/KV-backed metrics; no live-web crawling on user search.
- **Clear verdict:** Don’t make the user interpret 10 tiles—give a top-line takeaway.
- **Trust:** Always show freshness/source and whether metrics are ready vs fallback.
- **Shareable:** The feature should encourage sharing (links + summaries).
- **Test mindset:** This is a 4–6 week test. Bias toward shipping + measuring, not perfect modeling.

---

## 1) Release Plan (4–6 week test)

Ship in this order to maximize learning while staying lightweight:

**Phase 1 (must-have):**
- Verdict header + driver bullets
- Copy link + copy summary
- Freshness/status footer + clear pending/fallback states

**Phase 2 (WOW):**
- “Better nearby sites” carousel (Closest Power Opportunity)

**Phase 3 (optional probe):**
- “Pencil this site” (Rangekeeper-lite) mini underwriting step, gated behind a button

---

## 2) Instrumentation (measure what users gravitate toward)

Add lightweight event logging so we learn what people actually use.

### Events to track (minimum)

- `location_search_performed` (query length, lat/lng rounded, geocode source)
- `queue_metrics_ready` (lat/lng rounded, status=ready|fallback, duration_ms)
- `copy_link_clicked`
- `copy_summary_clicked`
- `nearby_sites_shown` (count=3)
- `nearby_site_clicked` (rank=1..3, distanceMi)
- `location_search_card_status_seen` (`ready|pending|fallback|preliminary`)

**If Phase 3:**
- `pencil_site_opened`
- `pencil_site_sensitivity_changed` (which slider)
- `pencil_site_copy_brief_clicked`

### Privacy / safety

- Round coordinates (e.g. 3–4 decimals) in analytics.
- Do not log full free-text addresses; log length + maybe a coarse “contains_zip” flag.

---

## 3) “Feasibility Verdict” Header (New)

Add a compact header section at the top of the card that summarizes the location:

- **Verdict pill:** `High / Moderate / Low` (or `Strong / Mixed / Constrained`)
- **One-liner reason:** e.g. “High queue pressure near nearest substation.”
- **3 driver bullets** (short):
  - Queue pressure: `2.1× ERCOT avg`
  - Nearest sub: `138 kV · 3.4 mi`
  - Wait estimate: `18–28 mo`

### Suggested inputs (already available)
From `responseMetadata.queueMetrics` when `queueMetricsStatus === 'ready'`:
- `activeQueueCount`, `activeQueueMw`
- `ercotAvgActiveQueueCount`
- `nearestSubDistanceMi`, `nearestSubVoltageKv`, `nearestSubPoiCount`
- `dataCenterCount` (+ breakdown)
- `estWaitMonthsLow`, `estWaitMonthsHigh`
- `countyType`, `netMw`

### Minimal scoring (no new backend required)
Implement small helper(s) in the card:
- `queuePressure = activeQueueCount / ercotAvgActiveQueueCount` (if available)
- `substationPressure = nearestSubPoiCount` (if available)
- `waitBand = estWaitMonthsHigh` (if available)

Then map to verdict thresholds (tune later):
- High: `queuePressure < 0.9 && waitHigh <= 18` (example)
- Moderate: mid-band
- Low: `queuePressure > 1.5 || waitHigh >= 30` (example)

**Important:** If metrics are `pending`/`fallback`, show verdict as `Loading…` or `Preliminary`.

---

## 4) Make tiles act like a scorecard (Existing tiles, better UX)

The card already renders tiles (Active Queue, Nearest Sub, County Type, Data Centers, Est. Wait).

Enhance:
- Add **grade colors** (A/B/C or green/yellow/red) per tile based on thresholds.
- Add **micro-copy** under each tile that says what it means:
  - “Higher than ERCOT avg” / “Below avg”
  - “Substation is heavily targeted”
  - “Producer county: net exporter”

Avoid adding more tiles—focus on clarity.

---

## 5) Trust + Freshness (New/Improve)

Add a small footer section:
- `Geocode source:` `OpenStreetMap` or `Mapbox` (already in `sourceLabel`)
- `Metrics:` `Ready / Pending / Fallback`
- `Updated:` show `timestamp` (already available)

Optional:
- Show `cacheHit` if returned by API.

---

## 6) Share / Copy (New)

Add two buttons (mobile-friendly):

1. **Copy link**
   - Copy a URL that includes at least: `lat`, `lng`, maybe `displayName`
   - When opened, the app should auto-run the same location search / flyTo.

2. **Copy summary**
   - Copy a plain-text summary block, e.g.
     - `Site: <displayName>`
     - `Queue pressure: 2.1× ERCOT avg`
     - `Nearest sub: <name> (<kV> kV) at <mi> mi; <poiCount> queue projects`
     - `Est wait: 18–28 mo` (if available)
     - `Nearby DCs: <count> total; <announced> announced`

Implementation: `navigator.clipboard.writeText(...)` with a fallback.

---

## 7) Loading States (Tighten)

Current behavior: card renders immediately with preview model; then updates when queue metrics arrive.

Improve user perception:
- When `queueMetricsStatus === 'pending'`:
  - show “Loading real metrics…”
  - disable/gray out scoring until ready
- When `fallback`:
  - show a subtle “Limited data” banner and explain what’s missing.
- Never block first render of `LocationSearchCard`; all verdict/score UI must degrade to
  `Preliminary` when metrics are unavailable.

---

## 8) “Closest Power Opportunity” (New — WOW Feature)

Add a small section directly under the verdict header:

**Title:** “Better nearby sites” / “Closest power opportunity”

**Behavior:** After a user searches an address, show **3 nearby alternatives** (e.g. 2–15 miles away) that score meaningfully better on the same deterministic feasibility rubric.

This turns the product from *descriptive* → *prescriptive*:
- not just “here’s the situation at this address”
- but “here are 3 nearby options that are likely easier/faster/less contested”

### UI (mobile-first)

- Render as a **horizontal carousel** of 3 cards (tap to flyTo).
- Each suggestion card shows:
  - Distance (mi)
  - Verdict pill (High/Moderate/Low)
  - 2 driver bullets (e.g. “0.8× ERCOT avg”, “69 kV @ 1.9 mi”)
  - “Go” button: flyTo + set as current analysis location

### Data contract (minimal)

A suggestion item:

- `lat`, `lng`
- `displayName` (optional reverse geocode or “Candidate #1”)
- `distanceMi`
- `queuePressure` (or activeQueueCount + ercotAvgActiveQueueCount)
- `nearestSubDistanceMi`, `nearestSubVoltageKv`, `nearestSubName`
- `estWaitMonthsHigh` (optional)
- `dataCenterCount` (optional)
- `verdict` + `drivers[]`

### How to compute (low complexity)

**Do not compute this live in the client.** The cheapest + most reliable approach is to precompute candidates weekly (or on-demand server-side with caching), then do a fast “top 3 near point” query.

Two implementation options:

**Option A — Precomputed grid (recommended for 4–6 weeks)**

1. Weekly job builds a table like `location_candidates` with columns:
   - `id`, `geom` (POINT), `county_geoid`
   - the same metrics you already expose in `queueMetrics` (or enough to score)
   - `score_total`, `verdict`
   - `computed_at`
2. At search time:
   - query candidates within radius (e.g. 25 mi) ordered by `score_total desc`
   - exclude candidates too close to the searched point (e.g. < 1.5 mi)
   - return top 3

**Option B — On-demand scoring (only if you already have fast RPC)**

- Serverless endpoint samples ~20 points around the location, calls the existing Supabase RPC, scores them, caches the result for 30–60 minutes.
- More moving parts; only do if precompute is too heavy.

Implementation note for this test:
- Prefer a small server endpoint + cache-backed response for nearby recommendations.
- Keep client logic to rendering and click/fly actions only.

### Scoring rubric (simple + explainable)

Start with a transparent, threshold-based score so the UI can explain *why* the suggestion is better.

Example (tune):
- Queue pressure:
  - `< 0.9x` → +3
  - `0.9–1.3x` → +2
  - `1.3–1.7x` → +1
  - `> 1.7x` → 0
- Nearest substation distance:
  - `< 2 mi` → +2
  - `2–5 mi` → +1
  - `> 5 mi` → 0
- Substation contention (`nearestSubPoiCount`):
  - `< 5` → +2
  - `5–12` → +1
  - `> 12` → 0
- Wait months high (if present):
  - `<= 18` → +2
  - `19–30` → +1
  - `> 30` → 0

Output:
- `score_total` maps to verdict.

### Why this is a WOW feature

- Works for unknown user personas: RE, investors, power developers.
- Feels like “intel” because it gives next actions.
- Can be implemented without paid AI calls.
- Encourages deeper usage (people will click through candidates).

---

## 9) “Pencil this site” (Optional probe — Rangekeeper-lite)

Only implement if Phase 1–2 are in good shape and we want to test whether users gravitate toward underwriting.

**UI:** single button: “What would this site need to pencil?”

**Keep it tiny (directional, not a full model):**
- Output: `IRR` (or `Required $/kW-mo for target IRR`) under 3 scenarios: `Fast / Base / Slow time-to-power`
- One slider: `Rent ($/kW-mo)` or `Delay (months)`
- One mini sensitivity chart: `Rent → IRR` OR `Delay → IRR`

**Rules:**
- No external AI calls.
- Label as “beta / directional.”
- Pre-fill assumptions from `queueMetrics` where possible (especially time-to-power scenarios).

---

## 10) Non-goals (for this 4–6 week test)

- Do **not** introduce SQLRooms unless we explicitly create a separate “Analysis” mode.
- Do **not** add paid LLM calls on search.
- Do **not** add live-web crawling on search.

---

## 11) Implementation Checklist

- [ ] Add verdict header component (inline or extracted)
- [ ] Define thresholds + scoring helpers
- [ ] Add grades to existing tiles
- [ ] Add “Copy link” + “Copy summary”
- [ ] Add freshness/status footer
- [ ] Verify mobile layout (small screens)
- [ ] Add instrumentation events (Phase 1)
- [ ] Add runtime guards for data fetches (verify JSON content-type before parsing where needed)
- [ ] Confirm required static datasets are included in deployment (or layer no-op if unavailable)
- [ ] Add “Better nearby sites” carousel (top 3 candidates)
- [ ] (Optional) Add “Pencil this site” (Rangekeeper-lite probe)

### Acceptance Criteria (add to QA pass)

- [ ] `LocationSearchCard` always renders on search (ready, pending, fallback, or preliminary)
- [ ] No production JSON parse crashes like `Unexpected token '<'` for critical location-search layers
- [ ] `/api/location-queue-metrics` returns expected statuses (`200`, `400`, `429`) with stable UX fallback
- [ ] Menu + response switching still works while verdict/status UI is visible

---

## 12) Notes / Pointers

- `responseMetadata` is produced in `src/hooks/useAIQuery.js` under the custom location search branch.
- Current code path in `useAIQuery.js` is **API-first**:
  - `GET /api/location-queue-metrics?lat=...&lng=...`
  - Optional direct Supabase fallback only when `REACT_APP_QUEUE_METRICS_ALLOW_DIRECT_FALLBACK=true` (local/dev escape hatch).
- `api/location-queue-metrics.js` now includes:
  - KV caching by rounded coordinates
  - fixed-window rate limiting (`429` + `Retry-After`)
  - explicit credential checks and conservative cache headers
- Deployment guardrail: excluding required `public/data` assets can cause HTML responses for GeoJSON fetches, leading to `Unexpected token '<'` parse errors. Keep critical datasets deployed or make layers fail gracefully.
