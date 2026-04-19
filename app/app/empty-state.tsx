export default function EmptyState({ userEmail }: { userEmail: string }) {
  return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)' }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>No meeting series yet</h1>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Signed in as <strong>{userEmail}</strong>. Run <code>supabase/migrations/0003_seed.sql</code> against your Supabase project to create the starter data, or add a series via the SQL editor:
      </p>
      <pre style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6, fontSize: 11.5, overflow: 'auto' }}>
{`insert into public.meeting_series (slug, name, cadence)
values ('leadership-weekly', 'Leadership weekly', 'Every Mon · 09:00');`}
      </pre>
      <form action="/auth/sign-out" method="post" style={{ marginTop: 16 }}>
        <button type="submit" className="btn ghost">Sign out</button>
      </form>
    </div>
  );
}
