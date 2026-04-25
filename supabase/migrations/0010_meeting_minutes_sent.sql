-- Audit log of meeting minutes sent. Lets us prevent accidental double-sends
-- and keeps a record of who got what when. Recipient emails are stored
-- denormalised so the record is meaningful even if profiles change later.

create table if not exists public.meeting_minutes_sent (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  recipient_count int not null,
  recipient_emails text[] not null,
  resend_message_id text
);

create index if not exists meeting_minutes_sent_meeting_idx
  on public.meeting_minutes_sent (meeting_id, sent_at desc);

alter table public.meeting_minutes_sent enable row level security;

drop policy if exists "minutes_sent_select" on public.meeting_minutes_sent;
drop policy if exists "minutes_sent_insert" on public.meeting_minutes_sent;
create policy "minutes_sent_select" on public.meeting_minutes_sent
  for select using (public.is_admin() or public.is_attendee(meeting_id));
create policy "minutes_sent_insert" on public.meeting_minutes_sent
  for insert with check (public.is_admin() or public.is_attendee(meeting_id));
