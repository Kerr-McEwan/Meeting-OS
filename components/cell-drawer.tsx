'use client';

import React, { useEffect, useState } from 'react';
import { Icon, Avatar, StatusPill } from './atoms';
import { AssigneePicker, type SelectedCell } from './horizontal-view';
import { formatDate, formatDateLong, personById } from '@/lib/utils';
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
  Section,
  TeamMember,
} from '@/lib/types';

export interface CellDrawerHandlers {
  saveCell: (agendaItemId: string, meetingId: string, notes: string, status: CellStatus) => void;
  addDecision: (input: { meetingId: string; agendaItemId: string; sectionId: string | null; ownerId: string; text: string }) => void;
  removeDecision: (id: string) => void;
  addAction: (input: { meetingId: string; agendaItemId: string; ownerId: string; title: string; due: string | null; priority: ActionPriority }) => void;
  removeAction: (id: string) => void;
  setActionStatus: (id: string, status: ActionStatus) => void;
  addTeamMember: (name: string) => Promise<TeamMember | null>;
  ensureAttendee: (meetingId: string, profileId: string) => Promise<void>;
}

export function CellDrawer({
  data,
  agenda,
  sections,
  meetings,
  cells,
  actions,
  decisions,
  selected,
  setSelected,
  onClose,
  handlers,
}: {
  data: InitialData;
  agenda: AgendaItem[];
  sections: Section[];
  meetings: Meeting[];
  cells: Cell[];
  actions: Action[];
  decisions: Decision[];
  selected: SelectedCell | null;
  setSelected: (s: SelectedCell | null) => void;
  onClose: () => void;
  handlers: CellDrawerHandlers;
}) {
  const a = selected ? agenda.find((x) => x.id === selected.aId) : null;
  const m = selected ? meetings.find((x) => x.id === selected.mId) : null;
  const cell = selected
    ? cells.find((c) => c.agenda_item_id === selected.aId && c.meeting_id === selected.mId)
    : null;

  const [tab, setTab] = useState<SelectedCell['kind']>(selected?.kind ?? 'notes');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CellStatus>('done');
  const [newDecision, setNewDecision] = useState('');
  const [newDecisionOwner, setNewDecisionOwner] = useState<string | null>(null);
  const [newAction, setNewAction] = useState('');
  const [newActionOwner, setNewActionOwner] = useState<string | null>(null);
  const [newActionDue, setNewActionDue] = useState('');
  const [newActionPriority, setNewActionPriority] = useState<ActionPriority>('medium');

  const key = selected ? `${selected.aId}:${selected.mId}` : '';

  useEffect(() => {
    setNotes(cell?.notes || '');
    setStatus(cell?.status || (m?.upcoming ? 'to_action' : 'done'));
    setTab(selected?.kind || 'notes');
    setNewDecision(''); setNewAction('');
    setNewDecisionOwner(null); setNewActionOwner(null);
    setNewActionDue(m?.meeting_date || ''); setNewActionPriority('medium');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, selected?.kind]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
      if (tgt?.isContentEditable) return;
      const idx = agenda.findIndex((x) => x.id === selected.aId);
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        setSelected({ aId: agenda[idx - 1].id, mId: selected.mId, kind: selected.kind });
      } else if (e.key === 'ArrowRight' && idx < agenda.length - 1) {
        e.preventDefault();
        setSelected({ aId: agenda[idx + 1].id, mId: selected.mId, kind: selected.kind });
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, agenda, setSelected, onClose]);

  if (!selected || !a || !m) return null;

  const saveNotes = () => {
    handlers.saveCell(a.id, m.id, notes, status);
    onClose();
  };
  const markCarry = () => setStatus((s) => (s === 'carry' ? 'done' : 'carry'));

  const addDecision = () => {
    if (!newDecision.trim() || !newDecisionOwner) return;
    void handlers.ensureAttendee(m.id, newDecisionOwner);
    handlers.addDecision({
      meetingId: m.id,
      agendaItemId: a.id,
      sectionId: a.section_id,
      ownerId: newDecisionOwner,
      text: newDecision.trim(),
    });
    setNewDecision(''); setNewDecisionOwner(null);
  };

  const addAction = () => {
    if (!newAction.trim() || !newActionOwner) return;
    void handlers.ensureAttendee(m.id, newActionOwner);
    handlers.addAction({
      meetingId: m.id,
      agendaItemId: a.id,
      ownerId: newActionOwner,
      title: newAction.trim(),
      due: newActionDue || m.meeting_date,
      priority: newActionPriority,
    });
    setNewAction(''); setNewActionOwner(null); setNewActionPriority('medium'); setNewActionDue(m.meeting_date);
  };

  const section = sections.find((s) => s.id === a.section_id);
  const linkedDecisions = decisions.filter((d) => d.agenda_item_id === a.id && d.meeting_id === m.id);
  const linkedActions = actions.filter((ac) => ac.agenda_item_id === a.id && ac.meeting_id === m.id);
  // Always show the full team in the assignee picker — Kerr wants zero
  // friction to assign anything to anyone. Attendance is recorded silently
  // when an assignment is made (see handlers.ensureAttendee).
  const attendees = data.team;

  const idx = agenda.findIndex((x) => x.id === a.id);
  const prev = idx > 0 ? agenda[idx - 1] : null;
  const next = idx < agenda.length - 1 ? agenda[idx + 1] : null;
  const go = (target: AgendaItem | null) => {
    if (!target) return;
    setSelected({ aId: target.id, mId: selected.mId, kind: selected.kind });
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog">
        <div className="drawer-head">
          <div className="drawer-nav">
            <button
              className="drawer-nav-btn"
              onClick={() => go(prev)}
              disabled={!prev}
              title={prev ? `Previous: ${prev.item}` : 'No previous item'}
              aria-label="Previous agenda item"
            >
              <Icon name="chevron-left" className="ic sm" />
              <span className="drawer-nav-label">{prev?.item || 'Start'}</span>
            </button>
            <span className="drawer-nav-pos">
              {idx + 1} <span className="dim">/ {agenda.length}</span>
            </span>
            <button
              className="drawer-nav-btn right"
              onClick={() => go(next)}
              disabled={!next}
              title={next ? `Next: ${next.item}` : 'No next item'}
              aria-label="Next agenda item"
            >
              <span className="drawer-nav-label">{next?.item || 'End'}</span>
              <Icon name="chevron-right" className="ic sm" />
            </button>
            <span className="drawer-nav-spacer" />
            <button className="icon-btn drawer-close" onClick={onClose} aria-label="Close drawer">
              <Icon name="close" className="ic sm" />
            </button>
          </div>
          <div className="d-eyebrow" style={{ color: section?.color }}>{section?.name}</div>
          <h2>{a.item}</h2>
          <div className="drawer-meta">
            <span className="meta-pill">
              <Icon name="calendar" className="ic sm" style={{ verticalAlign: -2, marginRight: 4 }} />
              {formatDateLong(m.meeting_date)}
            </span>
            {m.chair_id && (
              <span className="meta-pill">
                Chair · {personById(data.team, m.chair_id)?.name || '—'}
              </span>
            )}
            <span className="meta-pill">{m.attendees.length} attendees</span>
            {m.upcoming && (
              <span className="meta-pill" style={{ background: 'var(--cream)', borderColor: 'var(--cream-border)', color: 'var(--text)' }}>
                Upcoming
              </span>
            )}
          </div>
        </div>

        <div className="drawer-tabs">
          {[
            { id: 'notes' as const,     label: 'Notes',     icon: 'edit' as const,      count: cell ? 1 : 0 },
            { id: 'decisions' as const, label: 'Decisions', icon: 'lightbulb' as const, count: linkedDecisions.length },
            { id: 'actions' as const,   label: 'Actions',   icon: 'check' as const,     count: linkedActions.length },
          ].map((t) => (
            <button key={t.id} className={`dtab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} className="ic sm" />
              {t.label}
              <span className="dtab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {tab === 'notes' && (
            <>
              <div className="field-label">
                Meeting notes{' '}
                <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  · summary from dictation
                </span>
              </div>
              <textarea
                className="field-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={m.upcoming ? 'Capture notes as the conversation unfolds…' : 'No notes captured.'}
              />
              <div style={{ marginTop: 16, display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div className="field-label">Status</div>
                  <StatusPill value={status} onChange={setStatus} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="field-label">Flag</div>
                  <button className="btn sm" onClick={markCarry}>
                    {status === 'carry' ? 'Clear carry-forward' : 'Carry forward'}
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'decisions' && (
            <>
              <div className="field-label">
                Decisions{' '}
                <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  · also appear in Decision Log
                </span>
              </div>
              <div className="inline-list">
                {linkedDecisions.map((d) => (
                  <div key={d.id} className="inline-item">
                    <Avatar person={personById(data.team, d.owner_id ?? '')} size="sm" />
                    <span style={{ flex: 1 }}>
                      <div>{d.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        Owner: {personById(data.team, d.owner_id ?? '')?.name || '— unassigned —'}
                      </div>
                    </span>
                    <button className="btn ghost sm icon" onClick={() => handlers.removeDecision(d.id)}>
                      <Icon name="close" className="ic sm" />
                    </button>
                  </div>
                ))}
                {linkedDecisions.length === 0 && (
                  <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 0' }}>No decisions yet.</div>
                )}
              </div>
              <div className="add-card">
                <input
                  className="field-input"
                  placeholder="Approve…, defer…, revise…"
                  value={newDecision}
                  onChange={(e) => setNewDecision(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDecision()}
                />
                <div className="add-row-meta">
                  <div style={{ flex: 1 }}>
                    <div className="field-mini-label">
                      Assignee <span style={{ color: 'var(--danger)' }}>*</span>
                    </div>
                    <AssigneePicker
                      team={attendees}
                      value={newDecisionOwner}
                      onChange={setNewDecisionOwner}
                      onAddTeammate={handlers.addTeamMember}
                    />
                  </div>
                  <button
                    className="btn sm primary"
                    disabled={!newDecision.trim() || !newDecisionOwner}
                    onClick={addDecision}
                  >
                    Log decision
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'actions' && (
            <>
              <div className="field-label">
                Actions{' '}
                <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  · also appear in Action Log
                </span>
              </div>
              <div className="inline-list">
                {linkedActions.map((ac) => (
                  <div key={ac.id} className="inline-item">
                    <Avatar person={personById(data.team, ac.owner_id ?? '')} size="sm" />
                    <span style={{ flex: 1 }}>
                      <div>{ac.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        <span className={`priority ${ac.priority}`}>{ac.priority}</span>
                        <span style={{ margin: '0 6px' }}>·</span>
                        Due {formatDate(ac.due_date)}
                      </div>
                    </span>
                    <StatusPill value={ac.status} onChange={(s) => handlers.setActionStatus(ac.id, s as ActionStatus)} />
                    <button className="btn ghost sm icon" onClick={() => handlers.removeAction(ac.id)}>
                      <Icon name="close" className="ic sm" />
                    </button>
                  </div>
                ))}
                {linkedActions.length === 0 && (
                  <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 0' }}>No actions yet.</div>
                )}
              </div>
              <div className="add-card">
                <input
                  className="field-input"
                  placeholder="What needs to happen?"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAction()}
                />
                <div className="add-row-meta">
                  <div style={{ flex: 1 }}>
                    <div className="field-mini-label">
                      Assignee <span style={{ color: 'var(--danger)' }}>*</span>
                    </div>
                    <AssigneePicker
                      team={attendees}
                      value={newActionOwner}
                      onChange={setNewActionOwner}
                      onAddTeammate={handlers.addTeamMember}
                    />
                  </div>
                  <div>
                    <div className="field-mini-label">Due</div>
                    <input
                      type="date"
                      className="field-input sm"
                      value={newActionDue}
                      onChange={(e) => setNewActionDue(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="field-mini-label">Priority</div>
                    <select
                      className="field-input sm"
                      value={newActionPriority}
                      onChange={(e) => setNewActionPriority(e.target.value as ActionPriority)}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <button
                    className="btn sm primary"
                    disabled={!newAction.trim() || !newActionOwner}
                    onClick={addAction}
                  >
                    Add action
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn ghost" onClick={onClose}>Close</button>
          <div style={{ flex: 1 }} />
          {tab === 'notes' && (
            <button className="btn primary" onClick={saveNotes}>Save notes</button>
          )}
        </div>
      </div>
    </>
  );
}
