import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderMinutesHtml, renderMinutesSubject } from '@/lib/email/render-minutes';
import { autoColor, autoInitials } from '@/lib/utils';
import type {
  Action,
  AgendaItem,
  Cell,
  Decision,
  Meeting,
  MeetingSeries,
  Profile,
  TeamMember,
} from '@/lib/types';

interface IssueMinutesBody {
  meetingId: string;
  /** When true, return the rendered HTML + recipients but don't send. */
  preview?: boolean;
  /** Optional override of recipient emails. Defaults to all attendees with emails. */
  recipients?: string[];
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Meeting OS <onboarding@resend.dev>';

function profileToTeam(p: Profile): TeamMember {
  const name = p.full_name || (p.email ?? '').split('@')[0] || 'Unknown';
  return {
    id: p.id,
    name,
    role: p.role || '—',
    initials: p.initials || autoInitials(name),
    color: p.color || autoColor(p.id),
    is_admin: p.is_admin ?? false,
  };
}

export async function POST(request: Request) {
  // Caller must be authenticated.
  const supabase = createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: IssueMinutesBody;
  try {
    body = (await request.json()) as IssueMinutesBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.meetingId) {
    return NextResponse.json({ error: 'meetingId is required' }, { status: 400 });
  }

  // Fetch via admin client so we have a complete view regardless of any RLS
  // edge cases (the caller has already been authorised above).
  const admin = createAdminClient();

  const [
    meetingRes,
    attendeesRes,
    profilesRes,
    seriesRes,
    agendaRes,
    cellsRes,
    decisionsRes,
    actionsRes,
  ] = await Promise.all([
    admin.from('meetings').select('*').eq('id', body.meetingId).single(),
    admin.from('meeting_attendees').select('*').eq('meeting_id', body.meetingId),
    admin.from('profiles').select('*'),
    admin.from('meeting_series').select('*'),
    admin.from('agenda_items').select('*').order('sort_order'),
    admin.from('cells').select('*').eq('meeting_id', body.meetingId),
    admin.from('decisions').select('*').eq('meeting_id', body.meetingId),
    admin.from('actions').select('*').eq('meeting_id', body.meetingId),
  ]);

  if (meetingRes.error || !meetingRes.data) {
    return NextResponse.json(
      { error: meetingRes.error?.message || 'Meeting not found' },
      { status: 404 },
    );
  }

  const rawMeeting = meetingRes.data as Omit<Meeting, 'attendees' | 'apologies'>;
  type AttRow = { profile_id: string; is_chair: boolean; is_apology: boolean };
  const attRows = (attendeesRes.data as AttRow[] | null) ?? [];
  const meeting: Meeting = {
    ...(rawMeeting as Meeting),
    attendees: attRows.filter((a) => !a.is_apology).map((a) => a.profile_id),
    apologies: attRows.filter((a) => a.is_apology).map((a) => a.profile_id),
  };

  const allProfiles = (profilesRes.data as Profile[] | null) ?? [];
  const team = allProfiles.map(profileToTeam);
  const series = (seriesRes.data as MeetingSeries[] | null) ?? [];
  const seriesName =
    series.find((s) => s.id === meeting.series_id)?.name || 'Meeting';

  const agenda = ((agendaRes.data as AgendaItem[] | null) ?? []).filter(
    (a) => a.series_id === meeting.series_id,
  );
  const cells = (cellsRes.data as Cell[] | null) ?? [];
  const decisions = (decisionsRes.data as Decision[] | null) ?? [];
  const actions = (actionsRes.data as Action[] | null) ?? [];

  // Recipients = all attendees with non-null email, unless caller overrides.
  const attendeeEmails = meeting.attendees
    .map((id) => allProfiles.find((p) => p.id === id)?.email)
    .filter((e): e is string => !!e);
  const recipients = (body.recipients && body.recipients.length > 0)
    ? body.recipients.filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
    : attendeeEmails;

  // Build the email.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const html = renderMinutesHtml({
    seriesName,
    meeting,
    team,
    agenda,
    cells,
    decisions,
    actions,
    appUrl: `${origin}/app`,
  });
  const subject = renderMinutesSubject({
    seriesName,
    meetingDate: meeting.meeting_date,
  });

  // Preview mode: return what we would send, don't actually call Resend.
  if (body.preview) {
    return NextResponse.json({
      preview: true,
      subject,
      html,
      recipients,
      recipientCount: recipients.length,
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          'No attendees with email addresses on this meeting. Add an email to at least one attendee, or invite people via "Invite a new teammate" first.',
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Email sending is not configured. Set RESEND_API_KEY in Vercel and redeploy.',
      },
      { status: 500 },
    );
  }
  const fromAddress = process.env.RESEND_FROM_ADDRESS || DEFAULT_FROM;

  const resendRes = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: recipients,
      subject,
      html,
    }),
  });
  const resendJson = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) {
    return NextResponse.json(
      {
        error: `Resend send failed: ${(resendJson as { message?: string }).message || `HTTP ${resendRes.status}`}`,
      },
      { status: 502 },
    );
  }

  // Audit record.
  await admin.from('meeting_minutes_sent').insert({
    meeting_id: meeting.id,
    sent_by: caller.id,
    recipient_count: recipients.length,
    recipient_emails: recipients,
    resend_message_id: (resendJson as { id?: string }).id ?? null,
  });

  return NextResponse.json({
    sent: true,
    recipientCount: recipients.length,
    recipients,
    resendMessageId: (resendJson as { id?: string }).id ?? null,
  });
}
