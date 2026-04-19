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
  const [error, setError] = useState<string | null>(
    errorCode ? ERROR_MESSAGES[errorCode] ?? errorCode : null,
  );

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
    const redirectTo = new URL('/auth/callback', window.location.origin);
    if (next) redirectTo.searchParams.set('next', next);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo.toString() },
    });

    if (signInError) {
      setStatus('error');
      setError(signInError.message);
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
              Enter your M Squared or EBS Construction email and we'll send you a sign-in link.
            </p>
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
                  autoFocus
                />
              </label>

              {error && <div className="login-error">{error}</div>}

              <button
                className="btn primary"
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
