'use client';

import React, { useState } from 'react';
import { Avatar, StatusDropdown, SearchInput } from './atoms';
import { formatDate, personById, startOfToday } from '@/lib/utils';
import type { Action, ActionStatus, AgendaItem, InitialData, Meeting } from '@/lib/types';

const STATUS_OPTIONS: { id: ActionStatus; label: string }[] = [
  { id: 'to_action',   label: 'To action' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'stuck',       label: 'Stuck' },
  { id: 'done',        label: 'Done' },
  { id: 'closed',      label: 'Closed' },
];

export function ActionLog({
  data,
  agenda,
  meetings,
  actions,
  setActionStatus,
}: {
  data: InitialData;
  agenda: AgendaItem[];
  meetings: Meeting[];
  actions: Action[];
  setActionStatus: (id: string, status: ActionStatus) => void;
}) {
  const [ownerFilter, setOwnerFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<ActionStatus[]>(['to_action', 'in_progress', 'stuck']);
  const [meetingFilter, setMeetingFilter] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');

  const today = startOfToday();
  const isOverdue = (ac: Action) =>
    ac.status !== 'done' &&
    ac.status !== 'closed' &&
    !!ac.due_date &&
    new Date(ac.due_date + 'T00:00:00') < today;

  const toggleStatus = (s: ActionStatus) => {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const q = query.trim().toLowerCase();
  const filtered = actions.filter((ac) => {
    if (ownerFilter !== 'all' && ac.owner_id !== ownerFilter) return false;
    if (!statusFilter.includes(ac.status)) return false;
    if (meetingFilter !== 'all' && ac.meeting_id !== meetingFilter) return false;
    if (q) {
      const ag = agenda.find((a) => a.id === ac.agenda_item_id);
      const owner = personById(data.team, ac.owner_id ?? '');
      const hay = [ac.title, ag?.item, owner?.name].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aOver = isOverdue(a), bOver = isOverdue(b);
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return ad - bd;
  });

  return (
    <div>
      <div className="log-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search actions…" />
      </div>
      <div className="filter-bar">
        <span className="chip-label">Status</span>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.id}
            className={`chip-btn ${statusFilter.includes(s.id) ? 'active' : ''}`}
            onClick={() => toggleStatus(s.id)}
          >
            {s.label}
            <span className="count">{actions.filter((a) => a.status === s.id).length}</span>
          </button>
        ))}
        <span className="chip-divider" />
        <span className="chip-label">Owner</span>
        <button
          className={`chip-btn ${ownerFilter === 'all' ? 'active' : ''}`}
          onClick={() => setOwnerFilter('all')}
        >All</button>
        {data.team.map((p) => (
          <button
            key={p.id}
            className={`chip-btn ${ownerFilter === p.id ? 'active' : ''}`}
            onClick={() => setOwnerFilter(p.id)}
            title={p.name}
          >
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            {p.initials}
          </button>
        ))}
        <span className="chip-divider" />
        <span className="chip-label">Meeting</span>
        <button
          className={`chip-btn ${meetingFilter === 'all' ? 'active' : ''}`}
          onClick={() => setMeetingFilter('all')}
        >All</button>
        {meetings.filter((m) => !m.upcoming).map((m) => (
          <button
            key={m.id}
            className={`chip-btn ${meetingFilter === m.id ? 'active' : ''}`}
            onClick={() => setMeetingFilter(m.id)}
          >
            {m.label}
            <span className="count">{actions.filter((a) => a.meeting_id === m.id).length}</span>
          </button>
        ))}
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Action</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Status</th>
              <th>Raised</th>
              <th>Days overdue</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ac) => {
              const ag = agenda.find((a) => a.id === ac.agenda_item_id);
              const overdue = isOverdue(ac);
              const daysOverdue =
                overdue && ac.due_date
                  ? Math.floor((today.getTime() - new Date(ac.due_date + 'T00:00:00').getTime()) / 86400000)
                  : 0;
              const owner = personById(data.team, ac.owner_id ?? '');
              return (
                <tr key={ac.id} className={overdue ? 'overdue' : ''}>
                  <td>
                    <div className="cell-title">{ac.title}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 11.5, marginTop: 2 }}>{ag?.item}</div>
                  </td>
                  <td>
                    {owner && (
                      <span className="owner-cell">
                        <Avatar person={owner} size="sm" />
                        {owner.name.split(' ')[0]}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`due ${overdue ? 'overdue' : ''}`}>{formatDate(ac.due_date)}</span>
                  </td>
                  <td>
                    <StatusDropdown value={ac.status} onChange={(s) => setActionStatus(ac.id, s)} />
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(ac.raised_date)}</td>
                  <td>
                    {overdue
                      ? <span className="due overdue" style={{ fontWeight: 600 }}>{daysOverdue} day{daysOverdue === 1 ? '' : 's'}</span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6}><div className="empty-state">No actions match the current filters.</div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
