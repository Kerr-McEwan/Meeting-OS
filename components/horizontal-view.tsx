'use client';

import React, { useMemo, useState } from 'react';
import { Icon, Avatar, StatusPill } from './atoms';
import { formatDateLong, personById } from '@/lib/utils';
import type {
  Action,
  AgendaItem,
  Cell,
  Decision,
  InitialData,
  Meeting,
  Section,
  TeamMember,
  TweaksSettings,
} from '@/lib/types';

export interface SelectedCell {
  aId: string;
  mId: string;
  kind: 'notes' | 'decisions' | 'actions';
}

export function AssigneePicker({
  team,
  value,
  onChange,
  onAddTeammate,
}: {
  team: TeamMember[];
  value: string | null;
  onChange: (id: string) => void;
  onAddTeammate?: (name: string) => Promise<TeamMember | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = newName.trim();
    if (!name || !onAddTeammate || busy) return;
    setBusy(true);
    const created = await onAddTeammate(name);
    setBusy(false);
    if (created) {
      onChange(created.id);
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <div className="assignee-picker">
      {team.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`ap-chip ${value === p.id ? 'on' : ''}`}
          onClick={() => onChange(p.id)}
          title={p.name}
        >
          <Avatar person={p} size="sm" />
          <span className="ap-name">{p.name.split(' ')[0]}</span>
        </button>
      ))}

      {onAddTeammate && (adding ? (
        <span className="ap-chip ap-add-form">
          <input
            autoFocus
            className="ap-add-input"
            placeholder="Name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') { setAdding(false); setNewName(''); }
            }}
            disabled={busy}
          />
          <button
            type="button"
            className="ap-add-go"
            onClick={submit}
            disabled={!newName.trim() || busy}
            aria-label="Add teammate"
          >
            {busy ? '…' : '✓'}
          </button>
          <button
            type="button"
            className="ap-add-cancel"
            onClick={() => { setAdding(false); setNewName(''); }}
            aria-label="Cancel"
          >
            ×
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="ap-chip ap-add"
          onClick={() => setAdding(true)}
          title="Add a new teammate"
        >
          <span className="ap-add-plus">+</span>
          <span className="ap-name">Add</span>
        </button>
      ))}
    </div>
  );
}

interface HorizontalViewProps {
  data: InitialData;
  agenda: AgendaItem[];
  sections: Section[];
  meetings: Meeting[];
  cells: Cell[];
  actions: Action[];
  decisions: Decision[];
  selected: SelectedCell | null;
  setSelected: (s: SelectedCell | null) => void;
  cellStyle: TweaksSettings['cellStyle'];
  onAddAgenda: (item: string, sectionId: string) => void;
  onAddMeeting: (date: string) => Promise<Meeting | null>;
  onEditMeeting: (meetingId: string) => void;
}

export function HorizontalView({
  data,
  agenda,
  sections,
  meetings,
  cells,
  actions,
  decisions,
  selected,
  setSelected,
  cellStyle,
  onAddAgenda,
  onAddMeeting,
  onEditMeeting,
}: HorizontalViewProps) {
  const [hover, setHover] = useState<null | { aId: string; mId: string; x: number; y: number }>(null);
  const [adding, setAdding] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemSection, setNewItemSection] = useState(sections[0]?.id || '');
  const [showArchived, setShowArchived] = useState(false);
  const [addingMeeting, setAddingMeeting] = useState(false);

  // Visible meetings: live ones always, archived ones gated on the toggle.
  const visibleMeetings = showArchived
    ? meetings
    : meetings.filter((m) => !m.archived_at);
  const archivedCount = meetings.filter((m) => m.archived_at).length;
  const [newMeetingDate, setNewMeetingDate] = useState<string>(() => {
    const live = meetings.filter((m) => !m.archived_at);
    const last = live[live.length - 1];
    const base = last ? new Date(last.meeting_date + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + 7);
    return base.toISOString().slice(0, 10);
  });
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const submitNewMeeting = async () => {
    if (!newMeetingDate || creatingMeeting) return;
    setCreatingMeeting(true);
    await onAddMeeting(newMeetingDate);
    setCreatingMeeting(false);
    setAddingMeeting(false);
  };

  const cellOf = (aId: string, mId: string) =>
    cells.find((c) => c.agenda_item_id === aId && c.meeting_id === mId);
  const decisionsFor = (aId: string, mId: string) =>
    decisions.filter((d) => d.agenda_item_id === aId && d.meeting_id === mId);
  const actionsFor = (aId: string, mId: string) =>
    actions.filter((ac) => ac.agenda_item_id === aId && ac.meeting_id === mId);
  const sectionOf = (id: string | null) => sections.find((s) => s.id === id);

  const carryCount = useMemo(() => cells.filter((c) => c.status === 'carry').length, [cells]);

  const addAgendaItem = () => {
    if (!newItemText.trim() || !newItemSection) return;
    onAddAgenda(newItemText.trim(), newItemSection);
    setNewItemText('');
    setAdding(false);
  };

  const renderNotes = (c: Cell | undefined, m: Meeting) => {
    if (!c) return m.upcoming ? <span className="cell-placeholder">+ capture notes</span> : <span className="cell-placeholder">—</span>;
    if (cellStyle === 'pills') return <span className="cell-pill">{c.notes.split(/[\.\-—]/)[0].trim().slice(0, 40) || '—'}</span>;
    if (cellStyle === 'dots')
      return (
        <>
          <span className={`cell-dot ${c.status}`} />
          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 11.5 }}>{c.notes.length} chars</span>
        </>
      );
    return <span className="cell-text">{c.notes}</span>;
  };

  return (
    <div>
      <div className="pivot-wrap">
        <div className="pivot-toolbar">
          <span style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{agenda.length}</strong> agenda items
            <span style={{ margin: '0 8px', color: 'var(--text-dim)' }}>·</span>
            <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{visibleMeetings.length}</strong> meetings
            <span style={{ margin: '0 8px', color: 'var(--text-dim)' }}>·</span>
            <strong style={{ color: 'var(--warn)', fontWeight: 600 }}>{carryCount}</strong> carry-forward
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 8 }}>
            Each meeting has 3 tracks: Notes · Decisions · Actions
          </span>
          <button className="btn sm ghost"><Icon name="filter" className="ic sm" /> Filter</button>
          {archivedCount > 0 && (
            <button
              className={`btn sm ghost ${showArchived ? 'on' : ''}`}
              onClick={() => setShowArchived((v) => !v)}
              title={showArchived ? 'Hide archived meetings' : 'Show archived meetings'}
            >
              {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
            </button>
          )}
          {addingMeeting ? (
            <span className="new-meeting-form">
              <input
                type="date"
                className="field-input sm"
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNewMeeting();
                  if (e.key === 'Escape') setAddingMeeting(false);
                }}
                autoFocus
              />
              <button
                className="btn sm primary"
                onClick={submitNewMeeting}
                disabled={!newMeetingDate || creatingMeeting}
              >
                {creatingMeeting ? 'Creating…' : 'Create'}
              </button>
              <button
                className="btn sm ghost"
                onClick={() => setAddingMeeting(false)}
                disabled={creatingMeeting}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              className="btn sm primary"
              onClick={() => setAddingMeeting(true)}
            >
              <Icon name="calendar" className="ic sm" /> New meeting
            </button>
          )}
        </div>
        <div className="pivot-scroll">
          <table className="pivot tri">
            <thead>
              <tr className="meeting-row">
                <th className="corner row-head" rowSpan={2}>Agenda item</th>
                {visibleMeetings.map((m) => {
                  const attendees = m.attendees
                    .map((id) => personById(data.team, id))
                    .filter((x): x is TeamMember => Boolean(x));
                  return (
                    <th
                      key={m.id}
                      colSpan={3}
                      className={`meeting-head editable ${m.upcoming ? 'upcoming' : ''} ${m.archived_at ? 'archived' : ''}`}
                      onClick={() => onEditMeeting(m.id)}
                      title={m.archived_at ? 'Archived — click to edit or restore' : 'Click to edit meeting'}
                      role="button"
                    >
                      <span className="mh-edit-hint" aria-hidden="true">
                        <Icon name="edit" className="ic sm" />
                      </span>
                      <div className="mh-top">
                        <div className="mh-date">
                          <div className="mh-label">{m.label}</div>
                          <div className="col-date">
                            {formatDateLong(m.meeting_date).split(',')[0]}
                            {m.meeting_time && (
                              <span className="mh-time"> · {m.meeting_time.slice(0, 5)}</span>
                            )}
                          </div>
                        </div>
                        {m.upcoming && <span className="col-flag">Upcoming</span>}
                        {m.archived_at && <span className="col-flag archived">Archived</span>}
                      </div>
                      <div className="mh-attendees-label">Attendees</div>
                      <div className="mh-attendees" title={attendees.map((p) => p.name).join(', ')}>
                        {attendees.slice(0, 5).map((p) => (
                          <span
                            key={p.id}
                            className={`mh-chip ${p.id === m.chair_id ? 'is-chair' : ''}`}
                            title={`${p.name}${p.id === m.chair_id ? ' · Chair' : ''}`}
                          >
                            <Avatar person={p} size="sm" />
                          </span>
                        ))}
                        {m.apologies.length > 0 && (
                          <span
                            className="mh-apologies"
                            title={'Apologies: ' + m.apologies.map((id) => personById(data.team, id)?.name).join(', ')}
                          >
                            +{m.apologies.length} apol.
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr className="subhead-row">
                {visibleMeetings.flatMap((m) => [
                  <th key={m.id + '-n'} className={`subhead notes-h ${m.upcoming ? 'upcoming' : ''}`}>
                    <Icon name="edit" className="ic sm" style={{ verticalAlign: -2 }} /> Notes
                  </th>,
                  <th key={m.id + '-d'} className={`subhead dec-h ${m.upcoming ? 'upcoming' : ''}`}>
                    <Icon name="lightbulb" className="ic sm" style={{ verticalAlign: -2 }} /> Decisions
                  </th>,
                  <th key={m.id + '-a'} className={`subhead act-h ${m.upcoming ? 'upcoming' : ''}`}>
                    <Icon name="check" className="ic sm" style={{ verticalAlign: -2 }} /> Actions
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {agenda.map((a) => {
                const section = sectionOf(a.section_id);
                return (
                  <tr key={a.id}>
                    <th className="row-head">
                      <div className="row-head-inner">
                        <span className="section-bar" style={{ background: section?.color || 'var(--border)' }} />
                        <div className="row-title">
                          <div className="title">{a.item}</div>
                          {section && <span className="section-tag">{section.name}</span>}
                        </div>
                      </div>
                    </th>
                    {visibleMeetings.map((m) => {
                      const c = cellOf(a.id, m.id);
                      const decs = decisionsFor(a.id, m.id);
                      const acts = actionsFor(a.id, m.id);
                      const upcoming = m.upcoming;
                      const isArchived = !!m.archived_at;
                      const colMod = `${upcoming ? 'upcoming-col' : ''} ${isArchived ? 'archived-col' : ''}`.trim();
                      const isSelected = (kind: SelectedCell['kind']) =>
                        selected && selected.aId === a.id && selected.mId === m.id && selected.kind === kind;

                      return (
                        <React.Fragment key={m.id}>
                          <td
                            className={`tri-cell notes-cell ${colMod}`}
                            onMouseEnter={(e) => {
                              if (c) setHover({ aId: a.id, mId: m.id, x: e.clientX, y: e.clientY });
                            }}
                            onMouseMove={(e) => {
                              if (c) setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
                            }}
                            onMouseLeave={() => setHover(null)}
                          >
                            <button
                              className={`cell ${isSelected('notes') ? 'selected' : ''} ${!c ? 'empty' : ''}`}
                              onClick={() => setSelected({ aId: a.id, mId: m.id, kind: 'notes' })}
                            >
                              {renderNotes(c, m)}
                              {c?.status === 'carry' && <span className="cell-badge">carry</span>}
                            </button>
                          </td>

                          <td className={`tri-cell dec-cell ${colMod}`}>
                            <button
                              className={`cell ${isSelected('decisions') ? 'selected' : ''} ${decs.length === 0 ? 'empty' : ''}`}
                              onClick={() => setSelected({ aId: a.id, mId: m.id, kind: 'decisions' })}
                            >
                              {decs.length > 0 ? (
                                <ul className="mini-bullets">
                                  {decs.map((d) => (
                                    <li key={d.id}>
                                      <span className="b-dot dec" />
                                      <span style={{ flex: 1 }}>{d.text}</span>
                                      {d.owner_id && <Avatar person={personById(data.team, d.owner_id)} size="sm" />}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="cell-placeholder">{upcoming ? '+ log decision' : '—'}</span>
                              )}
                            </button>
                          </td>

                          <td className={`tri-cell act-cell ${colMod}`}>
                            <button
                              className={`cell ${isSelected('actions') ? 'selected' : ''} ${acts.length === 0 ? 'empty' : ''}`}
                              onClick={() => setSelected({ aId: a.id, mId: m.id, kind: 'actions' })}
                            >
                              {acts.length > 0 ? (
                                <ul className="mini-bullets">
                                  {acts.map((ac) => (
                                    <li key={ac.id}>
                                      <span className={`b-dot act ${ac.status}`} />
                                      <span className="b-act-title">{ac.title}</span>
                                      <span className="b-act-meta">
                                        <Avatar person={personById(data.team, ac.owner_id ?? '')} size="sm" />
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="cell-placeholder">{upcoming ? '+ add action' : '—'}</span>
                              )}
                            </button>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="add-agenda-row">
                <th className="row-head add-agenda-head" colSpan={1 + visibleMeetings.length * 3}>
                  {adding ? (
                    <div className="add-agenda-form">
                      <select
                        className="field-input sm"
                        value={newItemSection}
                        onChange={(e) => setNewItemSection(e.target.value)}
                      >
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        autoFocus
                        className="field-input sm"
                        placeholder="New agenda item…"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addAgendaItem();
                          if (e.key === 'Escape') { setAdding(false); setNewItemText(''); }
                        }}
                        style={{ flex: 1 }}
                      />
                      <button className="btn sm primary" disabled={!newItemText.trim()} onClick={addAgendaItem}>Add row</button>
                      <button className="btn sm ghost" onClick={() => { setAdding(false); setNewItemText(''); }}>Cancel</button>
                    </div>
                  ) : (
                    <button className="add-agenda-btn" onClick={() => setAdding(true)}>
                      <span className="add-plus">+</span> Add agenda item
                    </button>
                  )}
                </th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {hover && (() => {
        const c = cellOf(hover.aId, hover.mId);
        if (!c) return null;
        const a = agenda.find((x) => x.id === hover.aId);
        const m = meetings.find((x) => x.id === hover.mId);
        if (!a || !m) return null;
        const x = Math.min(hover.x + 14, window.innerWidth - 360);
        const y = Math.min(hover.y + 14, window.innerHeight - 180);
        return (
          <div className="hover-preview" style={{ left: x, top: y }}>
            <div className="hp-head">{a.item} · {m.label} · Notes</div>
            <div>{c.notes}</div>
            {c.status === 'carry' && (
              <div style={{ marginTop: 6 }}>
                <StatusPill value="carry" />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
