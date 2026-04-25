'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from './atoms';
import type { Meeting } from '@/lib/types';

interface PreviewResult {
  subject: string;
  html: string;
  recipients: string[];
  recipientCount: number;
}

export function IssueMinutesModal({
  open,
  meeting,
  onClose,
}: {
  open: boolean;
  meeting: Meeting | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'preview' | 'sending' | 'sent' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [sentTo, setSentTo] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open || !meeting) return;
    let cancelled = false;
    setPhase('loading');
    setError(null);
    setPreview(null);
    setSentTo(null);

    fetch('/api/issue-minutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meeting.id, preview: true }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok || j.error) {
          setError(j.error || 'Could not load preview');
          setPhase('error');
        } else {
          setPreview({
            subject: j.subject,
            html: j.html,
            recipients: j.recipients,
            recipientCount: j.recipientCount,
          });
          setPhase('preview');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setPhase('error');
      });

    return () => {
      cancelled = true;
    };
  }, [open, meeting]);

  if (!open || !meeting) return null;

  const send = async () => {
    setPhase('sending');
    setError(null);
    try {
      const res = await fetch('/api/issue-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setError(j.error || `Send failed (HTTP ${res.status})`);
        setPhase('error');
        return;
      }
      setSentTo(j.recipients ?? []);
      setPhase('sent');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal issue-minutes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Issue minutes</div>
            <h3 className="modal-title">{meeting.label} — preview &amp; send</h3>
            <div className="modal-sub">
              {phase === 'loading' && 'Building your preview…'}
              {phase === 'preview' &&
                `Sending to ${preview?.recipientCount ?? 0} attendee${preview?.recipientCount === 1 ? '' : 's'} — review below before sending.`}
              {phase === 'sending' && 'Sending…'}
              {phase === 'sent' && 'Sent. Recipients should receive the email shortly.'}
              {phase === 'error' && 'Something went wrong.'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" className="ic sm" />
          </button>
        </div>

        <div className="modal-body">
          {phase === 'loading' && (
            <div className="im-status">Generating preview…</div>
          )}

          {phase === 'error' && (
            <div className="im-error">
              <strong>Couldn&rsquo;t {sentTo === null ? 'load preview' : 'send'}.</strong>
              <div style={{ marginTop: 6 }}>{error}</div>
            </div>
          )}

          {phase === 'sent' && (
            <div className="im-success">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                ✓ Minutes sent to {sentTo?.length ?? 0} recipient{sentTo?.length === 1 ? '' : 's'}.
              </div>
              {sentTo && sentTo.length > 0 && (
                <div className="im-recipients">
                  {sentTo.map((r) => (
                    <span key={r} className="im-recipient-chip">{r}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {(phase === 'preview' || phase === 'sending') && preview && (
            <>
              <div className="im-meta">
                <div>
                  <div className="field-mini-label">Subject</div>
                  <div className="im-subject">{preview.subject}</div>
                </div>
                <div>
                  <div className="field-mini-label">Recipients ({preview.recipientCount})</div>
                  <div className="im-recipients">
                    {preview.recipients.length > 0
                      ? preview.recipients.map((r) => (
                          <span key={r} className="im-recipient-chip">{r}</span>
                        ))
                      : (
                        <span className="im-warn">
                          No attendees with email addresses. Add emails by inviting teammates first.
                        </span>
                      )}
                  </div>
                </div>
              </div>

              <div className="im-preview-label">Email preview</div>
              <iframe
                title="Minutes preview"
                className="im-preview"
                sandbox=""
                srcDoc={preview.html}
              />
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className="spacer" />
          {phase === 'sent' || phase === 'error' ? (
            <button className="btn sm primary" onClick={onClose}>Close</button>
          ) : (
            <>
              <button className="btn sm ghost" onClick={onClose} disabled={phase === 'sending'}>
                Cancel
              </button>
              <button
                className="btn sm primary"
                onClick={send}
                disabled={phase !== 'preview' || !preview || preview.recipientCount === 0}
              >
                {phase === 'sending'
                  ? 'Sending…'
                  : `Send to ${preview?.recipientCount ?? 0} recipient${preview?.recipientCount === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
