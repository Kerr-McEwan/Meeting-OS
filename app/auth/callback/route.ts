import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEmailAllowed } from '@/lib/allowed-domains';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const type = (searchParams.get('type') as EmailOtpType | null) ?? 'magiclink';
    const next = searchParams.get('next') || '/app';

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
