'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Icon } from './atoms';
import type { Meeting, TeamMember } from '@/lib/types';

type AttendanceState = 'in' | 'apology' | 'out';

export interface MeetingEditPatch {
  meeting_date: string;
  meeting_time: string | null;
  chair_id: string | null;
  upcoming: boolean;
  label: string;
  attendance: Record<string, AttendanceState>;
}

export function MeetingEditModal({
  open,
  meeting,
  team,
  onClose,
  onSave,
  onAddTeammate,
  onArchive,
  onRestore,
  onIssueMinutes,
}: {
  open: boolean;
  meeting: Meeting | null;
  team: TeamMember[];
  onClose: () => void;
  onSave: (patch: MeetingEditPatch) => Promise<void>;
  onAddTeammate: (input: { name: string; email: string }) => Promise<{ member: TeamMember | null; manualInviteLink?: string | null; error?: string | null }>;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
  onIssueMinutes: () => void;
}) {
  const initial = useMemo(() => {
    if (!meeting) return null;
    const attendance: Record<string, AttendanceState> = {};
    team.forEach((p) => {
      if (meeting.apologies.includes(p.id)) attendance[p.id] = 'apology';
      else if (meeting.attendees.includes(p.id)) attendance[p.id] = 'in';
      else attendance[p.id] = 'out';
    });
    return { attendance };
  }, [meeting, team]);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [upcoming, setUpcoming] = useState(false);
  const [chairId, setChairId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({});
  const [addingTeammate, setAddingTeammate] = useState(false);
  const [newTeammateName, setNewTeammateName] = useState('');
  const [newTeammateEmail, setNewTeammateEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [manualInviteLink, setManualInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const newTeammateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !meeting) return;
    setDate(meeting.meeting_date);
    setTime(meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : '');
    setUpcoming(meeting.upcoming);
    setChairId(meeting.chair_id);
    setAttendance(initial?.attendance ?? {});
    setAddingTeammate(false);
    setNewTeammateName('');
  }, [open, meeting, initial]);

  if (!open || !meeting) return null;

  const setStatus = (profileId: string, status: AttendanceState) => {
    // If we're about to remove someone who currently has access, confirm first.
    const previous = attendance[profileId];
    if (status === 'out' && (previous === 'in' || previous === 'apology')) {
      const person = team.find((t) => t.id === profileId);
      const name = person?.name || 'this person';
      const ok = window.confirm(
        `Remove ${name} from this meeting?\n\nThey'll lose access to its notes, decisions, and actions once you save. They'll keep access to other meetings they're still invited to.`,
      );
      if (!ok) return;
    }
    setAttendance((prev) => ({ ...prev, [profileId]: status }));
    // Demote from chair if they're no longer attending.
    if (status !== 'in' && chairId === profileId) setChairId(null);
  };
  const toggleChair = (profileId: string) => {
    if (chairId === profileId) {
      setChairId(null);
    } else {
      setChairId(profileId);
      // Promote to attending if they weren't.
      if (attendance[profileId] !== 'in') setStatus(profileId, 'in');
    }
  };

  const handleAddTeammate = async () => {
    const name = newTeammateName.trim();
    const email = newTeammateEmail.trim().toLowerCase();
    if (!name || !email || inviting) return;
    setInviting(true);
    setInviteError(null);
    setManualInviteLink(null);
    const result = await onAddTeammate({ name, email });
    setInviting(false);
    if (result.error) {
      setInviteError(result.error);
      return;
    }
    if (result.manualInviteLink) {
      setManualInviteLink(result.manualInviteLink);
    }
    if (result.member) {
      // Auto-mark the new teammate as attending.
      setAttendance((prev) => ({ ...prev, [result.member!.id]: 'in' }));
      if (!result.manualInviteLink) {
        setNewTeammateName('');
        setNewTeammateEmail('');
        setAddingTeammate(false);
      }
    }
  };

  const handleSave = async () => {
    if (!date || saving) return;
    setSaving(true);
    const d = new Date(date + 'T00:00:00');
    const label = `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
    await onSave({
      meeting_date: date,
      meeting_time: time || null,
      chair_id: chairId,
      upcoming,
      label,
      attendance,
    });
    setSaving(false);
    onClose();
  };

  const roster = team; // full team — attendance state drives display

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal meeting-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Meeting settings</div>
            <h3 className="modal-title">Edit meeting · {meeting.label}</h3>
            <div className="modal-sub">Change the date, time, attendees, and chair.</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" className="ic sm" />
          </button>
        </div>

        <div className="modal-body">
          <div className="me-section">
            <div className="me-section-label">When</div>
            <div className="me-when-row">
              <label className="field" style={{ flex: 1 }}>
                <span className="field-label">Date</span>
                <input
                  type="date"
                  className="field-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="field" style={{ width: 140 }}>
                <span className="field-label">Time <span className="field-hint">Optional</span></span>
                <input
                  type="time"
                  className="field-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
            </div>
            <label className="me-upcoming">
              <input
                type="checkbox"
                checked={upcoming}
                onChange={(e) => setUpcoming(e.target.checked)}
              />
              <span>Mark as the upcoming meeting</span>
              <span className="me-hint">Only one meeting in a series should be upcoming at a time.</span>
            </label>
          </div>

          <div className="me-section">
            <div className="me-section-label">Who</div>
            <div className="me-section-hint">
              Removing someone from a meeting takes away their access to its notes, decisions, and actions.
            </div>
            <div className="me-roster">
              {roster.map((p) => {
                const status = attendance[p.id] || 'out';
                const isChair = chairId === p.id;
                return (
                  <div key={p.id} className={`me-row ${status}`}>
                    <Avatar person={p} size="sm" />
                    <span className="me-name">{p.name}</span>
                    <button
                      type="button"
                      className={`me-chair ${isChair ? 'on' : ''}`}
                      onClick={() => toggleChair(p.id)}
                      title={isChair ? 'Unset as chair' : 'Set as chair'}
                      aria-label="Set as chair"
                    >
                      {isChair ? '★' : '☆'}
                    </button>
                    <div className="me-seg">
                      <button
                        type="button"
                        className={status === 'in' ? 'on' : ''}
                        onClick={() => setStatus(p.id, 'in')}
                      >
                        Attending
                      </button>
                      <button
                        type="button"
                        className={status === 'apology' ? 'on' : ''}
                        onClick={() => setStatus(p.id, 'apology')}
                      >
                        Apology
                      </button>
                      <button
                        type="button"
                        className={`remove ${status === 'out' ? 'on' : ''}`}
                        onClick={() => setStatus(p.id, 'out')}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              {addingTeammate ? (
                <div className="me-invite-card">
                  <div className="me-invite-fields">
                    <input
                      ref={newTeammateRef}
                      autoFocus
                      className="field-input sm"
                      placeholder="Full name"
                      value={newTeammateName}
                      onChange={(e) => setNewTeammateName(e.target.value)}
                      disabled={inviting}
                    />
                    <input
                      type="email"
                      className="field-input sm"
                      placeholder="work@email.co.uk"
                      value={newTeammateEmail}
                      onChange={(e) => setNewTeammateEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTeammate();
                        if (e.key === 'Escape') {
                          setAddingTeammate(false);
                          setNewTeammateName('');
                          setNewTeammateEmail('');
                          setInviteError(null);
                          setManualInviteLink(null);
                        }
                      }}
                      disabled={inviting}
                    />
                  </div>
                  <div className="me-invite-actions">
                    <button
                      className="btn sm primary"
                      disabled={!newTeammateName.trim() || !newTeammateEmail.trim() || inviting}
                      onClick={handleAddTeammate}
                    >
                      {inviting ? 'Inviting…' : 'Invite & add to meeting'}
                    </button>
                    <button
                      className="btn sm ghost"
                      onClick={() => {
                        setAddingTeammate(false);
                        setNewTeammateName('');
                        setNewTeammateEmail('');
                        setInviteError(null);
                        setManualInviteLink(null);
                      }}
                      disabled={inviting}
                    >
                      Cancel
                    </button>
                  </div>
                  {inviteError && <div className="me-invite-error">{inviteError}</div>}
                  {manualInviteLink && (
                    <div className="me-invite-link">
                      <div className="me-invite-link-msg">
                        Email couldn&rsquo;t be sent. Copy this link and send it to <strong>{newTeammateEmail}</strong> via Teams or another channel:
                      </div>
                      <input
                        readOnly
                        className="field-input sm"
                        value={manualInviteLink}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <div className="me-invite-actions">
                        <button
                          className="btn sm primary"
                          onClick={() => navigator.clipboard?.writeText(manualInviteLink)}
                        >
                          Copy link
                        </button>
                        <button
                          className="btn sm ghost"
                          onClick={() => {
                            setAddingTeammate(false);
                            setNewTeammateName('');
                            setNewTeammateEmail('');
                            setManualInviteLink(null);
                          }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="me-add-btn"
                  onClick={() => setAddingTeammate(true)}
                >
                  + Invite a new teammate by email
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {meeting.archived_at ? (
            <button
              className="btn sm ghost me-archive-btn"
              onClick={async () => { setSaving(true); await onRestore(); setSaving(false); }}
              disabled={saving}
              title="Restore this meeting to the live view"
            >
              Restore meeting
            </button>
          ) : (
            <button
              className="btn sm ghost me-archive-btn"
              onClick={async () => {
                if (!window.confirm('Archive this meeting? It will be hidden from the pivot but kept in the database.')) return;
                setSaving(true);
                await onArchive();
                setSaving(false);
              }}
              disabled={saving}
              title="Hide from the live view (not deleted)"
            >
              Archive meeting
            </button>
          )}
          <button
            className="btn sm ghost me-minutes-btn"
            onClick={onIssueMinutes}
            disabled={saving}
            title="Email a summary of this meeting to all attendees"
          >
            Issue minutes
          </button>
          <div className="spacer" />
          <button className="btn sm ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn sm primary" onClick={handleSave} disabled={!date || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
