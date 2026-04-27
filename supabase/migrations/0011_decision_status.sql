-- Add a status lifecycle to decisions: Open → Under Review → Discuss → Closed.
-- "Open" is the default — new decisions land here on creation.

do $$ begin
  create type public.decision_status as enum ('open', 'under_review', 'discuss', 'closed');
exception when duplicate_object then null; end $$;

alter table public.decisions
  add column if not exists status public.decision_status not null default 'open';

create index if not exists decisions_status_idx
  on public.decisions (series_id, status);
