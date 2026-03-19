-- Add extraction fields to scanner_signals (county/company/project + confidence)
-- Schema change only. No ingest logic changes.

alter table if exists public.scanner_signals
  add column if not exists extracted_county text,
  add column if not exists extracted_company text[],
  add column if not exists extracted_project text,
  add column if not exists extraction_confidence double precision;
