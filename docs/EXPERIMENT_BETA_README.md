# Switchyard — Stealth Mobile Experiment (Phase 1 → Phase 2)

This document is the working spec for the current experiment.

**Project URL (current):** https://www.infrastructure-research.com/

## Why this exists

We are running a stealth, mobile-first experiment to learn:

1) **What users actually want** when they “plug an address” and try to understand what’s happening nearby.
2) Whether the **Opposition / pressure** framing creates a natural, shareable unit of insight.
3) Which user behaviors predict value (and which predict confusion / drop-off).

Constraints:
- **Stealth**: keep employer risk low; avoid public claims that imply affiliation.
- **Texas-only** for now.
- **Fast learning loop**: analytics must be interpretable without signups.

---

## What we’re building (current)

### Phase 1 — Address → Opposition/Verdict
User journey (exactly as instrumented today):
1. User submits an address in the search bar.
2. System resolves it to `lat/lng + displayName` (geocode).
3. System loads nearby Texas data center markers and computes:
   - nearby project list (distance-ranked)
   - in-radius counts used by Opposition (circle stats)
4. LocationSearchCard renders **Opposition** and **Verdict** sections.
5. User explores:
   - Opposition tiles (cluster/blocked/sequence)
   - cluster map / power circle actions
   - nearby carousel + site lens
6. User shares:
   - **Share state** (current): link to this app state at this `lat/lng`
   - **Share finding** (future option): copy a short text mini-brief + link

Primary focus:
- **Opposition** section engagement (view + deeper actions)
- Secondary: Verdict comprehension and follow-on actions

### Phase 2 (candidate) — Top campuses / tracked sites
We may add a curated “Top 20–50 largest campuses” index + site pages.

This should be built only if it:
- increases credibility of Opposition signals, and/or
- creates a shareable artifact users forward.

---

## Measurement goals (what we need to know)

We don’t assume personas. We infer segments by behavior.

### Daily cuts (core)
- **Users/day**: unique `user_id`
- **Sessions/day**: unique `session_id`
- **Searches/day**

### Funnel health
- `% users with geocode_success`
- `% users with queue_metrics_status=ready vs fallback`

### Opposition (north star)
- `% users with opposition_section_viewed`
- `% users with deep opposition action`:
  - tile open (expanded=true for cluster/blocked/sequence)
  - cluster map / power circle action

### Sharing
We distinguish between:
- **Share state (current):** sharing a deep link to the app at the current `lat/lng`
- **Share finding (future):** sharing a copyable mini-brief that stands alone outside the app

Current events:
- `share_clicked` (intent)
- `share_copied` (copied)
- `share_used` (platform)

Proposed future events (if/when we add Copy Finding):
- `share_finding_copied` (templateId)
- `share_finding_used` (platform, templateId)

### “Stuck” signals
- `geocode_failed`
- high fallback rate
- AI failure events (if/when shown)

---

## Tracking / identity strategy (no auth)

We capture *anonymous but stable* identity + cohort attribution.

### Identity fields attached to every event row
Implemented in `src/services/analyticsApi.js`:
- `user_id` — stored in `localStorage` (`pha_uid`), fallback to session-scoped id if storage blocked.
- `cohort` — URL param
- `invite` — URL param (gated DM links)
- UTM params — URL params (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`)
- `ref` — URL param

These are merged into the `metadata` field for every Supabase write.

### What address the user searched
We capture:
- Raw query row in Supabase: `query_type=address` and `query="Austin, TX"`
- `search_submitted` event includes `metadata.query` for address searches
- `geocode_success` includes `{ query, lat, lng, displayName }`

---

## Backend storage

### Supabase
- All analytics writes go to: `search_logs` (Supabase REST)
- No schema changes required; data is stored as:
  - `query` (event name or raw query)
  - `query_type` (`event`|`address`|`perplexity`)
  - `source` (component)
  - `metadata` (JSON)
  - `session_id`, `viewport`, `user_agent`

### Notion dashboard
We keep a Notion page + daily rollup table that aggregates Supabase into “Daily Usage”.

---

## UI/UX: where experiment behaviors live

### Address search
- Input: `AskAnythingInput` (search bar)
- Orchestration: `src/hooks/useAIQuery.js`

### Location metrics + exploration
- `src/components/Map/components/Cards/LocationSearchCard.jsx`
  - Opposition section
  - Verdict section
  - Nearby carousel
  - Share menu

### Opposition card
- `src/components/Map/components/Cards/opposition.jsx`
  - Deduped impression tracking per (coordStr, oppositionLevel)
  - Tile expand/collapse tracking
  - Cluster map CTA + halo pulses

### Map orchestration + event bus
- `src/components/Map/index.jsx`
  - Defines `window.mapEventBus`
  - Calls `initEventBusTracking()`
  - Logs `app_loaded` and `session_started`

---

## Events (canonical list)

### Load / session
- `app_loaded` (source: map)
- `session_started` (source: map)

### Search / geocode
- `search_submitted` (source: useAIQuery)
- `geocode_success` / `geocode_failed` (source: useAIQuery)

### Metrics
- `queue_metrics_loaded` (source: useAIQuery)
- `queue_metrics_status` (source: useAIQuery)
- `queue_metrics_failed` (source: useAIQuery)

### Location card
- `location_search_card_status_seen` (source: location_search_card)
- `nearby_sites_shown` (source: texas_data_centers)
- `nearby_site_clicked` (source: location_search_card)

### Section viewed (mobile intent)
- `opposition_section_viewed` (source: location_search_card)
- `verdict_section_viewed` (source: location_search_card)

### Opposition
- `opposition_card_seen` (source: opposition)
- `opposition_cluster_toggled` / `opposition_blocked_toggled` / `opposition_sequence_toggled` (source: opposition)
- `opposition_cluster_action_clicked` (source: location_search_card)
- `opposition_nearby_clicked` (source: location_search_card/opposition)

### Share
- `share_clicked` (source: location_search_card)
- `share_used` (source: location_search_card) — platform: linkedin/twitter
- `share_copied` (source: location_search_card)

---

## Notion bridge (operational)

### Run-now sync endpoint (Vercel)
- `/api/notion-analytics-sync`
- Supports `mode=hourly|weekly`
- Token gated via `SYNC_TOKEN` env var

### Daily rollup table
- Notion database: “Daily Usage”
- Aggregation code lives in:
  - `scripts/sync_notion_analytics.mjs` (local)
  - `api/notion-analytics-sync.js` (serverless)

### Update after domain changes
If the public domain changes, update Notion callout links that point to `/api/notion-analytics-sync`.

---

## Files impacted most often

**Tracking core**
- `src/services/analyticsApi.js`

**Search / orchestration**
- `src/hooks/useAIQuery.js`

**Mobile UX + exploration**
- `src/components/Map/components/Cards/LocationSearchCard.jsx`
- `src/components/Map/components/Cards/opposition.jsx`

**Map + event bus**
- `src/components/Map/index.jsx`

**Notion sync**
- `api/notion-analytics-sync.js`
- `scripts/sync_notion_analytics.mjs`

---

## Next experiment candidates

1) **Shareable finding generator** (copy 2–4 bullet mini-brief, not just a link)
2) Watchlist + digest (retention)
3) Opposition explainability (trust)
4) Compare two addresses (decision workflow)

---

## Notes / caveats

- `user_id` is anonymous; do not attempt to map to real identities.
- Address queries are sensitive; keep experiment gated and dashboards private.
- Avoid language that implies affiliation with any employer.
