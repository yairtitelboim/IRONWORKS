-- privacy-preserving UI analytics
create table if not exists public.ui_events (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  asset_type text,
  county text,
  state text,
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
