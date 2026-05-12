// Shared types for the Meeting OS UI. Keep these in sync with the SQL schema.

export type CellStatus =
  | 'done'
  | 'carry'
  | 'to_action'
  | 'in_progress'
  | 'stuck'
  | 'closed';

export type ActionStatus = 'to_action' | 'in_progress' | 'stuck' | 'done' | 'closed';
export type ActionPriority = 'low' | 'medium' | 'high';

export type DecisionStatus = 'open' | 'under_review' | 'discuss' | 'closed';
export const DECISION_STATUS_ORDER: DecisionStatus[] = ['open', 'under_review', 'discuss', 'closed'];
export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  discuss: 'Discuss',
  closed: 'Closed',
};

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  initials: string | null;
  role: string | null;
  color: string | null;
  is_admin?: boolean;
  is_guest?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  is_admin?: boolean;
}

export interface Section {
  id: string;
  series_id: string;
  slug: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface SubItem {
  text: string;
  points: string[];
}

export interface AgendaItem {
  id: string;
  series_id: string;
  section_id: string | null;
  item: string;
  sort_order: number;
  sub_items: SubItem[];
}

export interface Meeting {
  id: string;
  series_id: string;
  meeting_date: string;
  meeting_time: string | null;
  label: string | null;
  chair_id: string | null;
  upcoming: boolean;
  archived_at: string | null;
  attendees: string[];
  apologies: string[];
}

export interface Cell {
  id: string;
  agenda_item_id: string;
  meeting_id: string;
  notes: string;
  status: CellStatus;
}

export interface Decision {
  id: string;
  series_id: string;
  meeting_id: string;
  agenda_item_id: string | null;
  section_id: string | null;
  owner_id: string | null;
  text: string;
  status: DecisionStatus;
  created_at: string;
}

export interface Action {
  id: string;
  series_id: string;
  meeting_id: string | null;
  agenda_item_id: string | null;
  owner_id: string | null;
  title: string;
  due_date: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  raised_date: string;
}

export interface MeetingSeries {
  id: string;
  slug: string;
  name: string;
  cadence: string | null;
  description: string | null;
  color_accent: string | null;
  archived_at?: string | null;
}

export interface InitialData {
  team: TeamMember[];
  series: MeetingSeries[];
  currentSeriesId: string;
  sections: Section[];
  agenda: AgendaItem[];
  meetings: Meeting[];
  cells: Cell[];
  actions: Action[];
  decisions: Decision[];
}

export type Page = 'horizontal' | 'actions' | 'decisions';

export interface TweaksSettings {
  theme: 'light' | 'dark';
  density: 'compact' | 'comfy' | 'spacious';
  typography: 'sans' | 'serif' | 'mono';
  cellStyle: 'text' | 'pills' | 'dots';
  stats: 'show' | 'hide';
  accent: 'amber' | 'rose' | 'indigo' | 'teal' | 'graphite';
}

export const DEFAULT_TWEAKS: TweaksSettings = {
  theme: 'light',
  density: 'compact',
  typography: 'sans',
  cellStyle: 'text',
  stats: 'show',
  accent: 'amber',
};
