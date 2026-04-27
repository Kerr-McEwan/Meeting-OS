// Render a meeting's minutes as a self-contained, inline-styled HTML email.
// No external CSS, no <style> blocks — most email clients (Outlook, Gmail
// app, Apple Mail) will silently strip those.

import type {
  Action,
  AgendaItem,
  Cell,
  Decision,
  Meeting,
  TeamMember,
} from '../types';

export interface MinutesPayload {
  seriesName: string;
  meeting: Meeting;
  team: TeamMember[];
  agenda: AgendaItem[];
  cells: Cell[];
  decisions: Decision[];
  actions: Action[];
  appUrl: string;
}

const ACCENT = '#d99442';
const BORDER = '#e8e4dc';
const BORDER_STRONG = '#d7d1c5';
const SURFACE_2 = '#f5f3ef';
const TEXT = '#1f1e20';
const TEXT_MUTED = '#6b6860';
const TEXT_DIM = '#9a958a';
const DANGER = '#b54034';
const SUCCESS = '#377a4a';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function personName(team: TeamMember[], id: string | null | undefined): string {
  if (!id) return '—';
  return team.find((p) => p.id === id)?.name || '—';
}

const STATUS_LABELS: Record<string, string> = {
  to_action: 'To action',
  in_progress: 'In progress',
  stuck: 'Stuck',
  done: 'Done',
  closed: 'Closed',
  carry: 'Carry forward',
};

function statusColor(status: string): string {
  switch (status) {
    case 'done':
    case 'closed':
      return SUCCESS;
    case 'stuck':
      return DANGER;
    case 'in_progress':
      return ACCENT;
    default:
      return TEXT_MUTED;
  }
}

const DECISION_STATUS_LABELS_INLINE: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  discuss: 'Discuss',
  closed: 'Closed',
};

function decisionStatusColor(status: string): string {
  switch (status) {
    case 'closed':
      return SUCCESS;
    case 'under_review':
      return ACCENT;
    case 'discuss':
      return '#7a5cc7';
    case 'open':
    default:
      return TEXT_MUTED;
  }
}

export function renderMinutesHtml(p: MinutesPayload): string {
  const meetingDate = fmtDateLong(p.meeting.meeting_date);
  const meetingTime = p.meeting.meeting_time ? p.meeting.meeting_time.slice(0, 5) : null;
  const chair = personName(p.team, p.meeting.chair_id);
  const attendees = p.meeting.attendees
    .map((id) => personName(p.team, id))
    .filter((n) => n !== '—');
  const apologies = p.meeting.apologies
    .map((id) => personName(p.team, id))
    .filter((n) => n !== '—');

  const rows = p.agenda.map((a) => {
    const cell = p.cells.find((c) => c.agenda_item_id === a.id && c.meeting_id === p.meeting.id);
    const decs = p.decisions.filter((d) => d.agenda_item_id === a.id && d.meeting_id === p.meeting.id);
    const acts = p.actions.filter((ac) => ac.agenda_item_id === a.id && ac.meeting_id === p.meeting.id);

    const subItems = (a.sub_items || []).filter(Boolean);

    const titleCell = `
      <div style="font-weight:600;color:${TEXT};font-size:14px;line-height:1.3;">
        ${escapeHtml(a.item)}
      </div>
      ${
        subItems.length
          ? `<ol style="margin:6px 0 0 0;padding-left:18px;color:${TEXT_MUTED};font-size:12px;line-height:1.45;">
              ${subItems.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
            </ol>`
          : ''
      }
    `;

    const notesCell = cell?.notes
      ? `<div style="white-space:pre-wrap;color:${TEXT};font-size:13px;line-height:1.45;">${escapeHtml(cell.notes)}</div>`
      : `<div style="color:${TEXT_DIM};font-style:italic;font-size:12px;">No notes captured.</div>`;

    const decisionsCell = decs.length
      ? `<ul style="margin:0;padding:0;list-style:none;">${decs
          .map((d) => {
            const dStatus = (d.status || 'open') as string;
            const dColor = decisionStatusColor(dStatus);
            const dLabel = DECISION_STATUS_LABELS_INLINE[dStatus] || dStatus;
            return `
            <li style="padding:6px 0;border-bottom:1px solid ${BORDER};font-size:13px;line-height:1.4;color:${TEXT};">
              ${escapeHtml(d.text)}
              <div style="font-size:11px;color:${TEXT_DIM};margin-top:3px;">
                Owner: ${escapeHtml(personName(p.team, d.owner_id))}
                · <span style="color:${dColor};font-weight:600;">${escapeHtml(dLabel)}</span>
              </div>
            </li>`;
          })
          .join('')}</ul>`
      : `<div style="color:${TEXT_DIM};font-style:italic;font-size:12px;">—</div>`;

    const actionsCell = acts.length
      ? `<ul style="margin:0;padding:0;list-style:none;">${acts
          .map((ac) => {
            const c = statusColor(ac.status);
            return `
            <li style="padding:6px 0;border-bottom:1px solid ${BORDER};font-size:13px;line-height:1.4;color:${TEXT};">
              ${escapeHtml(ac.title)}
              <div style="font-size:11px;color:${TEXT_DIM};margin-top:3px;">
                Owner: ${escapeHtml(personName(p.team, ac.owner_id))}
                · Due: ${escapeHtml(fmtDate(ac.due_date))}
                · <span style="color:${c};font-weight:600;">${escapeHtml(STATUS_LABELS[ac.status] || ac.status)}</span>
              </div>
            </li>`;
          })
          .join('')}</ul>`
      : `<div style="color:${TEXT_DIM};font-style:italic;font-size:12px;">—</div>`;

    return `
      <tr>
        <td style="padding:12px 10px;border-top:1px solid ${BORDER};border-right:1px solid ${BORDER};vertical-align:top;background:${SURFACE_2};width:24%;">
          ${titleCell}
        </td>
        <td style="padding:12px 10px;border-top:1px solid ${BORDER};border-right:1px solid ${BORDER};vertical-align:top;width:34%;">
          ${notesCell}
        </td>
        <td style="padding:12px 10px;border-top:1px solid ${BORDER};border-right:1px solid ${BORDER};vertical-align:top;width:21%;">
          ${decisionsCell}
        </td>
        <td style="padding:12px 10px;border-top:1px solid ${BORDER};vertical-align:top;width:21%;">
          ${actionsCell}
        </td>
      </tr>
    `;
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Meeting minutes — ${escapeHtml(p.seriesName)} — ${escapeHtml(meetingDate)}</title>
</head>
<body style="margin:0;padding:0;background:#faf9f7;font-family:${FONT_STACK};color:${TEXT};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#faf9f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="800" cellspacing="0" cellpadding="0" border="0" style="max-width:800px;width:100%;background:#ffffff;border:1px solid ${BORDER_STRONG};border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid ${BORDER_STRONG};background:${SURFACE_2};">
              <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${TEXT_MUTED};font-weight:600;">Meeting minutes</div>
              <h1 style="margin:4px 0 6px 0;font-size:20px;color:${TEXT};font-weight:700;line-height:1.25;">
                ${escapeHtml(p.seriesName)}
              </h1>
              <div style="font-size:13px;color:${TEXT_MUTED};">
                ${escapeHtml(meetingDate)}${meetingTime ? ` · ${escapeHtml(meetingTime)}` : ''}
                · Chair: ${escapeHtml(chair)}
              </div>
              ${
                attendees.length
                  ? `<div style="margin-top:8px;font-size:12px;color:${TEXT_MUTED};">
                      <strong style="color:${TEXT};font-weight:600;">Attendees:</strong>
                      ${attendees.map((n) => escapeHtml(n)).join(', ')}
                    </div>`
                  : ''
              }
              ${
                apologies.length
                  ? `<div style="margin-top:4px;font-size:12px;color:${TEXT_MUTED};">
                      <strong style="color:${TEXT};font-weight:600;">Apologies:</strong>
                      ${apologies.map((n) => escapeHtml(n)).join(', ')}
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:${SURFACE_2};">
                    <th align="left" style="padding:8px 10px;border-bottom:1px solid ${BORDER_STRONG};font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${TEXT_MUTED};font-weight:700;">Agenda item</th>
                    <th align="left" style="padding:8px 10px;border-bottom:1px solid ${BORDER_STRONG};font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${TEXT_MUTED};font-weight:700;">Notes</th>
                    <th align="left" style="padding:8px 10px;border-bottom:1px solid ${BORDER_STRONG};font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${TEXT_MUTED};font-weight:700;">Decisions</th>
                    <th align="left" style="padding:8px 10px;border-bottom:1px solid ${BORDER_STRONG};font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${TEXT_MUTED};font-weight:700;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.join('')}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;background:${SURFACE_2};border-top:1px solid ${BORDER_STRONG};text-align:center;">
              <a href="${escapeHtml(p.appUrl)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:9px 18px;border-radius:5px;font-size:13px;font-weight:600;">
                Open in Meeting OS
              </a>
              <div style="font-size:11px;color:${TEXT_DIM};margin-top:10px;">
                You're receiving this because you were an attendee of this meeting in Meeting OS.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderMinutesSubject(p: { seriesName: string; meetingDate: string }): string {
  const date = fmtDate(p.meetingDate);
  return `Minutes — ${p.seriesName} — ${date}`;
}
