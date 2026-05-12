-- Soft-archive meeting series. Mirrors the per-meeting archive pattern:
-- the row stays in the database so historical decisions, actions and
-- minutes remain readable, but the series is hidden from the picker by
-- default. A "Show archived" toggle reveals them for restore.

alter table public.meeting_series
  add column if not exists archived_at timestamptz;

create index if not exists meeting_series_archived_idx
  on public.meeting_series (archived_at);
