import type { TeamMember } from './types';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function daysUntil(iso: string): number {
  const d = new Date(iso + 'T00:00:00');
  const today = startOfToday();
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function personById(team: TeamMember[], id: string | null | undefined): TeamMember | undefined {
  if (!id) return undefined;
  return team.find((p) => p.id === id);
}

// Deterministic but varied palette for auto-generated avatar colours.
export function autoColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `oklch(0.70 0.10 ${hue})`;
}

export function autoInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}
