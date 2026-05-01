-- Series creators need to be able to set up sections, agenda, and the
-- first meeting on a brand-new series before they appear as an attendee
-- of any meeting in it. Update can_see_series() so the creator always
-- has access to their own series.

create or replace function public.can_see_series(_series_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists(
      select 1 from public.meeting_series s
      where s.id = _series_id and s.created_by = auth.uid()
    )
    or exists(
      select 1
      from public.meetings m
      join public.meeting_attendees ma on ma.meeting_id = m.id
      where m.series_id = _series_id
        and ma.profile_id = auth.uid()
    );
$$;
