-- Minimal seed: one meeting series with 5 sections, 8 agenda items,
-- one past meeting, one upcoming meeting, plus a handful of cells,
-- decisions and actions so the app has something to render on first
-- launch. Re-runnable — guarded by slug uniqueness.

do $$
declare
  v_series uuid;
  v_sec_checkin uuid;
  v_sec_perf uuid;
  v_sec_strat uuid;
  v_sec_ops uuid;
  v_sec_close uuid;
  v_ag1 uuid; v_ag2 uuid; v_ag3 uuid; v_ag4 uuid; v_ag5 uuid;
  v_ag6 uuid; v_ag7 uuid; v_ag8 uuid;
  v_mtg_past uuid;
  v_mtg_next uuid;
begin
  -- Series
  insert into public.meeting_series (slug, name, cadence, description, color_accent)
  values ('leadership-weekly', 'Leadership weekly', 'Every Mon · 09:00',
          'M Squared leadership team weekly check-in.', 'oklch(0.62 0.15 40)')
  on conflict (slug) do update set name = excluded.name
  returning id into v_series;

  -- Sections
  insert into public.sections (series_id, slug, name, color, sort_order) values
    (v_series, 'checkin',     'Check-in',        'oklch(0.72 0.08 160)', 1),
    (v_series, 'performance', 'Performance',     'oklch(0.70 0.10 250)', 2),
    (v_series, 'strategic',   'Strategic Focus', 'oklch(0.70 0.12 40)',  3),
    (v_series, 'operational', 'Operational',     'oklch(0.70 0.09 310)', 4),
    (v_series, 'close',       'Close',           'oklch(0.70 0.06 100)', 5)
  on conflict (series_id, slug) do nothing;

  select id into v_sec_checkin from public.sections where series_id = v_series and slug = 'checkin';
  select id into v_sec_perf    from public.sections where series_id = v_series and slug = 'performance';
  select id into v_sec_strat   from public.sections where series_id = v_series and slug = 'strategic';
  select id into v_sec_ops     from public.sections where series_id = v_series and slug = 'operational';
  select id into v_sec_close   from public.sections where series_id = v_series and slug = 'close';

  -- Agenda items. We only seed once; if items already exist for this series, skip.
  if not exists (select 1 from public.agenda_items where series_id = v_series) then
    insert into public.agenda_items (series_id, section_id, item, sort_order) values
      (v_series, v_sec_checkin, 'Team check-in',           1),
      (v_series, v_sec_checkin, 'Wins & lowlights',        2),
      (v_series, v_sec_perf,    'Revenue vs target',       3),
      (v_series, v_sec_perf,    'Pipeline review',         4),
      (v_series, v_sec_strat,   'Q2 OKRs — status',        5),
      (v_series, v_sec_ops,     'Hiring plan',             6),
      (v_series, v_sec_close,   'Decisions needed',        7),
      (v_series, v_sec_close,   'AOB',                     8)
    ;
  end if;

  select id into v_ag1 from public.agenda_items where series_id = v_series and sort_order = 1;
  select id into v_ag2 from public.agenda_items where series_id = v_series and sort_order = 2;
  select id into v_ag3 from public.agenda_items where series_id = v_series and sort_order = 3;
  select id into v_ag4 from public.agenda_items where series_id = v_series and sort_order = 4;
  select id into v_ag5 from public.agenda_items where series_id = v_series and sort_order = 5;
  select id into v_ag6 from public.agenda_items where series_id = v_series and sort_order = 6;
  select id into v_ag7 from public.agenda_items where series_id = v_series and sort_order = 7;
  select id into v_ag8 from public.agenda_items where series_id = v_series and sort_order = 8;

  -- One past, one upcoming meeting.
  if not exists (select 1 from public.meetings where series_id = v_series) then
    insert into public.meetings (series_id, meeting_date, label, upcoming)
    values (v_series, current_date - interval '7 days', to_char(current_date - interval '7 days', 'FMDD Mon'), false)
    returning id into v_mtg_past;

    insert into public.meetings (series_id, meeting_date, label, upcoming)
    values (v_series, current_date + interval '2 days', to_char(current_date + interval '2 days', 'FMDD Mon'), true)
    returning id into v_mtg_next;

    -- Fill the past meeting with some example notes so the pivot table
    -- has content on first load.
    insert into public.cells (agenda_item_id, meeting_id, notes, status) values
      (v_ag1, v_mtg_past, 'Full team present. Mood steady after a busy week on-site.', 'done'),
      (v_ag2, v_mtg_past, 'Win: Inverness project handover complete. Low: two sick days on the Glasgow site.', 'done'),
      (v_ag3, v_mtg_past, 'Revenue tracking 4% over plan for the month.', 'done'),
      (v_ag4, v_mtg_past, 'Three tenders in flight; decision expected next week.', 'carry'),
      (v_ag5, v_mtg_past, 'H1 objectives green on safety, amber on commercial.', 'done'),
      (v_ag6, v_mtg_past, 'Site supervisor role still open — shortlist of two.', 'carry')
    ;

    -- A couple of example decisions + actions so the logs aren't empty.
    insert into public.decisions (series_id, meeting_id, agenda_item_id, section_id, text) values
      (v_series, v_mtg_past, v_ag7, v_sec_close, 'Approve Aberdeen scaffolding supplier switch.'),
      (v_series, v_mtg_past, v_ag7, v_sec_close, 'Defer new van purchase pending Q2 cashflow review.')
    ;

    insert into public.actions (series_id, meeting_id, agenda_item_id, title, due_date, status, priority, raised_date) values
      (v_series, v_mtg_past, v_ag4, 'Submit Inverness hospital tender',        current_date - interval '1 days', 'in_progress', 'high',   current_date - interval '7 days'),
      (v_series, v_mtg_past, v_ag6, 'Interview site supervisor shortlist',     current_date + interval '4 days', 'to_action',   'medium', current_date - interval '7 days'),
      (v_series, v_mtg_past, v_ag3, 'Reconcile March invoices with Xero',       current_date - interval '3 days', 'stuck',       'medium', current_date - interval '7 days')
    ;
  end if;
end $$;
