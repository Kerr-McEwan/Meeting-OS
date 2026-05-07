'use client';

import React, { useMemo, useState } from 'react';
import { Icon, Avatar, StatusPill } from './atoms';
import { formatDateLong, personById } from '@/lib/utils';
import type {
  Action,
  AgendaItem,
  Cell,
  Decision,
  SubItem,
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
  onAddTeammate?: (input: { name: string; email: string }) => Promise<{ member: TeamMember | null; manualInviteLink?: string | null; error?: string | null }>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);

  const submit = async () => {
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name || !email || !onAddTeammate || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setManualLink(null);
    const result = await onAddTeammate({ name, email });
    setBusy(false);
    if (result.error) {
      setErrorMsg(result.error);
      return;
    }
    if (result.manualInviteLink) {
      setManualLink(result.manualInviteLink);
    }
    if (result.member) {
      onChange(result.member.id);
      if (!result.manualInviteLink) {
        setNewName('');
        setNewEmail('');
        setAdding(false);
      }
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
        <div className="ap-add-card">
          <div className="ap-add-fields">
            <input
              autoFocus
              className="ap-add-input wide"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy}
            />
            <input
              type="email"
              className="ap-add-input wide"
              placeholder="work@email.co.uk"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') { setAdding(false); setNewName(''); setNewEmail(''); setErrorMsg(null); setManualLink(null); }
              }}
              disabled={busy}
            />
          </div>
          <div className="ap-add-actions">
            <button
              type="button"
              className="btn sm primary"
              onClick={submit}
              disabled={!newName.trim() || !newEmail.trim() || busy}
            >
              {busy ? 'Inviting…' : 'Invite'}
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => { setAdding(false); setNewName(''); setNewEmail(''); setErrorMsg(null); setManualLink(null); }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
          {errorMsg && <div className="ap-add-error">{errorMsg}</div>}
          {manualLink && (
            <div className="ap-add-link">
              <div className="ap-add-link-msg">
                Email couldn&rsquo;t be sent. Copy this link and paste it to <strong>{newEmail}</strong> in Teams or another channel:
              </div>
              <input
                readOnly
                className="ap-add-input wide"
                value={manualLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className="btn sm primary"
                onClick={() => {
                  navigator.clipboard?.writeText(manualLink);
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => { setAdding(false); setNewName(''); setNewEmail(''); setManualLink(null); }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="ap-chip ap-add"
          onClick={() => setAdding(true)}
          title="Invite a new teammate by email"
        >
          <span className="ap-add-plus">+</span>
          <span className="ap-name">Invite</span>
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
  onAddAgenda: (item: string) => void;
  onUpdateAgenda: (id: string, patch: { sub_items: SubItem[] }) => Promise<void>;
  onDeleteAgenda: (id: string) => Promise<void>;
  onCopyAgenda: (sourceId: string, targetSeriesId: string) => Promise<AgendaItem | null>;
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
  onUpdateAgenda,
  onDeleteAgenda,
  onCopyAgenda,
  onAddMeeting,
  onEditMeeting,
}: HorizontalViewProps) {
  const [hover, setHover] = useState<null | { aId: string; mId: string; x: number; y: number }>(null);
  const [adding, setAdding] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [addingMeeting, setAddingMeeting] = useState(false);

    // When the user clicks "Copy to series…" in the agenda editor footer, the
  // action row morphs into a series picker. Tracked here so it auto-resets
  // when the editor closes.
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);

// Sub-item editor state. Slot count is dynamic — starts at max(existing, 4)
  // and grows on demand. Each slot can have its own list of discussion points.
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null);
  const [subSlots, setSubSlots] = useState<SubItem[]>([
    { text: '', points: [] },
    { text: '', points: [] },
    { text: '', points: [] },
    { text: '', points: [] },
  ]);

  const emptySubSlots = (n: number): SubItem[] =>
    Array.from({ length: n }, () => ({ text: '', points: [] }));

  const beginEditAgenda = (a: AgendaItem) => {
    setEditingAgendaId(a.id);
    const current = (a.sub_items || []) as SubItem[];
    const slotCount = Math.max(4, current.length + 1);
    const slots: SubItem[] = Array.from({ length: slotCount }, (_, i) => ({
      text: current[i]?.text ?? '',
      points: current[i]?.points ? [...current[i].points] : [],
    }));
    setSubSlots(slots);
  };
  const cancelEditAgenda = () => {
    setEditingAgendaId(null);
    setSubSlots(emptySubSlots(4));
    setCopyPickerOpen(false);
    setCopyBusy(false);
  };
  const handleCopyToSeries = async (targetSeriesId: string) => {
    if (!editingAgendaId || copyBusy) return;
    setCopyBusy(true);
    const targetName =
      data.series.find((s) => s.id === targetSeriesId)?.name || 'series';
    const result = await onCopyAgenda(editingAgendaId, targetSeriesId);
    setCopyBusy(false);
    if (!result) {
      window.alert(`Couldn't copy to ${targetName}. Try again or refresh.`);
      return;
    }
    cancelEditAgenda();
  };
  const saveEditAgenda = async () => {
    if (!editingAgendaId) return;
    const cleaned: SubItem[] = subSlots
      .map((s) => ({
        text: s.text.trim(),
        points: s.points.map((p) => p.trim()).filter((p) => p.length > 0),
      }))
      .filter((s) => s.text.length > 0);
    await onUpdateAgenda(editingAgendaId, { sub_items: cleaned });
    cancelEditAgenda();
  };
  const deleteEditingAgenda = async () => {
    if (!editingAgendaId) return;
    const item = agenda.find((a) => a.id === editingAgendaId);
    if (!item) return;
    const cellCount = cells.filter((c) => c.agenda_item_id === item.id).length;
    const decCount = decisions.filter((d) => d.agenda_item_id === item.id).length;
    const actCount = actions.filter((ac) => ac.agenda_item_id === item.id).length;
    const lines = [
      `Delete agenda item "${item.item}"?`,
      '',
      `This will permanently remove ${cellCount} note cell${cellCount === 1 ? '' : 's'} across every meeting in this series.`,
      decCount + actCount > 0
        ? `${decCount} decision${decCount === 1 ? '' : 's'} and ${actCount} action${actCount === 1 ? '' : 's'} will stay in place but lose their link to this agenda row.`
        : '',
      'This cannot be undone.',
    ].filter(Boolean).join('\n');
    if (!window.confirm(lines)) return;
    await onDeleteAgenda(item.id);
    cancelEditAgenda();
  };
  const addSubSlot = () =>
    setSubSlots((prev) => [...prev, { text: '', points: [] }]);
  const removeSubSlot = (i: number) =>
    setSubSlots((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const updateSubText = (i: number, text: string) =>
    setSubSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, text } : s)));
  const addPoint = (i: number) =>
    setSubSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, points: [...s.points, ''] } : s)));
  const updatePoint = (i: number, pi: number, text: string) =>
    setSubSlots((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, points: s.points.map((p, pidx) => (pidx === pi ? text : p)) } : s,
      ),
    );
  const removePoint = (i: number, pi: number) =>
    setSubSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, points: s.points.filter((_, pidx) => pidx !== pi) } : s)),
    );

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
  const carryCount = useMemo(() => cells.filter((c) => c.status === 'carry').length, [cells]);

  const addAgendaItem = () => {
    if (!newItemText.trim()) return;
    onAddAgenda(newItemText.trim());
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
                const isEditingAgenda = editingAgendaId === a.id;
                const subs = a.sub_items || [];
                return (
                  <tr key={a.id}>
                    <th className="row-head">
                      <div className="row-head-inner">
                        <div className="row-title">
                          {isEditingAgenda ? (
                            <div className="sub-edit">
                              <div className="title">{a.item}</div>
                              {subSlots.map((slot, i) => (
                                <div key={i} className="sub-edit-block">
                                  <div className="sub-edit-row">
                                    <span className="sub-num">{i + 1}.</span>
                                    <input
                                      autoFocus={i === 0}
                                      className="sub-edit-input"
                                      placeholder={`Sub-item ${i + 1}${i === 0 ? ' (optional)' : ''}`}
                                      value={slot.text}
                                      onChange={(e) => updateSubText(i, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEditAgenda();
                                        if (e.key === 'Escape') cancelEditAgenda();
                                      }}
                                    />
                                    {subSlots.length > 1 && (
                                      <button
                                        type="button"
                                        className="sub-remove"
                                        onClick={() => removeSubSlot(i)}
                                        title="Remove this sub-item"
                                        aria-label="Remove sub-item"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                  {slot.points.map((p, pi) => (
                                    <div key={pi} className="sub-edit-row sub-edit-point">
                                      <span className="point-letter">{String.fromCharCode(97 + pi)}.</span>
                                      <input
                                        className="sub-edit-input"
                                        placeholder="Discussion point"
                                        value={p}
                                        onChange={(e) => updatePoint(i, pi, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEditAgenda();
                                          if (e.key === 'Escape') cancelEditAgenda();
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className="sub-remove"
                                        onClick={() => removePoint(i, pi)}
                                        title="Remove this discussion point"
                                        aria-label="Remove discussion point"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                  {slot.text.trim().length > 0 && (
                                    <button
                                      type="button"
                                      className="point-add-btn"
                                      onClick={() => addPoint(i)}
                                    >
                                      + Add discussion point
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                className="sub-add-btn"
                                onClick={addSubSlot}
                                title="Add another sub-item"
                              >
                                + Add another
                              </button>
                              <div className="sub-edit-actions">
                                <button
                                  className="btn sm ghost agenda-delete-btn"
                                  onClick={deleteEditingAgenda}
                                  title="Delete this agenda item permanently"
                                >
                                  Delete agenda item
                                </button>
                                <span style={{ flex: 1 }} />
                                <button className="btn sm ghost" onClick={cancelEditAgenda}>Cancel</button>
                                <button className="btn sm primary" onClick={saveEditAgenda}>Done</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="row-title-btn"
                              onClick={() => beginEditAgenda(a)}
                              title="Click to edit sub-items"
                            >
                              <div className="title">{a.item}</div>
                              {subs.length > 0 && (
                                <ol className="sub-list">
                                  {subs.map((s, i) => (
                                    <li key={i}>
                                      <span>{s.text}</span>
                                      {s.points && s.points.length > 0 && (
                                        <ol className="point-list">
                                          {s.points.map((p, pi) => (
                                            <li key={pi}>{p}</li>
                                          ))}
                                        </ol>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </button>
                          )}
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
            <div style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div>
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
