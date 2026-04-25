import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowed } from '@/lib/allowed-domains';
import { autoColor, autoInitials } from '@/lib/utils';

interface InviteBody {
  email: string;
  name: string;
  meetingId: string;
}

export async function POST(request: Request) {
  // Caller must be authenticated.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const meetingId = (body.meetingId || '').trim();

  if (!email || !name || !meetingId) {
    return NextResponse.json(
      { error: 'name, email and meetingId are all required' },
      { status: 400 },
    );
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json(
      { error: 'That email domain is not on the allowed list.' },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const initials = autoInitials(name) || name.slice(0, 2).toUpperCase();
  const color = autoColor(name);

  // Build the redirect URL for the invitation.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent('/app')}`;

  // Step 1: does a profile already exist for this email?
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, full_name, initials, color, is_guest')
    .eq('email', email)
    .maybeSingle();

  let profileId: string;
  let manualInviteLink: string | null = null;
  let alreadyExisted = false;

  if (existingProfile && existingProfile.id) {
    // Already known. Just update name/initials/color if the profile is a guest stub.
    profileId = existingProfile.id;
    alreadyExisted = true;
    if (existingProfile.is_guest) {
      await admin
        .from('profiles')
        .update({ full_name: name, initials, color, is_guest: false })
        .eq('id', profileId);
    }
  } else {
    // Step 2: invite via Supabase. This creates auth.users + the profile via trigger.
    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo,
    });

    if (inviteResult.error || !inviteResult.data.user) {
      // If the invite failed (commonly: SMTP not configured), generate a link
      // we can hand back to the inviter so they can paste it in Teams/Slack.
      const linkResult = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo, data: { full_name: name } },
      });
      if (linkResult.error || !linkResult.data?.user || !linkResult.data?.properties?.action_link) {
        return NextResponse.json(
          {
            error:
              linkResult.error?.message ||
              inviteResult.error?.message ||
              'Could not invite this email. Check the address and try again.',
          },
          { status: 500 },
        );
      }
      profileId = linkResult.data.user.id;
      manualInviteLink = linkResult.data.properties.action_link;
    } else {
      profileId = inviteResult.data.user.id;
    }

    // Make sure the profile row exists with the supplied name (trigger may have
    // already created it; this upsert is defensive and idempotent).
    await admin
      .from('profiles')
      .upsert(
        { id: profileId, email, full_name: name, initials, color, is_guest: false },
        { onConflict: 'id' },
      );
  }

  // Step 3: record them as an attendee of this meeting.
  const { error: attErr } = await admin
    .from('meeting_attendees')
    .upsert(
      { meeting_id: meetingId, profile_id: profileId, is_apology: false },
      { onConflict: 'meeting_id,profile_id' },
    );
  if (attErr) {
    return NextResponse.json(
      { error: `Couldn't add as attendee: ${attErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    member: {
      id: profileId,
      name,
      role: 'Team member',
      initials,
      color,
    },
    alreadyExisted,
    manualInviteLink,
  });
}
