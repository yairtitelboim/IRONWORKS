-- add project_id to ui_events for click attribution (Texas DC project_id, etc)

alter table if exists public.ui_events
  add column if not exists project_id text;

create index if not exists idx_ui_events_project_id on public.ui_events (project_id);
