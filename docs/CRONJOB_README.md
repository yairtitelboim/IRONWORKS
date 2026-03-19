# Cronjob README — Scanner Phase 1 (Vercel + Supabase)

This document captures **everything we set up** to make Scanner Phase 1 run as a scheduled job (cron), persist results in Supabase, and expose operational visibility (run logs).

> Repo path (local): `Documents/Kernel/ALLAPPS/DSA`

---

## What we built (Phase 1 scope)

### Goals
- **Ingest signals daily** (news + ERCOT)
- **Store signals in Supabase** (`scanner_signals`)
- **Track cron executions** in Supabase (`scanner_runs`)
- Provide simple HTTP endpoints for:
  - manual triggering
  - debugging
  - UI consumption

### Key endpoints (public API surface)
These are the stable, user-facing routes (via Vercel rewrites):

- `GET /api/scanner/signals`
  - Reads from Supabase `scanner_signals`

- `POST /api/scanner/ingest/news`
  - Tavily search → upsert into `scanner_signals`

- `POST /api/scanner/ingest/ercot`
  - ERCOT adapter → upsert into `scanner_signals`

- `GET /api/scanner/cron-daily`
  - Orchestrates a “daily run”:
    - runs News ingestion (Tavily)
    - runs ERCOT ingestion
    - logs the run into `scanner_runs` (best-effort)

- `GET /api/scanner/runs`
  - Fetches recent run logs from `scanner_runs`

---

## Vercel architecture notes (important)

This project uses **Create React App** + Vercel serverless functions in the `api/` folder.

Because CRA routing would otherwise swallow `/api/*`, we use **Vercel rewrites** so you can call nice routes like `/api/scanner/runs` while the actual function file is flat at the root of `api/`.

### The rewrite pattern
In `vercel.json`:

- `/api/scanner/signals` → `/api/scanner-signals`
- `/api/scanner/ingest/news` → `/api/scanner-ingest-news`
- `/api/scanner/ingest/ercot` → `/api/scanner-ingest-ercot`
- `/api/scanner/cron-daily` → `/api/scanner-cron-daily`
- `/api/scanner/runs` → `/api/scanner-runs`

**Why we did this:**
- CRA single-page fallback would otherwise serve `index.html` for unknown paths.
- Flat `api/*.js` functions are the most reliable/portable with Vercel’s bundling.

---

## Supabase schema

### Signals
Schema file:
- `supabase/scanner_schema.sql`

Tables:
- `public.scanner_signals`
- `public.scanner_source_snapshots`

### Run logs
We added:
- `public.scanner_runs`

The run log table is written by `GET /api/scanner/cron-daily`.

---

## How we applied `scanner_runs` to Supabase

We used the **Supabase CLI** to apply the table as a migration.

Steps:

1) Install CLI
```bash
brew install supabase/tap/supabase
```

2) Authenticate
```bash
supabase login
```

3) Determine the correct project
- We used the project ref in `.env.local`:
  - `REACT_APP_SUPABASE_URL=https://fuymxmljliiwtlhrzdfm.supabase.co`
  - so project ref = `fuymxmljliiwtlhrzdfm`

4) Link the repo
```bash
supabase link --project-ref fuymxmljliiwtlhrzdfm
```

5) Initialize Supabase config (if not already present)
```bash
supabase init --force
```

6) Create migration
```bash
mkdir -p supabase/migrations
# create: supabase/migrations/<timestamp>_create_scanner_runs.sql
```

7) Push migration to remote
```bash
supabase db push --linked
```

---

## Required environment variables (Vercel)

These must exist in **Vercel Project → Settings → Environment Variables** (Production + Preview as needed):

- `SUPABASE_URL`
  - preferred canonical URL, e.g. `https://<ref>.supabase.co`

- `SUPABASE_SERVICE_ROLE_KEY`
  - server-side only; used by ingestion + runs endpoint

- `TAVILY_API_KEY`
  - required for `/api/scanner/ingest/news` and for the daily cron’s news step

Optional/compat:
- `REACT_APP_SUPABASE_URL`
  - the API code supports falling back to this if `SUPABASE_URL` is not present

---

## Cron schedule (Vercel)

`vercel.json` includes:

```json
"crons": [
  {
    "path": "/api/scanner-cron-daily",
    "schedule": "15 13 * * *"
  }
]
```

This triggers **the function path** `/api/scanner-cron-daily` (not the nice rewrite), on a daily schedule.

> Note: `15 13 * * *` is 13:15 UTC (which is 07:15 CST during standard time, 08:15 CDT during daylight time). Adjust as desired.

---

## Security / protection

### Vercel Deployment Protection
If your Vercel deployments are protected, you may see a **401 Authentication Required** when using curl.

In that case:
- Use a browser where you’re already logged into Vercel
- Or use Vercel’s documented bypass token flow

### Cron auth token (optional but recommended)
`GET /api/scanner/cron-daily` supports `SCANNER_CRON_TOKEN`.

If set:
- Requests must include:
  - `X-Scanner-Token: <token>` header, or
  - `?token=<token>` query param

This prevents arbitrary third parties from triggering ingestion.

---

## Manual testing checklist

### 1) Verify run logs endpoint works
Open:
- `GET /api/scanner/runs?limit=5`

Expected:
```json
{"runs":[],"count":0,"filters":{"limit":5}}
```

### 2) Trigger one daily run
Open:
- `GET /api/scanner/cron-daily`

Expected:
- JSON with `success: true`
- includes `runId`

### 3) Confirm run is logged
Open:
- `GET /api/scanner/runs?limit=5`

Expected:
- `count >= 1`
- most recent row `status` is `SUCCESS` or `ERROR`

### 4) Confirm signals present
Open:
- `GET /api/scanner/signals?source_type=TAVILY&limit=5`
- `GET /api/scanner/signals?source_type=ERCOT&limit=5`

---

## Troubleshooting

### A) `FUNCTION_INVOCATION_FAILED` (500)
Most common causes:
- Missing Vercel env vars (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `TAVILY_API_KEY`)
- Supabase table does not exist (e.g. `scanner_runs` missing)

### B) `/api/scanner/runs` returns HTML
That usually means:
- your request is being served by the CRA fallback (`index.html`) due to a missing rewrite

Fix:
- confirm `vercel.json` has `/api/scanner/runs` → `/api/scanner-runs`

### C) Bundling/import problems in serverless
We hit a real issue where a wrapper function importing another file caused a crash.

Resolution:
- Keep Vercel functions **self-contained** in `api/*.js` for critical endpoints.

---

## Files changed / created in this work

- `api/scanner/cron-daily.js` — adds run logging (`scanner_runs`)
- `api/scanner/runs.js` — underlying runs handler (used during dev)
- `api/scanner-runs.js` — **production-safe** runs endpoint (self-contained)
- `supabase/scanner_schema.sql` — includes `scanner_runs`
- `supabase/migrations/*_create_scanner_runs.sql` — migration applied via CLI
- `docs/SCANNER_PHASE1.md` — phase 1 overview + endpoints
- `docs/CRONJOB_README.md` — this doc

---

## Next logical upgrades (Phase 1.1)

- Add a small UI card “Cron Health” that calls `/api/scanner/runs?limit=1`.
- Add alerting (WhatsApp/Slack) when a cron run fails.
- Normalize/score signals (dedupe_key, tags, lane, confidence) so the inbox is actionable.
