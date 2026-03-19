-- create scanner_runs table for Phase 1 run logging
create table if not exists public.scanner_runs (
  run_id text primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING', -- RUNNING | SUCCESS | ERROR
  trigger text,
  environment text,
  sources text,
  totals jsonb,
  error_message text,
  raw_payload jsonb
);

create index if not exists idx_scanner_runs_started_at on public.scanner_runs (started_at desc);
create index if not exists idx_scanner_runs_status on public.scanner_runs (status);
