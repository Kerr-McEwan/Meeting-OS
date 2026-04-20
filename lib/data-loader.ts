import { createClient } from './supabase/server';
import type {
  Action,
  AgendaItem,
  Cell,
  Decision,
  InitialData,
  Meeting,
  MeetingSeries,
  Profile,
  Section,
  TeamMember,
} from './types';
import { autoColor, autoInitials } from './utils';

function profileToTeam(p: Profile): TeamMember {
  const name = p.full_name || (p.email ?? '').split('@')[0] || 'Unknown';
  return {
    id: p.id,
    name,
    role: p.role || '—',
    initials: p.initials || autoInitials(name),
    color: p.color || autoColor(p.id),
    is_admin: p.is_admin ?? false,
  };
}

export async function loadInitialData(): Promise<InitialData | null> {
  const supabase = createClient();

  const [
    profilesRes,
    seriesRes,
    sectionsRes,
    agendaRes,
    meetingsRes,
    attendeesRes,
    cellsRes,
    actionsRes,
    decisionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('meeting_series').select('*').order('created_at', { ascending: true }),
    supabase.from('sections').select('*').order('sort_order'),
    supabase.from('agenda_items').select('*').order('sort_order'),
    supabase.from('meetings').select('*').order('meeting_date'),
    supabase.from('meeting_attendees').select('*'),
    supabase.from('cells').select('*'),
    supabase.from('actions').select('*'),
    supabase.from('decisions').select('*'),
  ]);

  const err =
    profilesRes.error ||
    seriesRes.error ||
    sectionsRes.error ||
    agendaRes.error ||
    meetingsRes.error ||
    attendeesRes.error ||
    cellsRes.error ||
    actionsRes.error ||
    decisionsRes.error;
  if (err) {
    console.error('[data-loader]', err);
    return null;
  }

  const team: TeamMember[] = (profilesRes.data as Profile[] | null ?? []).map(profileToTeam);
  const series = (seriesRes.data as MeetingSeries[] | null) ?? [];
  const sections = (sectionsRes.data as Section[] | null) ?? [];
  const agenda = (agendaRes.data as AgendaItem[] | null) ?? [];
  const cells = (cellsRes.data as Cell[] | null) ?? [];
  const actions = (actionsRes.data as Action[] | null) ?? [];
  const decisions = (decisionsRes.data as Decision[] | null) ?? [];

  // Merge attendees into meetings
  type AttendeeRow = { meeting_id: string; profile_id: string; is_chair: boolean; is_apology: boolean };
  const attendeeRows = (attendeesRes.data as AttendeeRow[] | null) ?? [];
  const meetings: Meeting[] = (meetingsRes.data as Meeting[] | null ?? []).map((m) => {
    const rows = attendeeRows.filter((a) => a.meeting_id === m.id);
    return {
      ...m,
      attendees: rows.filter((a) => !a.is_apology).map((a) => a.profile_id),
      apologies: rows.filter((a) => a.is_apology).map((a) => a.profile_id),
    };
  });

  const currentSeriesId = series[0]?.id ?? '';

  return {
    team,
    series,
    currentSeriesId,
    sections,
    agenda,
    meetings,
    cells,
    actions,
    decisions,
  };
}
