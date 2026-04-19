import { redirect } from 'next/navigation';

export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string; next?: string };
}) {
  const tokenHash = searchParams.token_hash;
  const type = searchParams.type ?? 'magiclink';
  const next = searchParams.next ?? '/app';

  if (!tokenHash) {
    redirect('/login?error=missing_code');
  }

  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: '#0b0b0b',
        color: '#fafafa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          Sign in to Meeting OS
        </h1>
        <p style={{ color: '#a3a3a3', marginBottom: '1.5rem' }}>
          Click the button below to complete your sign-in.
        </p>
        <form method="POST" action="/auth/callback">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            style={{
              padding: '0.75rem 2rem',
              background: '#fafafa',
              color: '#0b0b0b',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
