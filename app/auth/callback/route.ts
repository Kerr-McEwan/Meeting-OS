import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEmailAllowed } from '@/lib/allowed-domains';
import type { EmailOtpType } from '@supabase/supabase-js';

async function completeSession(
  tokenHash: string | null,
  code: string | null,
  type: EmailOtpType,
  next: string,
  origin: string,
) {
  const supabase = createClient();

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!isEmailAllowed(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const code = searchParams.get('code');
  const type = (searchParams.get('type') as EmailOtpType | null) ?? 'magiclink';
  const next = searchParams.get('next') || '/app';

  if (tokenHash && !code) {
    const params = new URLSearchParams();
    params.set('token_hash', tokenHash);
    params.set('type', type);
    params.set('next', next);
    return NextResponse.redirect(`${origin}/auth/confirm?${params.toString()}`);
  }

  return completeSession(tokenHash, code, type, next, origin);
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const formData = await request.formData();
  const tokenHash = (formData.get('token_hash') as string | null) ?? null;
  const type = (formData.get('type') as EmailOtpType | null) ?? 'magiclink';
  const next = (formData.get('next') as string | null) || '/app';
  return completeSession(tokenHash, null, type, next, origin);
}
