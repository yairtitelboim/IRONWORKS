# Scanner (Phase 1) — Ingestion + Signals API

This repo includes a **Phase 1 “scanner” pipeline** that:
1) ingests external signals (news / market / grid data)
2) stores them in **Supabase**
3) serves them back to the UI via `/api/scanner/*` endpoints

This doc is for developers working on the ingestion + storage + API surface.

---

## What exists (high level)

- **Ingest endpoints** (serverless)
  - `POST /api/scanner/ingest/news` (Tavily search → `scanner_signals`)
  - `POST /api/scanner/ingest/ercot` (ERCOT scrape/parse → `scanner_signals`)
- **Read endpoint**
  - `GET /api/scanner/signals` (read from `scanner_signals` with filters)
- **Cron**
  - `api/scanner/cron-daily.js` (daily orchestration wrapper + run logging)
- **Run logs**
  - `GET /api/scanner/runs` (fetch recent cron runs)

UI entry points:
- `src/components/Map/components/AITransmissionNav.jsx` (shows “new signals”, buttons like Refresh Market / Check ERCOT)

---

## Supabase schema

Primary tables (see `supabase/scanner_schema.sql`):

- `scanner_runs` (cron/run logging)
- `scanner_signals`
  - One row per “signal” (news item, ERCOT report item, etc.)
  - Key fields you’ll see used:
    - `signal_id` (stable unique id; used for upserts)
    - `source_type` (e.g. `TAVILY`, `ERCOT`)
    - `headline`, `url`, `published_at`, `ingested_at`
    - `raw_text` and `raw_payload` (debuggability)
    - `status` (e.g. `NEW`)
    - `lane`, `change_type` (basic categorization)

- `scanner_source_snapshots`
  - Optional “raw capture” of the upstream response payload for traceability

---

## Environment variables (Vercel)

These are required in production for Phase 1 ingestion to work.

### Required

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
  - **Server-side only.** Do not expose in client bundles.
- `TAVILY_API_KEY`

### Optional / compatibility

- `REACT_APP_SUPABASE_URL`
  - The ingestion endpoints prefer `SUPABASE_URL`, but will fall back to `REACT_APP_SUPABASE_URL` if present.

---

## API: read signals

### `GET /api/scanner/signals`

Query params (most used):

- `source_type` — filter by source (e.g. `TAVILY`, `ERCOT`)
- `status` — e.g. `NEW`
- `limit` — default varies; keep it small for UI

Example:

```bash
curl "https://<deploy>.vercel.app/api/scanner/signals?source_type=TAVILY&limit=5"
```

Response shape:

```json
{
  "signals": [ { "signal_id": "…", "headline": "…", "url": "…" } ],
  "count": 5,
  "filters": { "source_type": "TAVILY", "limit": 5 }
}
```

---

## API: fetch run logs

### `GET /api/scanner/runs`

Use this to confirm the scheduled job is running and to debug failures.

```bash
curl "https://<deploy>.vercel.app/api/scanner/runs?limit=20"
```

Response:

```json
{ "runs": [ { "run_id": "…", "status": "SUCCESS" } ], "count": 20 }
```

---

## API: ingest news (Tavily)

### `POST /api/scanner/ingest/news`

What it does:
- calls Tavily `/search`
- maps results into `scanner_signals`
- upserts by `signal_id`
- writes a `scanner_source_snapshots` row

Body:

```json
{
  "query": "\"data center\" (moratorium OR lawsuit OR zoning) Texas",
  "days": 14,
  "maxResults": 5
}
```

Example:

```bash
curl -X POST "https://<deploy>.vercel.app/api/scanner/ingest/news" \
  -H "Content-Type: application/json" \
  -d '{"query":"\"data center\" Texas","days":7,"maxResults":10}'
```

Success response:

```json
{
  "success": true,
  "message": "NEWS ingestion completed",
  "signalsFound": 5,
  "signalsStored": 5
}
```

Notes:
- If this endpoint returns `500 FUNCTION_INVOCATION_FAILED`, the most common cause is **missing env vars** in Vercel (`TAVILY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

---

## Cron / automation

- `api/scanner/cron-daily.js` is intended to be called on a schedule (Vercel cron or external).
- Keep ingestion idempotent by:
  - using deterministic `signal_id`
  - using Supabase upsert with `on_conflict=signal_id`

---

## Local development quickstart

1) Install deps:

```bash
npm install
```

2) Set env vars (local):
- copy `env.example` → `.env.local`
- fill in Supabase + Tavily keys

3) Run:

```bash
npm run dev
# or whatever your local script is configured as
```

4) Test endpoints:

```bash
curl -X POST http://localhost:3000/api/scanner/ingest/news \
  -H "Content-Type: application/json" \
  -d '{"days":3,"maxResults":3}'

curl "http://localhost:3000/api/scanner/signals?source_type=TAVILY&limit=3"
```

---

## Conventions / implementation notes

- **Prefer service-role key** for serverless ingestion endpoints.
- Store upstream payloads in `raw_payload` / snapshots so we can debug mapping changes.
- Keep payload sizes in mind (serverless limits). Store only what you need.

---

## Related files

- API endpoints
  - `api/scanner/ingest/news.js`
  - `api/scanner/ingest/ercot.js`
  - `api/scanner/signals.js`
  - `api/scanner/cron-daily.js`

- Storage
  - `scanner/phase1/storage/supabase-signals-db.js`

- Schema
  - `supabase/scanner_schema.sql`

- UI
  - `src/components/Map/components/AITransmissionNav.jsx`
