'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar, Topbar, Stats } from './sidebar';
import { Icon, SeriesPicker } from './atoms';
import { HorizontalView, type SelectedCell } from './horizontal-view';
import { CellDrawer, type CellDrawerHandlers } from './cell-drawer';
import { ActionLog } from './action-log';
import { DecisionLog } from './decision-log';
import { NewSeriesModal, type NewSeriesInput } from './new-series-modal';
import { SeriesEditModal, type SeriesEditPatch } from './series-edit-modal';
import { MeetingEditModal, type MeetingEditPatch } from './meeting-edit-modal';
import { IssueMinutesModal } from './issue-minutes-modal';
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
  SubItem,
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
  const [issuingMinutesId, setIssuingMinutesId] = useState<string | null>(null);
  const issuingMinutesMeeting = issuingMinutesId
    ? meetings.find((m) => m.id === issuingMinutesId) || null
    : null;
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const editingSeries = editingSeriesId
    ? seriesList.find((s) => s.id === editingSeriesId) || null
    : null;

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
  const seriesMeetingsAll = meetings.filter((m) => m.series_id === seriesId);
  // Hide archived meetings from logs and the pivot by default. The pivot
  // has its own "Show archived" toggle that re-includes them with a
  // faded treatment (see HorizontalView).
  const seriesMeetings = seriesMeetingsAll.filter((m) => !m.archived_at);
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
      const row = {
        series_id: seriesId,
        meeting_id: meetingId,
        agenda_item_id: agendaItemId,
        section_id: sectionId,
        owner_id: ownerId,
        text,
        status: 'open' as const,
      };
      const { data, error } = await supabase.from('decisions').insert(row).select().single();
      if (!error && data) setDecisions((prev) => [...prev, data as Decision]);
    },
    updateDecision: async (id, patch) => {
      const before = decisions.find((d) => d.id === id);
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } as Decision : d)));
      const { error } = await supabase.from('decisions').update(patch).eq('id', id);
      if (error) {
        console.error('[updateDecision]', error);
        if (before) setDecisions((prev) => prev.map((d) => (d.id === id ? before : d)));
      }
    },
    setDecisionStatus: async (id, status) => {
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
      const { error } = await supabase.from('decisions').update({ status }).eq('id', id);
      if (error) console.error('[setDecisionStatus]', error);
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
    updateAction: async (id, patch) => {
      const before = actions.find((a) => a.id === id);
      setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } as Action : a)));
      const { error } = await supabase.from('actions').update(patch).eq('id', id);
      if (error) {
        console.error('[updateAction]', error);
        if (before) setActions((prev) => prev.map((a) => (a.id === id ? before : a)));
      }
    },
    removeAction: async (id) => {
      setActions((prev) => prev.filter((a) => a.id !== id));
      await supabase.from('actions').delete().eq('id', id);
    },
    setActionStatus: async (id, status) => {
      setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      await supabase.from('actions').update({ status }).eq('id', id);
    },

    inviteTeammate: async ({ name, email, meetingId }) => {
      try {
        const res = await fetch('/api/invite-attendee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, meetingId }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          return { member: null, error: json.error || `Invite failed (HTTP ${res.status})` };
        }
        const member = json.member as TeamMember;
        // Add to local team list if not already there.
        setTeam((prev) => (prev.some((p) => p.id === member.id) ? prev : [...prev, member]));
        // Add to local meeting attendance.
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === meetingId && !m.attendees.includes(member.id)
              ? { ...m, attendees: [...m.attendees, member.id] }
              : m,
          ),
        );
        return {
          member,
          manualInviteLink: json.manualInviteLink ?? null,
          error: null,
        };
      } catch (err) {
        return { member: null, error: (err as Error).message || 'Invite failed' };
      }
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

  const onAddAgenda = async (item: string) => {
    const maxOrder = seriesAgenda.reduce((m, a) => Math.max(m, a.sort_order), 0);
    const row = { series_id: seriesId, item, sort_order: maxOrder + 1, sub_items: [] as SubItem[] };
    const { data, error } = await supabase.from('agenda_items').insert(row).select().single();
    if (!error && data) setAgenda((prev) => [...prev, data as AgendaItem]);
  };

    // Copy an agenda item (with all sub-items and discussion points) into a
  // target series. Target may be the same series — in that case it acts as
  // an in-place duplicate appended to the bottom. Returns the new item, or
  // null on failure.
  const onCopyAgenda = async (
    sourceId: string,
    targetSeriesId: string,
  ): Promise<AgendaItem | null> => {
    const source = agenda.find((a) => a.id === sourceId);
    if (!source) return null;
    // Sort order = max + 1 within the *target* series.
    const targetMax = agenda
      .filter((a) => a.series_id === targetSeriesId)
      .reduce((m, a) => Math.max(m, a.sort_order), 0);
    // Deep-clone sub_items so the copy doesn't share references with the
    // source (mutating one mustn't bleed into the other).
    const clonedSubs: SubItem[] = (source.sub_items || []).map((s) => ({
      text: s.text,
      points: [...(s.points || [])],
    }));
    const row = {
      series_id: targetSeriesId,
      item: source.item,
      sort_order: targetMax + 1,
      sub_items: clonedSubs,
    };
    const { data, error } = await supabase
      .from('agenda_items')
      .insert(row)
      .select()
      .single();
    if (error || !data) {
      console.error('[onCopyAgenda]', error);
      return null;
    }
    setAgenda((prev) => [...prev, data as AgendaItem]);
    return data as AgendaItem;
  };

const onUpdateAgenda = async (id: string, patch: { sub_items: SubItem[] }) => {
    const before = agenda.find((a) => a.id === id);
    setAgenda((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from('agenda_items').update(patch).eq('id', id);
    if (error) {
      console.error('[onUpdateAgenda]', error);
      if (before) setAgenda((prev) => prev.map((a) => (a.id === id ? before : a)));
    }
  };

  const onDeleteAgenda = async (id: string) => {
    // Optimistically remove from local state, including derived caches.
    setAgenda((prev) => prev.filter((a) => a.id !== id));
    setCells((prev) => prev.filter((c) => c.agenda_item_id !== id));
    setDecisions((prev) => prev.map((d) => (d.agenda_item_id === id ? { ...d, agenda_item_id: null } : d)));
    setActions((prev) => prev.map((ac) => (ac.agenda_item_id === id ? { ...ac, agenda_item_id: null } : ac)));
    const { error } = await supabase.from('agenda_items').delete().eq('id', id);
    if (error) {
      console.error('[onDeleteAgenda]', error);
      // No clean rollback for the cascade; reload would be safer.
    }
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

  const onArchiveMeeting = async (meetingId: string) => {
    const stamp = new Date().toISOString();
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === meetingId ? { ...m, archived_at: stamp, upcoming: false } : m,
      ),
    );
    const { error } = await supabase
      .from('meetings')
      .update({ archived_at: stamp, upcoming: false })
      .eq('id', meetingId);
    if (error) console.error('[onArchiveMeeting]', error);
  };

  const onRestoreMeeting = async (meetingId: string) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, archived_at: null } : m)),
    );
    const { error } = await supabase
      .from('meetings')
      .update({ archived_at: null })
      .eq('id', meetingId);
    if (error) console.error('[onRestoreMeeting]', error);
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

  const onUpdateSeries = async (id: string, patch: SeriesEditPatch) => {
    const before = seriesList.find((s) => s.id === id);
    setSeriesList((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from('meeting_series').update(patch).eq('id', id);
    if (error) {
      console.error('[onUpdateSeries]', error);
      if (before) setSeriesList((prev) => prev.map((s) => (s.id === id ? before : s)));
      window.alert(`Couldn't save: ${error.message}`);
    }
  };

  const onArchiveSeries = async (id: string) => {
    const stamp = new Date().toISOString();
    setSeriesList((prev) => prev.map((s) => (s.id === id ? { ...s, archived_at: stamp } : s)));
    // If the archived series was the active one, switch to another live series.
    if (seriesId === id) {
      const next = seriesList.find((s) => s.id !== id && !s.archived_at);
      if (next) setSeriesId(next.id);
    }
    const { error } = await supabase
      .from('meeting_series')
      .update({ archived_at: stamp })
      .eq('id', id);
    if (error) {
      console.error('[onArchiveSeries]', error);
      window.alert(`Couldn't archive series: ${error.message}`);
    }
  };

  const onRestoreSeries = async (id: string) => {
    setSeriesList((prev) => prev.map((s) => (s.id === id ? { ...s, archived_at: null } : s)));
    const { error } = await supabase
      .from('meeting_series')
      .update({ archived_at: null })
      .eq('id', id);
    if (error) {
      console.error('[onRestoreSeries]', error);
      window.alert(`Couldn't restore series: ${error.message}`);
    }
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
        created_by: user.id,
      })
      .select()
      .single();
    if (seriesErr || !seriesRow) {
      console.error('[onCreateSeries] series insert', seriesErr);
      window.alert(`Couldn't create series: ${seriesErr?.message || 'unknown error'}`);
      return;
    }

    const sectionsToInsert = [
      { slug: 'checkin',     name: 'Check-in',        color: 'oklch(0.72 0.08 160)', sort_order: 1 },
      { slug: 'performance', name: 'Performance',     color: 'oklch(0.70 0.10 250)', sort_order: 2 },
      { slug: 'strategic',   name: 'Strategic Focus', color: 'oklch(0.70 0.12 40)',  sort_order: 3 },
      { slug: 'operational', name: 'Operational',     color: 'oklch(0.70 0.09 310)', sort_order: 4 },
      { slug: 'close',       name: 'Close',           color: 'oklch(0.70 0.06 100)', sort_order: 5 },
    ].map((s) => ({ ...s, series_id: (seriesRow as MeetingSeries).id }));

    const { data: sectionRows, error: sectionErr } = await supabase
      .from('sections')
      .insert(sectionsToInsert)
      .select();
    if (sectionErr) {
      console.error('[onCreateSeries] sections insert', sectionErr);
      window.alert(
        `Series was created but sections couldn't be added: ${sectionErr.message}.\n\nThis usually means you need to run migration 0012 in Supabase.`,
      );
    }

    const agendaToInsert = input.agenda.map((a) => ({
      series_id: (seriesRow as MeetingSeries).id,
      item: a.item,
      sort_order: a.sort_order,
      sub_items: [] as SubItem[],
    }));
    const { data: agendaRows, error: agendaErr } = await supabase
      .from('agenda_items')
      .insert(agendaToInsert)
      .select();
    if (agendaErr) {
      console.error('[onCreateSeries] agenda insert', agendaErr);
      window.alert(
        `Series was created but agenda items couldn't be added: ${agendaErr.message}.\n\nThis usually means you need to run migration 0012 in Supabase.`,
      );
    }

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
                  onEdit={(id) => setEditingSeriesId(id)}
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
              onUpdateAgenda={onUpdateAgenda}
              onDeleteAgenda={onDeleteAgenda}
              onCopyAgenda={onCopyAgenda}
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
              setDecisionStatus={handlers.setDecisionStatus}
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

      <SeriesEditModal
        open={!!editingSeries}
        series={editingSeries}
        onClose={() => setEditingSeriesId(null)}
        onSave={(patch) => onUpdateSeries(editingSeries!.id, patch)}
        onArchive={async () => {
          if (!editingSeries) return;
          await onArchiveSeries(editingSeries.id);
        }}
        onRestore={async () => {
          if (!editingSeries) return;
          await onRestoreSeries(editingSeries.id);
        }}
      />

      <MeetingEditModal
        open={!!editingMeeting}
        meeting={editingMeeting}
        team={team}
        onClose={() => setEditingMeetingId(null)}
        onSave={(patch) => onSaveMeetingEdit(editingMeeting!.id, patch)}
        onAddTeammate={(input) =>
          handlers.inviteTeammate({ ...input, meetingId: editingMeeting?.id || '' })
        }
        onArchive={async () => {
          if (!editingMeeting) return;
          await onArchiveMeeting(editingMeeting.id);
          setEditingMeetingId(null);
        }}
        onRestore={async () => {
          if (!editingMeeting) return;
          await onRestoreMeeting(editingMeeting.id);
          setEditingMeetingId(null);
        }}
        onIssueMinutes={() => {
          if (!editingMeeting) return;
          // Open the minutes modal. The edit modal stays open behind it so
          // users can return to attendance/date editing after sending.
          setIssuingMinutesId(editingMeeting.id);
        }}
      />

      <IssueMinutesModal
        open={!!issuingMinutesMeeting}
        meeting={issuingMinutesMeeting}
        onClose={() => setIssuingMinutesId(null)}
      />
    </div>
  );
}
