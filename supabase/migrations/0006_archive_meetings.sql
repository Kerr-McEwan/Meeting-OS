-- Soft-archive meetings: they stay in the database (so decisions, actions,
-- notes tied to them remain intact) but are hidden from the pivot by
-- default. The app filters where archived_at is null; users opt in to
-- seeing archived meetings via a toolbar toggle.

alter table public.meetings
  add column if not exists archived_at timestamptz;

create index if not exists meetings_archived_idx
  on public.meetings (series_id, archived_at);
