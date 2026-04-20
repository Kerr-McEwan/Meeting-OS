-- Per-meeting visibility + admin flag + one-off backfill.
--
-- Before RLS tightens, this migration backfills the admin account as
-- chair/attendee on every existing meeting so nothing disappears from
-- their view. If your admin email is not kerr@msquared.co.uk, edit the
-- admin_email variable on the line marked "EDIT" below before running.

-- ---------------------------------------------------------------------
-- 1. is_admin flag on profiles
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. Helper functions used by RLS policies
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_attendee(_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.meeting_attendees
    where meeting_id = _meeting_id
      and profile_id = auth.uid()
  );
$$;

create or replace function public.can_see_series(_series_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists(
    select 1
    from public.meetings m
    join public.meeting_attendees ma on ma.meeting_id = m.id
    where m.series_id = _series_id
      and ma.profile_id = auth.uid()
  );
$$;

grant execute on function public.is_admin()              to authenticated;
grant execute on function public.is_attendee(uuid)       to authenticated;
grant execute on function public.can_see_series(uuid)    to authenticated;

-- ---------------------------------------------------------------------
-- 3. Mark the admin + backfill existing meetings
-- ---------------------------------------------------------------------
do $$
declare
  admin_email text := 'kerr@msquared.co.uk';  -- EDIT: change if your admin email is different
  admin_id uuid;
begin
  select id into admin_id
  from public.profiles
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_id is null then
    raise notice 'No profile found for email %. Sign in once, then re-run this migration.', admin_email;
  else
    -- Flag the admin
    update public.profiles set is_admin = true where id = admin_id;

    -- Any meeting without a chair → admin becomes chair
    update public.meetings set chair_id = admin_id where chair_id is null;

    -- Ensure admin is recorded as an attendee (and chair where relevant) on every meeting
    insert into public.meeting_attendees (meeting_id, profile_id, is_chair, is_apology)
    select m.id, admin_id, (m.chair_id = admin_id), false
    from public.meetings m
    on conflict (meeting_id, profile_id)
      do update set is_chair = excluded.is_chair;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Drop the old permissive RLS policies and replace with scoped ones.
--    Original 0001 created "team_read_*" and "team_write_*" for each
--    table; we drop those and rebuild per table with proper gating.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','meeting_series','sections','agenda_items','meetings',
    'meeting_attendees','cells','decisions','actions'
  ]) loop
    execute format('drop policy if exists "team_read_%1$s"  on public.%1$s;', t);
    execute format('drop policy if exists "team_write_%1$s" on public.%1$s;', t);
  end loop;
end $$;

-- profiles: everyone authenticated can read (needed for team pickers).
-- Writes: your own row, or admin.
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
          with check (id = auth.uid() or public.is_admin());
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());
create policy "profiles_delete" on public.profiles
  for delete using (public.is_admin());

-- meeting_series: visible if admin OR you attend at least one meeting
-- in the series. Any authenticated user can create a new series.
create policy "series_select" on public.meeting_series
  for select using (public.is_admin() or public.can_see_series(id));
create policy "series_insert" on public.meeting_series
  for insert with check (auth.role() = 'authenticated');
create policy "series_update" on public.meeting_series
  for update using (public.is_admin() or public.can_see_series(id))
          with check (public.is_admin() or public.can_see_series(id));
create policy "series_delete" on public.meeting_series
  for delete using (public.is_admin());

-- sections + agenda_items: inherit series visibility
create policy "sections_select" on public.sections
  for select using (public.is_admin() or public.can_see_series(series_id));
create policy "sections_write" on public.sections
  for all using (public.is_admin() or public.can_see_series(series_id))
      with check (public.is_admin() or public.can_see_series(series_id));

create policy "agenda_select" on public.agenda_items
  for select using (public.is_admin() or public.can_see_series(series_id));
create policy "agenda_write" on public.agenda_items
  for all using (public.is_admin() or public.can_see_series(series_id))
      with check (public.is_admin() or public.can_see_series(series_id));

-- meetings: only attendees see the row (admin always).
-- Inserts: any authenticated can create, and they'll naturally be
-- added as an attendee by the app right after.
create policy "meetings_select" on public.meetings
  for select using (public.is_admin() or public.is_attendee(id));
create policy "meetings_insert" on public.meetings
  for insert with check (auth.role() = 'authenticated');
create policy "meetings_update" on public.meetings
  for update using (public.is_admin() or public.is_attendee(id))
          with check (public.is_admin() or public.is_attendee(id));
create policy "meetings_delete" on public.meetings
  for delete using (public.is_admin());

-- meeting_attendees: readable if admin, if the row is about you, or
-- if you also attend that meeting. Writable by admin or any attendee
-- (so people can add/remove others via the edit modal).
create policy "attendees_select" on public.meeting_attendees
  for select using (
    public.is_admin()
    or profile_id = auth.uid()
    or public.is_attendee(meeting_id)
  );
create policy "attendees_insert" on public.meeting_attendees
  for insert with check (
    public.is_admin()
    or profile_id = auth.uid()                          -- add yourself
    or public.is_attendee(meeting_id)                   -- existing attendee can add others
  );
create policy "attendees_update" on public.meeting_attendees
  for update using (public.is_admin() or public.is_attendee(meeting_id))
          with check (public.is_admin() or public.is_attendee(meeting_id));
create policy "attendees_delete" on public.meeting_attendees
  for delete using (public.is_admin() or public.is_attendee(meeting_id));

-- cells (notes): attendees only.
create policy "cells_select" on public.cells
  for select using (public.is_admin() or public.is_attendee(meeting_id));
create policy "cells_write" on public.cells
  for all using (public.is_admin() or public.is_attendee(meeting_id))
      with check (public.is_admin() or public.is_attendee(meeting_id));

-- decisions: attendees OR the decision's own owner can see; writes
-- require being an attendee (or admin).
create policy "decisions_select" on public.decisions
  for select using (
    public.is_admin()
    or public.is_attendee(meeting_id)
    or owner_id = auth.uid()
  );
create policy "decisions_write" on public.decisions
  for all using (public.is_admin() or public.is_attendee(meeting_id))
      with check (public.is_admin() or public.is_attendee(meeting_id));

-- actions: same pattern as decisions.
create policy "actions_select" on public.actions
  for select using (
    public.is_admin()
    or (meeting_id is not null and public.is_attendee(meeting_id))
    or owner_id = auth.uid()
  );
create policy "actions_write" on public.actions
  for all using (
    public.is_admin()
    or (meeting_id is not null and public.is_attendee(meeting_id))
  )
  with check (
    public.is_admin()
    or (meeting_id is not null and public.is_attendee(meeting_id))
  );

-- allowed_email_domains: public read (used client-side), admin-only write.
alter table public.allowed_email_domains enable row level security;
drop policy if exists "allowed_domains_select" on public.allowed_email_domains;
drop policy if exists "allowed_domains_write"  on public.allowed_email_domains;
create policy "allowed_domains_select" on public.allowed_email_domains
  for select using (auth.role() = 'authenticated');
create policy "allowed_domains_write" on public.allowed_email_domains
  for all using (public.is_admin()) with check (public.is_admin());
