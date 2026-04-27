'use client';

import React, { useState } from 'react';
import { Avatar, DecisionStatusDropdown, SearchInput } from './atoms';
import { formatDate, formatDateLong, personById } from '@/lib/utils';
import {
  DECISION_STATUS_LABELS,
  DECISION_STATUS_ORDER,
  type AgendaItem,
  type Decision,
  type DecisionStatus,
  type InitialData,
  type Meeting,
  type MeetingSeries,
  type Section,
} from '@/lib/types';

export function DecisionLog({
  data,
  agenda,
  sections,
  meetings,
  decisions,
  currentSeries,
  setDecisionStatus,
}: {
  data: InitialData;
  agenda: AgendaItem[];
  sections: Section[];
  meetings: Meeting[];
  decisions: Decision[];
  currentSeries: MeetingSeries | null;
  setDecisionStatus: (id: string, status: DecisionStatus) => void;
}) {
  const [meetingFilter, setMeetingFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<DecisionStatus[]>([
    'open', 'under_review', 'discuss', 'closed',
  ]);
  const [query, setQuery] = useState('');

  const toggleStatus = (s: DecisionStatus) => {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const q = query.trim().toLowerCase();
  const filtered = decisions.filter((d) => {
    if (meetingFilter !== 'all' && d.meeting_id !== meetingFilter) return false;
    if (!statusFilter.includes((d.status || 'open') as DecisionStatus)) return false;
    if (q) {
      const ag = agenda.find((a) => a.id === d.agenda_item_id);
      const owner = personById(data.team, d.owner_id ?? '');
      const hay = [d.text, ag?.item, owner?.name].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const byMeeting = [...meetings]
    .reverse()
    .map((m) => ({ m, rows: filtered.filter((d) => d.meeting_id === m.id) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div>
      <div className="log-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search decisions…" />
      </div>
      <div className="filter-bar">
        <span className="chip-label">Status</span>
        {DECISION_STATUS_ORDER.map((s) => (
          <button
            key={s}
            className={`chip-btn ${statusFilter.includes(s) ? 'active' : ''}`}
            onClick={() => toggleStatus(s)}
          >
            {DECISION_STATUS_LABELS[s]}
            <span className="count">
              {decisions.filter((d) => (d.status || 'open') === s).length}
            </span>
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
          >{m.label}</button>
        ))}
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Decision</th>
              <th>Status</th>
              <th>Meeting</th>
              <th>Agenda item</th>
              <th>Owner</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {byMeeting.map((g) => (
              <React.Fragment key={g.m.id}>
                <tr className="group-head">
                  <td colSpan={6}>
                    {g.m.label} · {formatDateLong(g.m.meeting_date)} · {g.rows.length} decision{g.rows.length === 1 ? '' : 's'}
                  </td>
                </tr>
                {g.rows.map((d) => {
                  const a = agenda.find((x) => x.id === d.agenda_item_id);
                  const owner = personById(data.team, d.owner_id ?? '');
                  return (
                    <tr key={d.id}>
                      <td><div className="cell-title">{d.text}</div></td>
                      <td>
                        <DecisionStatusDropdown
                          value={(d.status || 'open') as DecisionStatus}
                          onChange={(s) => setDecisionStatus(d.id, s)}
                        />
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{currentSeries?.name || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{a?.item || '—'}</td>
                      <td>
                        {owner ? (
                          <span className="owner-cell">
                            <Avatar person={owner} size="sm" />
                            {owner.name.split(' ')[0]}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>
                      <td className="due">{formatDate(g.m.meeting_date)}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}><div className="empty-state">No decisions match the current filters.</div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
