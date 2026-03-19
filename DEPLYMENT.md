# DEPLYMENT Playbook

This is the working playbook for shipping changes from local development to Vercel safely.

## 1) Architecture (what deploys where)

- Frontend: CRA app built by Vercel from this repo.
- API on Vercel: `api/*.js` serverless functions.
- Scanner routes exposed to UI:
  - `/api/scanner/signals` -> `/api/scanner-signals`
  - `/api/scanner/ingest/news` -> `/api/scanner-ingest-news`
  - `/api/scanner/ingest/ercot` -> `/api/scanner-ingest-ercot`
  - `/api/scanner/cron-daily` -> `/api/scanner-cron-daily`
- Daily cron on Vercel: `15 13 * * *` (13:15 UTC).

## 2) Branching model

- `main` = production deploy branch.
- Feature work goes on short-lived branches:
  - `feat/<name>`
  - `fix/<name>`
  - `chore/<name>`
- Never push direct to `main` for scanner/API changes.

## 3) Required secrets (Vercel env vars)

Set in Vercel Project Settings -> Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `TAVILY_API_KEY`
- `SCANNER_CRON_TOKEN` (if cron endpoint is token-protected)

Recommended split:
- Preview env: test keys / non-prod datasets.
- Production env: production keys only.

## 4) Local development modes

### Fast UI loop (current local pattern)

Run UI + local API proxy:

```bash
npm start
node server.js
```

Notes:
- CRA proxies `/api/*` to `http://127.0.0.1:3001` via `src/setupProxy.js`.
- This is fast, but not identical to Vercel runtime.

### Pre-merge parity check (recommended)

Use Vercel local runtime before opening/merging PR:

```bash
vercel dev
```

Then test:

```bash
curl "http://localhost:3000/api/scanner/signals?source_type=TAVILY&limit=3"
curl -X POST "http://localhost:3000/api/scanner/ingest/news" -H "Content-Type: application/json" -d '{"days":3,"maxResults":3}'
curl -X POST "http://localhost:3000/api/scanner/ingest/ercot" -H "Content-Type: application/json" -d '{"useGisReports":true,"downloadFresh":true}'
```

If `SCANNER_CRON_TOKEN` is enabled:

```bash
curl "http://localhost:3000/api/scanner/cron-daily?token=<token>"
```

## 5) Push + PR flow

1. Update branch:

```bash
git checkout -b feat/<short-name>
```

2. Commit in small logical chunks:

```bash
git add -A
git commit -m "feat(scanner): <what changed>"
```

3. Push branch:

```bash
git push -u origin feat/<short-name>
```

4. Open PR to `main`.
5. Wait for Vercel Preview deploy.
6. Validate preview:
  - UI loads and scanner panel renders.
  - Ingest endpoints return `200`.
  - New signals visible in `/api/scanner/signals`.
  - No missing-env errors.

## 6) Merge + production deploy

After review approval:

1. Merge PR into `main`.
2. Confirm Vercel Production deployment succeeds.
3. Run production smoke tests:

```bash
curl "https://<prod-domain>/api/scanner/signals?source_type=TAVILY&limit=5"
curl -X POST "https://<prod-domain>/api/scanner/ingest/news" -H "Content-Type: application/json" -d '{"days":1,"maxResults":3}'
curl -X POST "https://<prod-domain>/api/scanner/ingest/ercot" -H "Content-Type: application/json" -d '{"useGisReports":true,"downloadFresh":true}'
```

4. Confirm cron path is reachable:

```bash
curl "https://<prod-domain>/api/scanner/cron-daily?token=<token>"
```

5. Verify data landed in Supabase (`scanner_signals` latest rows).

## 7) Cron operations checklist

- Cron schedule in `vercel.json` matches intended run time.
- Endpoint auth matches cron caller behavior.
- Runtime is long enough (`maxDuration` is already high for scanner jobs).
- If cron fails, check:
  - Vercel function logs
  - missing env vars
  - upstream source failures (Tavily/ERCOT)
  - Supabase permission/key issues

## 8) Common failure modes

- `500 FUNCTION_INVOCATION_FAILED`: usually missing env vars in Preview/Prod.
- `401 Unauthorized` on cron endpoint: token mismatch or missing token.
- UI works locally but fails on Vercel: local `server.js` behavior diverged from `api/*.js` handlers.
- No new rows after ingest: verify source filters and `source_type` used by UI.

## 9) Rollback plan

If production breaks:

1. Re-deploy previous healthy Vercel deployment from dashboard.
2. Revert offending PR on GitHub.
3. Merge revert to `main`.
4. Re-run smoke tests and cron endpoint check.

## 10) Release checklist (copy/paste)

- [ ] Branch rebased and clean
- [ ] Local API checks pass
- [ ] `vercel dev` parity checks pass
- [ ] PR opened and preview verified
- [ ] Env vars confirmed in target environment
- [ ] PR approved and merged
- [ ] Production smoke tests pass
- [ ] Cron endpoint manually validated
- [ ] Supabase rows verified after run
