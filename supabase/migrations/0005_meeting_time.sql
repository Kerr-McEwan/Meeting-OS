-- Add optional time-of-day to meetings so users can edit "date + time"
-- from the pivot header. Keeping meeting_date as a date preserves all
-- existing sorting and "upcoming" logic; meeting_time is purely display
-- metadata for now.

alter table public.meetings
  add column if not exists meeting_time time;
