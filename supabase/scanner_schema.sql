-- DSA Scanner: Supabase schema
-- Create tables used by /api/scanner/* (SupabaseSignalsDB)

create table if not exists public.scanner_signals (
  signal_id text primary key,
  ingested_at timestamptz not null default now(),
  published_at timestamptz,
  source_type text,
  source_name text,
  source_id text,
  url text,
  headline text,
  raw_text text,
  summary_3bullets text,
  tags text,
  jurisdiction text,
  state text,
  county text,
  city text,
  asset_type_guess text,
  company_entities text,
  site_entities text,
  location_hint text,
  lat double precision,
  lon double precision,
  lane text default 'CONTEXT',
  event_type text,
  commitment_hint text default 'NONE',
  confidence text default 'LOW',
  dedupe_key text,
  status text default 'NEW',
  candidate_project_id text,
  review_notes_1line text,
  requires_followup boolean not null default false,
  change_type text,
  previous_ref text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  recurrence_14d integer not null default 0,
  recurrence_90d integer not null default 0,
  situation_key text,
  raw_payload jsonb
);

create index if not exists idx_scanner_signals_ingested_at on public.scanner_signals (ingested_at desc);
create index if not exists idx_scanner_signals_source_type on public.scanner_signals (source_type);
create index if not exists idx_scanner_signals_status on public.scanner_signals (status);
create index if not exists idx_scanner_signals_dedupe_key on public.scanner_signals (dedupe_key);
create index if not exists idx_scanner_signals_url on public.scanner_signals (url);

create table if not exists public.scanner_source_snapshots (
  snapshot_id text primary key,
  source_type text,
  query text,
  captured_at timestamptz not null default now(),
  raw_payload jsonb
);

create index if not exists idx_scanner_snapshots_source_query on public.scanner_source_snapshots (source_type, query);
create index if not exists idx_scanner_snapshots_captured_at on public.scanner_source_snapshots (captured_at desc);

-- Privacy-preserving UI analytics
create table if not exists public.ui_events (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  asset_type text,
  county text,
  state text,
  project_id text,
  zoom_level int,
  query_hash text,
  center_lat double precision,
  center_lon double precision,
  created_at timestamptz default now()
);

create index if not exists idx_ui_events_created_at on public.ui_events (created_at desc);
create index if not exists idx_ui_events_event_type on public.ui_events (event_type);
create index if not exists idx_ui_events_asset_type on public.ui_events (asset_type);
create index if not exists idx_ui_events_state_county on public.ui_events (state, county);
create index if not exists idx_ui_events_query_hash on public.ui_events (query_hash);
create index if not exists idx_ui_events_project_id on public.ui_events (project_id);

-- Run logging for scheduled ingestion.
-- One row per cron run (or manual run) so we can debug failures + track freshness.
create table if not exists public.scanner_runs (
  run_id text primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING', -- RUNNING | SUCCESS | ERROR
  trigger text,                         -- e.g. CRON_DAILY | MANUAL
  environment text,                     -- e.g. production | preview | local
  sources text,                         -- comma-separated quick view (TAVILY,ERCOT,...)
  totals jsonb,                         -- {signalsFound, signalsStored, ...}
  error_message text,
  raw_payload jsonb
);

create index if not exists idx_scanner_runs_started_at on public.scanner_runs (started_at desc);
create index if not exists idx_scanner_runs_status on public.scanner_runs (status);

-- Optional: enable RLS (service role bypasses; keep disabled if you want anon reads)
-- alter table public.scanner_signals enable row level security;
-- alter table public.scanner_source_snapshots enable row level security;
-- alter table public.scanner_runs enable row level security;
