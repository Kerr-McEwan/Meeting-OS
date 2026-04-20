'use client';

import React, { useState } from 'react';
import { Avatar, SearchInput } from './atoms';
import { formatDate, formatDateLong, personById } from '@/lib/utils';
import type { AgendaItem, Decision, InitialData, Meeting, MeetingSeries, Section } from '@/lib/types';

export function DecisionLog({
  data,
  agenda,
  sections,
  meetings,
  decisions,
  currentSeries,
}: {
  data: InitialData;
  agenda: AgendaItem[];
  sections: Section[];
  meetings: Meeting[];
  decisions: Decision[];
  currentSeries: MeetingSeries | null;
}) {
  const [meetingFilter, setMeetingFilter] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = decisions.filter((d) => {
    if (meetingFilter !== 'all' && d.meeting_id !== meetingFilter) return false;
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
              <th style={{ width: '50%' }}>Decision</th>
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
                  <td colSpan={5}>
                    {g.m.label} · {formatDateLong(g.m.meeting_date)} · {g.rows.length} decision{g.rows.length === 1 ? '' : 's'}
                  </td>
                </tr>
                {g.rows.map((d) => {
                  const a = agenda.find((x) => x.id === d.agenda_item_id);
                  const owner = personById(data.team, d.owner_id ?? '');
                  return (
                    <tr key={d.id}>
                      <td><div className="cell-title">{d.text}</div></td>
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
                <td colSpan={5}><div className="empty-state">No decisions match the current filters.</div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
