'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { isEmailAllowed } from '@/lib/allowed-domains';

type Props = {
  allowedDomains: string[];
  errorCode?: string;
  next?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  domain: 'That email address is not on the allowed list. Use your company email.',
  missing_code: 'The sign-in link is missing or malformed. Request a new one.',
};

export default function LoginForm({ allowedDomains, errorCode, next }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msStatus, setMsStatus] = useState<'idle' | 'redirecting'>('idle');
  const [error, setError] = useState<string | null>(
    errorCode ? ERROR_MESSAGES[errorCode] ?? errorCode : null,
  );

  const buildRedirect = () => {
    const redirectTo = new URL('/auth/callback', window.location.origin);
    if (next) redirectTo.searchParams.set('next', next);
    return redirectTo.toString();
  };

  const onMicrosoft = async () => {
    setError(null);
    setMsStatus('redirecting');
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email openid profile',
        redirectTo: buildRedirect(),
      },
    });
    if (oauthError) {
      setMsStatus('idle');
      setError(
        'Microsoft sign-in isn\'t configured yet. Contact your admin, or use the email sign-in below.',
      );
    }
    // On success the browser redirects to Microsoft — nothing else to do here.
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!isEmailAllowed(trimmed)) {
      setError(`Use a company email (${allowedDomains.map((d) => '@' + d).join(' or ')}).`);
      return;
    }

    setStatus('sending');
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: buildRedirect() },
    });

    if (signInError) {
      setStatus('error');
      const raw = (signInError.message || '').toLowerCase();
      if (raw.includes('rate limit') || raw.includes('too many')) {
        setError(
          'Too many sign-in attempts in a short period. Wait a few minutes and try again. If it keeps failing, contact your admin.',
        );
      } else if (raw.includes('sending') && raw.includes('email')) {
        setError(
          "We couldn't send the magic-link email. Try 'Sign in with Microsoft' above — it doesn't rely on email delivery.",
        );
      } else {
        setError(signInError.message);
      }
      return;
    }
    setStatus('sent');
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 20 }}>
          <div className="brand-mark">◐</div>
          <div className="brand-text">
            <div className="brand-title">Meeting OS</div>
            <div className="brand-sub">M Squared · internal</div>
          </div>
        </div>

        {status === 'sent' ? (
          <>
            <h1>Check your inbox</h1>
            <p className="login-sub">
              We sent a magic link to <strong>{email}</strong>. Click it to finish signing in.
            </p>
            <button className="btn ghost" onClick={() => { setStatus('idle'); setEmail(''); }}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p className="login-sub">
              Use your Microsoft 365 account — it's the same sign-in you use for Outlook and Teams.
            </p>

            <button
              type="button"
              className="btn ms-signin"
              onClick={onMicrosoft}
              disabled={msStatus === 'redirecting'}
            >
              <MicrosoftLogo />
              {msStatus === 'redirecting' ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
            </button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <form onSubmit={onSubmit} className="login-form">
              <label className="field">
                <span className="field-label">Work email</span>
                <input
                  className="field-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@msquared.co.uk"
                  required
                />
              </label>

              {error && <div className="login-error">{error}</div>}

              <button
                className="btn ghost email-signin"
                type="submit"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
            <div className="login-foot">
              Only <strong>{allowedDomains.map((d) => '@' + d).join(' and ')}</strong> addresses can sign in.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1"  y="1"  width="8" height="8" fill="#f25022" />
      <rect x="11" y="1"  width="8" height="8" fill="#7fba00" />
      <rect x="1"  y="11" width="8" height="8" fill="#00a4ef" />
      <rect x="11" y="11" width="8" height="8" fill="#ffb900" />
    </svg>
  );
}
