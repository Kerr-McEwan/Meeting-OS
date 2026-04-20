export default function EmptyState({ userEmail }: { userEmail: string }) {
  return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)' }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Nothing here yet</h1>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Signed in as <strong>{userEmail}</strong>. You can see any meeting you&rsquo;ve been invited to — right now there aren&rsquo;t any. Ask your admin to add you to a meeting, or sign out and back in after you&rsquo;ve been added.
      </p>
      <form action="/auth/sign-out" method="post" style={{ marginTop: 16 }}>
        <button type="submit" className="btn ghost">Sign out</button>
      </form>
    </div>
  );
}
