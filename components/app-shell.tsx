'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar, Topbar, Stats } from './sidebar';
import { Icon, SeriesPicker } from './atoms';
import { HorizontalView, type SelectedCell } from './horizontal-view';
import { CellDrawer, type CellDrawerHandlers } from './cell-drawer';
import { ActionLog } from './action-log';
import { DecisionLog } from './decision-log';
import { NewSeriesModal, type NewSeriesInput } from './new-series-modal';
import { MeetingEditModal, type MeetingEditPatch } from './meeting-edit-modal';
import { TweaksPanel, applySettings } from './tweaks-panel';
import { createClient } from '@/lib/supabase/browser';
import { DEFAULT_TWEAKS } from '@/lib/types';
import type {
  Action,
  ActionPriority,
  ActionStatus,
  AgendaItem,
  Cell,
  CellStatus,
  Decision,
  InitialData,
  Meeting,
  MeetingSeries,
  Page,
  Section,
  TeamMember,
  TweaksSettings,
} from '@/lib/types';
import { startOfToday } from '@/lib/utils';

export function AppShell({
  initialData,
  user,
}: {
  initialData: InitialData;
  user: TeamMember & { email: string };
}) {
  const supabase = useMemo(() => createClient(), []);

  const [page, setPage] = useState<Page>(() => {
    if (typeof window === 'undefined') return 'horizontal';
    const p = window.localStorage.getItem('mos_page');
    return p === 'actions' || p === 'decisions' ? (p as Page) : 'horizontal';
  });
  useEffect(() => { window.localStorage.setItem('mos_page', page); }, [page]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('mos_sidebar') === 'collapsed';
  });
  useEffect(() => {
    window.localStorage.setItem('mos_sidebar', sidebarCollapsed ? 'collapsed' : 'open');
  }, [sidebarCollapsed]);

  const [seriesList, setSeriesList] = useState<MeetingSeries[]>(initialData.series);
  const [seriesId, setSeriesId] = useState<string>(() => {
    if (typeof window === 'undefined') return initialData.currentSeriesId;
    const stored = window.localStorage.getItem('mos_series');
    if (stored && initialData.series.some((s) => s.id === stored)) return stored;
    return initialData.currentSeriesId;
  });
  useEffect(() => { window.localStorage.setItem('mos_series', seriesId); }, [seriesId]);
  const currentSeries = seriesList.find((s) => s.id === seriesId) || seriesList[0] || null;

  const [team, setTeam] = useState<TeamMember[]>(initialData.team);
  const [sections, setSections] = useState<Section[]>(initialData.sections);
  const [agenda, setAgenda] = useState<AgendaItem[]>(initialData.agenda);
  const [meetings, setMeetings] = useState<Meeting[]>(initialData.meetings);
  const [cells, setCells] = useState<Cell[]>(initialData.cells);
  const [actions, setActions] = useState<Action[]>(initialData.actions);
  const [decisions, setDecisions] = useState<Decision[]>(initialData.decisions);

  // Live data prop — child components read team/series/etc. from here.
  const data = useMemo<InitialData>(
    () => ({ ...initialData, team, series: seriesList, sections, agenda, meetings, cells, actions, decisions }),
    [initialData, team, seriesList, sections, agenda, meetings, cells, actions, decisions],
  );

  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [newSeriesOpen, setNewSeriesOpen] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const editingMeeting = editingMeetingId ? meetings.find((m) => m.id === editingMeetingId) || null : null;

  const [settings, setSettings] = useState<TweaksSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_TWEAKS;
    try {
      const raw = window.localStorage.getItem('mos_tweaks');
      if (raw) return { ...DEFAULT_TWEAKS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_TWEAKS;
  });
  useEffect(() => {
    window.localStorage.setItem('mos_tweaks', JSON.stringify(settings));
    applySettings(settings);
  }, [settings]);

  // --- series-scoped slices ---
  const seriesSections = sections.filter((s) => s.series_id === seriesId);
  const seriesAgenda = agenda.filter((a) => a.series_id === seriesId);
  const seriesMeetings = meetings.filter((m) => m.series_id === seriesId);
  const seriesCells = cells.filter((c) => {
    const mtg = seriesMeetings.find((m) => m.id === c.meeting_id);
    return !!mtg;
  });
  const seriesActions = actions.filter((a) => a.series_id === seriesId);
  const seriesDecisions = decisions.filter((d) => d.series_id === seriesId);

  // --- stats ---
  const today = startOfToday();
  const openActionCount = seriesActions.filter((a) => a.status !== 'done' && a.status !== 'closed').length;
  const carryCount = seriesCells.filter((c) => c.status === 'carry').length;

  const pageMeta: Record<Page, { title: string; sub: string }> = {
    horizontal: {
      title: currentSeries?.name || 'Meeting Agenda',
      sub: currentSeries
        ? `${currentSeries.cadence || ''} · Agenda items down the left, meetings across the top.`
        : '',
    },
    actions:   { title: 'Action Log',  sub: 'All actions across this series. Click a status to change.' },
    decisions: { title: 'Decision Log', sub: 'Decisions logged against agenda items.' },
  };

  const statsFor: Record<Page, { label: string; value: React.ReactNode; delta: string; variant?: string }[]> = {
    horizontal: [
      { label: 'Agenda items', value: seriesAgenda.length, delta: `Across ${seriesSections.length} sections` },
      { label: 'Meetings in view', value: seriesMeetings.length, delta: 'In this series' },
      { label: 'Cells completed', value: seriesCells.length, delta: 'Of past-meeting cells' },
      { label: 'Carry-forward', value: carryCount, delta: 'Flagged for next meeting', variant: 'accent' },
    ],
    actions: [
      { label: 'To action',  value: seriesActions.filter((a) => a.status === 'to_action').length, delta: 'Not yet started' },
      { label: 'In progress', value: seriesActions.filter((a) => a.status === 'in_progress').length, delta: 'Active work' },
      {
        label: 'Overdue',
        value: seriesActions.filter(
          (a) => a.status !== 'done' && a.status !== 'closed' && a.due_date && new Date(a.due_date + 'T00:00:00') < today,
        ).length,
        delta: 'Past due date',
        variant: 'danger',
      },
      { label: 'Done', value: seriesActions.filter((a) => a.status === 'done').length, delta: 'Closed out' },
    ],
    decisions: [
      { label: 'Total decisions', value: seriesDecisions.length, delta: 'In this series' },
      {
        label: 'This month',
        value: seriesDecisions.filter((d) => {
          const mtg = seriesMeetings.find((m) => m.id === d.meeting_id);
          return mtg?.meeting_date.startsWith(today.toISOString().slice(0, 7));
        }).length,
        delta: today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      },
      { label: 'Meetings covered', value: new Set(seriesDecisions.map((d) => d.meeting_id)).size, delta: 'Of past meetings' },
      { label: 'With owner', value: seriesDecisions.filter((d) => d.owner_id).length, delta: 'Assigned to someone' },
    ],
  };

  // ------------------------------------------------------------------
  // Mutations: write-through to Supabase + optimistic local state.
  // ------------------------------------------------------------------

  const handlers: CellDrawerHandlers = {
    saveCell: async (agendaItemId, meetingId, notes, status) => {
      const existing = cells.find((c) => c.agenda_item_id === agendaItemId && c.meeting_id === meetingId);
      const optimistic: Cell = existing
        ? { ...existing, notes, status }
        : { id: `tmp-${Date.now()}`, agenda_item_id: agendaItemId, meeting_id: meetingId, notes, status };
      setCells((prev) => {
        const without = prev.filter((c) => !(c.agenda_item_id === agendaItemId && c.meeting_id === meetingId));
        return [...without, optimistic];
      });
      const { data, error } = await supabase
        .from('cells')
        .upsert(
          { agenda_item_id: agendaItemId, meeting_id: meetingId, notes, status },
          { onConflict: 'agenda_item_id,meeting_id' },
        )
        .select()
        .single();
      if (!error && data) {
        setCells((prev) => {
          const without = prev.filter((c) => !(c.agenda_item_id === agendaItemId && c.meeting_id === meetingId));
          return [...without, data as Cell];
        });
      }
    },

    addDecision: async ({ meetingId, agendaItemId, sectionId, ownerId, text }) => {
      const row = { series_id: seriesId, meeting_id: meetingId, agenda_item_id: agendaItemId, section_id: sectionId, owner_id: ownerId, text };
      const { data, error } = await supabase.from('decisions').insert(row).select().single();
      if (!error && data) setDecisions((prev) => [...prev, data as Decision]);
    },
    removeDecision: async (id) => {
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      await supabase.from('decisions').delete().eq('id', id);
    },

    addAction: async ({ meetingId, agendaItemId, ownerId, title, due, priority }) => {
      const row = {
        series_id: seriesId,
        meeting_id: meetingId,
        agenda_item_id: agendaItemId,
        owner_id: ownerId,
        title,
        due_date: due,
        priority,
        status: 'to_action' as ActionStatus,
      };
      const { data, error } = await supabase.from('actions').insert(row).select().single();
      if (!error && data) setActions((prev) => [...prev, data as Action]);
    },
    removeAction: async (id) => {
      setActions((prev) => prev.filter((a) => a.id !== id));
      await supabase.from('actions').delete().eq('id', id);
    },
    setActionStatus: async (id, status) => {
      setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      await supabase.from('actions').update({ status }).eq('id', id);
    },

    addTeamMember: async (rawName: string) => {
      const name = rawName.trim();
      if (!name) return null;
      const initials = (() => {
        const parts = name.split(/\s+/);
        return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
      })();
      // Deterministic-ish hue per name so avatar colours are stable.
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
      const color = `oklch(0.70 0.10 ${hash % 360})`;

      const id = crypto.randomUUID();
      const row = { id, full_name: name, initials, color, is_guest: true, email: null };
      const { data, error } = await supabase.from('profiles').insert(row).select().single();
      if (error || !data) {
        console.error('[addTeamMember]', error);
        return null;
      }
      const member: TeamMember = {
        id: data.id,
        name: data.full_name || name,
        role: data.role || 'Guest',
        initials: data.initials || initials,
        color: data.color || color,
      };
      setTeam((prev) => [...prev, member]);
      return member;
    },

    ensureAttendee: async (meetingId: string, profileId: string) => {
      // Update local state first so subsequent renders show this person as
      // an attendee of this meeting.
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId && !m.attendees.includes(profileId)
            ? { ...m, attendees: [...m.attendees, profileId] }
            : m,
        ),
      );
      // Idempotent on the composite PK; safe to call even if already present.
      await supabase
        .from('meeting_attendees')
        .upsert({ meeting_id: meetingId, profile_id: profileId }, { onConflict: 'meeting_id,profile_id' });
    },
  };

  const onAddAgenda = async (item: string, sectionId: string) => {
    const maxOrder = seriesAgenda.reduce((m, a) => Math.max(m, a.sort_order), 0);
    const row = { series_id: seriesId, section_id: sectionId, item, sort_order: maxOrder + 1 };
    const { data, error } = await supabase.from('agenda_items').insert(row).select().single();
    if (!error && data) setAgenda((prev) => [...prev, data as AgendaItem]);
  };

  const onAddMeeting = async (dateISO: string) => {
    // Auto-label: "DD Mon" (e.g. "27 Apr"), matching the seed format.
    const d = new Date(dateISO + 'T00:00:00');
    const label = `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
    const todayStart = startOfToday();
    const isUpcoming = d >= todayStart;

    const row = {
      series_id: seriesId,
      meeting_date: dateISO,
      label,
      upcoming: isUpcoming,
    };
    const { data: inserted, error } = await supabase
      .from('meetings')
      .insert(row)
      .select()
      .single();
    if (error || !inserted) {
      console.error('[onAddMeeting]', error);
      return null;
    }

    // If the new meeting is upcoming, un-flag any prior upcoming meetings in
    // this series so only one "Upcoming" badge shows at a time.
    if (isUpcoming) {
      const priorUpcoming = meetings.filter(
        (m) => m.series_id === seriesId && m.upcoming && m.id !== inserted.id,
      );
      if (priorUpcoming.length > 0) {
        await supabase
          .from('meetings')
          .update({ upcoming: false })
          .in('id', priorUpcoming.map((m) => m.id));
      }
    }

    const newMeeting: Meeting = {
      ...(inserted as Meeting),
      attendees: [],
      apologies: [],
    };
    setMeetings((prev) => {
      const cleaned = isUpcoming
        ? prev.map((m) => (m.series_id === seriesId ? { ...m, upcoming: false } : m))
        : prev;
      return [...cleaned, newMeeting].sort((a, b) =>
        a.meeting_date.localeCompare(b.meeting_date),
      );
    });
    return newMeeting;
  };

  const onSaveMeetingEdit = async (meetingId: string, patch: MeetingEditPatch) => {
    // 1) Update the meetings row.
    const { error: upErr } = await supabase
      .from('meetings')
      .update({
        meeting_date: patch.meeting_date,
        meeting_time: patch.meeting_time,
        label: patch.label,
        chair_id: patch.chair_id,
        upcoming: patch.upcoming,
      })
      .eq('id', meetingId);
    if (upErr) {
      console.error('[onSaveMeetingEdit] meetings update', upErr);
      return;
    }

    // 2) If marking upcoming, un-flag other upcoming meetings in this series.
    if (patch.upcoming) {
      const siblings = meetings.filter(
        (m) => m.series_id === seriesId && m.upcoming && m.id !== meetingId,
      );
      if (siblings.length > 0) {
        await supabase
          .from('meetings')
          .update({ upcoming: false })
          .in('id', siblings.map((m) => m.id));
      }
    }

    // 3) Sync attendance.
    // Compute the desired state and diff against what's in the DB.
    const desiredIn: string[] = [];
    const desiredApol: string[] = [];
    const desiredOut: string[] = [];
    Object.entries(patch.attendance).forEach(([profileId, state]) => {
      if (state === 'in') desiredIn.push(profileId);
      else if (state === 'apology') desiredApol.push(profileId);
      else desiredOut.push(profileId);
    });

    // Remove anyone marked "out"
    if (desiredOut.length > 0) {
      await supabase
        .from('meeting_attendees')
        .delete()
        .eq('meeting_id', meetingId)
        .in('profile_id', desiredOut);
    }

    // Upsert in/apology rows
    const rows = [
      ...desiredIn.map((profile_id) => ({
        meeting_id: meetingId, profile_id, is_chair: profile_id === patch.chair_id, is_apology: false,
      })),
      ...desiredApol.map((profile_id) => ({
        meeting_id: meetingId, profile_id, is_chair: false, is_apology: true,
      })),
    ];
    if (rows.length > 0) {
      await supabase
        .from('meeting_attendees')
        .upsert(rows, { onConflict: 'meeting_id,profile_id' });
    }

    // 4) Update local state.
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) {
          if (patch.upcoming && m.series_id === seriesId && m.upcoming) {
            return { ...m, upcoming: false };
          }
          return m;
        }
        return {
          ...m,
          meeting_date: patch.meeting_date,
          meeting_time: patch.meeting_time,
          label: patch.label,
          chair_id: patch.chair_id,
          upcoming: patch.upcoming,
          attendees: desiredIn,
          apologies: desiredApol,
        };
      }).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)),
    );
  };

  const onCreateSeries = async (input: NewSeriesInput) => {
    const { data: seriesRow, error: seriesErr } = await supabase
      .from('meeting_series')
      .insert({
        slug: input.series.slug,
        name: input.series.name,
        cadence: input.series.cadence,
        description: input.series.description,
        color_accent: input.series.color_accent,
      })
      .select()
      .single();
    if (seriesErr || !seriesRow) {
      console.error(seriesErr);
      return;
    }

    const sectionsToInsert = [
      { slug: 'checkin',     name: 'Check-in',        color: 'oklch(0.72 0.08 160)', sort_order: 1 },
      { slug: 'performance', name: 'Performance',     color: 'oklch(0.70 0.10 250)', sort_order: 2 },
      { slug: 'strategic',   name: 'Strategic Focus', color: 'oklch(0.70 0.12 40)',  sort_order: 3 },
      { slug: 'operational', name: 'Operational',     color: 'oklch(0.70 0.09 310)', sort_order: 4 },
      { slug: 'close',       name: 'Close',           color: 'oklch(0.70 0.06 100)', sort_order: 5 },
    ].map((s) => ({ ...s, series_id: (seriesRow as MeetingSeries).id }));

    const { data: sectionRows } = await supabase.from('sections').insert(sectionsToInsert).select();
    const sectionMap = new Map<string, string>();
    (sectionRows as Section[] | null ?? []).forEach((s) => sectionMap.set(s.slug, s.id));

    const agendaToInsert = input.agenda.map((a) => ({
      series_id: (seriesRow as MeetingSeries).id,
      section_id: sectionMap.get(a.section_slug) ?? null,
      item: a.item,
      sort_order: a.sort_order,
    }));
    const { data: agendaRows } = await supabase.from('agenda_items').insert(agendaToInsert).select();

    setSeriesList((prev) => [...prev, seriesRow as MeetingSeries]);
    setSections((prev) => [...prev, ...((sectionRows as Section[] | null) ?? [])]);
    setAgenda((prev) => [...prev, ...((agendaRows as AgendaItem[] | null) ?? [])]);
    setSeriesId((seriesRow as MeetingSeries).id);
    setNewSeriesOpen(false);
  };

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        page={page}
        setPage={setPage}
        counts={{ openActions: openActionCount, decisions: seriesDecisions.length }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        user={user}
      />
      <main className="main">
        <Topbar pageTitle={pageMeta[page].title} crumb="M Squared / Meeting OS" />
        <div className="content">
          <div className="page-header">
            <div>
              {page === 'horizontal' && seriesList.length > 0 ? (
                <SeriesPicker
                  series={seriesList}
                  value={seriesId}
                  onChange={setSeriesId}
                  onCreate={() => setNewSeriesOpen(true)}
                />
              ) : (
                <h2 className="page-title">{pageMeta[page].title}</h2>
              )}
              <div className="page-sub">{pageMeta[page].sub}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {page === 'horizontal' && (
                <button className="btn sm ghost">
                  <Icon name="sparkle" className="ic sm" /> Summarise meeting
                </button>
              )}
              <button className="btn sm">
                <Icon name="kbd" className="ic sm" /> ⌘K
              </button>
            </div>
          </div>

          {settings.stats === 'show' && page !== 'horizontal' && <Stats items={statsFor[page]} />}

          {page === 'horizontal' && (
            <HorizontalView
              data={data}
              agenda={seriesAgenda}
              sections={seriesSections}
              meetings={seriesMeetings}
              cells={seriesCells}
              actions={seriesActions}
              decisions={seriesDecisions}
              selected={selected}
              setSelected={setSelected}
              cellStyle={settings.cellStyle}
              onAddAgenda={onAddAgenda}
              onAddMeeting={onAddMeeting}
              onEditMeeting={setEditingMeetingId}
            />
          )}
          {page === 'actions' && (
            <ActionLog
              data={data}
              agenda={seriesAgenda}
              meetings={seriesMeetings}
              actions={seriesActions}
              setActionStatus={handlers.setActionStatus}
            />
          )}
          {page === 'decisions' && (
            <DecisionLog
              data={data}
              agenda={seriesAgenda}
              sections={seriesSections}
              meetings={seriesMeetings}
              decisions={seriesDecisions}
              currentSeries={currentSeries}
            />
          )}
        </div>
      </main>

      {selected && (
        <CellDrawer
          data={data}
          agenda={seriesAgenda}
          sections={seriesSections}
          meetings={seriesMeetings}
          cells={seriesCells}
          actions={seriesActions}
          decisions={seriesDecisions}
          selected={selected}
          setSelected={setSelected}
          onClose={() => setSelected(null)}
          handlers={handlers}
        />
      )}

      <TweaksPanel settings={settings} setSettings={setSettings} />

      <NewSeriesModal
        open={newSeriesOpen}
        onClose={() => setNewSeriesOpen(false)}
        onCreate={onCreateSeries}
      />

      <MeetingEditModal
        open={!!editingMeeting}
        meeting={editingMeeting}
        team={team}
        onClose={() => setEditingMeetingId(null)}
        onSave={(patch) => onSaveMeetingEdit(editingMeeting!.id, patch)}
        onAddTeammate={handlers.addTeamMember}
      />
    </div>
  );
}
