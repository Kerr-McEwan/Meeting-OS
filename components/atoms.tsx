'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  DECISION_STATUS_LABELS,
  DECISION_STATUS_ORDER,
  type ActionStatus,
  type CellStatus,
  type DecisionStatus,
  type MeetingSeries,
} from '@/lib/types';

type IconName =
  | 'home' | 'grid' | 'check' | 'lightbulb' | 'calendar' | 'filter'
  | 'sliders' | 'close' | 'arrow' | 'dot' | 'users' | 'link'
  | 'chevron' | 'chevron-left' | 'chevron-right' | 'edit' | 'sparkle' | 'kbd';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  home:            <><path d="M3 10.5 10 4l7 6.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1v-5.5Z"/></>,
  grid:            <><rect x="3" y="3" width="14" height="14" rx="1.5"/><path d="M3 8h14M8 3v14"/></>,
  check:           <><polyline points="4 11 8 15 16 6"/></>,
  lightbulb:       <><path d="M7 15h6M8 17.5h4M10 3a5 5 0 0 0-3 9c0 1 .5 2 1 2.5h4c.5-.5 1-1.5 1-2.5a5 5 0 0 0-3-9Z"/></>,
  calendar:        <><rect x="3" y="4.5" width="14" height="13" rx="1.5"/><path d="M3 8h14M7 3v3M13 3v3"/></>,
  filter:          <><path d="M3 4h14l-5.5 7v5l-3 1.5V11L3 4Z"/></>,
  sliders:         <><path d="M3 6h8M13 6h4M3 14h4M9 14h8"/><circle cx="12" cy="6" r="1.5"/><circle cx="8" cy="14" r="1.5"/></>,
  close:           <><path d="M5 5l10 10M15 5 5 15"/></>,
  arrow:           <><path d="M4 10h12M12 6l4 4-4 4"/></>,
  dot:             <><circle cx="10" cy="10" r="3"/></>,
  users:           <><circle cx="7" cy="8" r="3"/><path d="M2 17c.5-2.5 2.5-4 5-4s4.5 1.5 5 4"/><circle cx="14" cy="7" r="2.5"/><path d="M12.5 13c.8-.4 1.7-.6 2.5-.6 2 0 3.5 1.2 4 3.1"/></>,
  link:            <><path d="M9 11a3 3 0 0 0 4.2.4l2.5-2.5a3 3 0 0 0-4.2-4.2l-.9.9"/><path d="M11 9a3 3 0 0 0-4.2-.4L4.3 11.1a3 3 0 0 0 4.2 4.2l.9-.9"/></>,
  chevron:         <><polyline points="7 5 13 10 7 15"/></>,
  'chevron-left':  <><polyline points="13 5 7 10 13 15"/></>,
  'chevron-right': <><polyline points="7 5 13 10 7 15"/></>,
  edit:            <><path d="M4 16h3l9-9a2 2 0 0 0-3-3l-9 9v3Z"/><path d="M12 4l3 3"/></>,
  sparkle:         <><path d="M10 3v4M10 13v4M3 10h4M13 10h4M6 6l2 2M14 14l-2-2M6 14l2-2M14 6l-2 2"/></>,
  kbd:             <><rect x="2" y="5" width="16" height="10" rx="1.5"/><path d="M6 9v2M10 9v2M14 9v2"/></>,
};

export function Icon({ name, className = 'ic', style }: { name: IconName; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" style={style}>
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

export function Avatar({
  person,
  size = 'md',
}: {
  person: { initials: string; color: string; name: string } | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (!person) return null;
  return (
    <span className={`avatar ${size === 'sm' ? 'sm' : ''}`} style={{ background: person.color }} title={person.name}>
      {person.initials}
    </span>
  );
}

const STATUS_ORDER: ActionStatus[] = ['to_action', 'in_progress', 'stuck', 'done', 'closed'];
const STATUS_LABELS: Record<string, string> = {
  to_action: 'To action',
  in_progress: 'In progress',
  stuck: 'Stuck',
  done: 'Done',
  closed: 'Closed',
  carry: 'Carry forward',
};

export function StatusPill({
  value,
  onChange,
}: {
  value: CellStatus;
  onChange?: (s: CellStatus) => void;
}) {
  const advance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onChange) return;
    const cycle = STATUS_ORDER as readonly CellStatus[];
    const i = cycle.indexOf(value);
    const next = cycle[(i + 1) % cycle.length];
    onChange(next);
  };
  return (
    <span
      className={`status ${value}`}
      onClick={advance}
      title={onChange ? 'Click to cycle status' : undefined}
    >
      {STATUS_LABELS[value] || value}
    </span>
  );
}

export function StatusDropdown({
  value,
  onChange,
}: {
  value: ActionStatus;
  onChange: (s: ActionStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <span className="status-dd" ref={ref}>
      <button
        type="button"
        className={`status status-trigger ${value}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <span>{STATUS_LABELS[value] || value}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="status-menu" role="listbox">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`status-menu-item ${s === value ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
            >
              <span className={`status-swatch ${s}`} />
              <span>{STATUS_LABELS[s]}</span>
              {s === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ marginLeft: 'auto' }}>
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function SeriesPicker({
  series,
  value,
  onChange,
  onCreate,
  onEdit,
}: {
  series: MeetingSeries[];
  value: string;
  onChange: (id: string) => void;
  onCreate?: () => void;
  onEdit?: (seriesId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = series.find((s) => s.id === value) || series[0];

  const live = series.filter((s) => !s.archived_at);
  const archived = series.filter((s) => !!s.archived_at);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!current) return null;

  const renderItem = (s: MeetingSeries) => (
    <div key={s.id} className={`series-menu-row ${s.archived_at ? 'archived' : ''}`}>
      <button
        type="button"
        className={`series-menu-item ${s.id === value ? 'selected' : ''}`}
        onClick={() => { onChange(s.id); setOpen(false); }}
      >
        <span className="series-dot" style={{ background: s.color_accent || 'var(--accent)' }} />
        <div className="series-menu-text">
          <div className="series-menu-name">
            {s.name}
            {s.archived_at && <span className="series-archived-tag">Archived</span>}
          </div>
          <div className="series-menu-cad">{s.cadence || '—'}</div>
        </div>
        {s.id === value && (
          <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--accent)' }}>
            <path d="M2.5 6.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {onEdit && (
        <button
          type="button"
          className="series-menu-edit"
          onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(s.id); }}
          title="Edit series settings"
          aria-label="Edit series"
        >
          <Icon name="edit" className="ic sm" />
        </button>
      )}
    </div>
  );

  return (
    <div className="series-picker" ref={ref}>
      <button type="button" className="series-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="series-dot" style={{ background: current.color_accent || 'var(--accent)' }} />
        <span className="series-name">{current.name}</span>
        <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="series-menu" role="listbox">
          <div className="series-menu-label">Switch meeting series</div>
          {live.map(renderItem)}

          {archived.length > 0 && (
            <>
              <div className="series-menu-divider" />
              <button
                type="button"
                className="series-menu-toggle"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
              </button>
              {showArchived && archived.map(renderItem)}
            </>
          )}

          {onCreate && (
            <>
              <div className="series-menu-divider" />
              <button
                type="button"
                className="series-menu-item series-menu-new"
                onClick={() => { setOpen(false); onCreate(); }}
              >
                <span className="series-plus">+</span>
                <span>New meeting series…</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <svg className="ic sm" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 13l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <Icon name="close" className="ic sm" />
        </button>
      )}
    </div>
  );
}

export function DecisionStatusPill({
  value,
  onChange,
}: {
  value: DecisionStatus;
  onChange?: (s: DecisionStatus) => void;
}) {
  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onChange) return;
    const i = DECISION_STATUS_ORDER.indexOf(value);
    onChange(DECISION_STATUS_ORDER[(i + 1) % DECISION_STATUS_ORDER.length]);
  };
  return (
    <span
      className={`d-status ${value}`}
      onClick={cycle}
      title={onChange ? 'Click to cycle status' : undefined}
    >
      {DECISION_STATUS_LABELS[value] || value}
    </span>
  );
}

export function DecisionStatusDropdown({
  value,
  onChange,
}: {
  value: DecisionStatus;
  onChange: (s: DecisionStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <span className="status-dd" ref={ref}>
      <button
        type="button"
        className={`d-status status-trigger ${value}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <span>{DECISION_STATUS_LABELS[value] || value}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="status-menu" role="listbox">
          {DECISION_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`status-menu-item ${s === value ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
            >
              <span className={`status-swatch d-${s}`} />
              <span>{DECISION_STATUS_LABELS[s]}</span>
              {s === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ marginLeft: 'auto' }}>
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

