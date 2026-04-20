import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadInitialData } from '@/lib/data-loader';
import { autoColor, autoInitials } from '@/lib/utils';
import { AppShell } from '@/components/app-shell';
import EmptyState from './empty-state';
import type { TeamMember } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AppPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Ensure the current user has a profile row (usually created by the
  // DB trigger, but on first load from an existing user this is a safety net).
  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0],
    },
    { onConflict: 'id' },
  );

  const data = await loadInitialData();
  if (!data) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Couldn&apos;t load data</h1>
        <p>Check your Supabase URL/keys, and that the migrations have been run.</p>
      </div>
    );
  }

  if (data.series.length === 0) {
    return <EmptyState userEmail={user.email ?? ''} />;
  }

  const profile = data.team.find((t) => t.id === user.id);
  const userMember: TeamMember & { email: string } = {
    id: user.id,
    name: profile?.name || user.email?.split('@')[0] || 'User',
    role: profile?.role || 'Team member',
    initials: profile?.initials || autoInitials(user.email?.split('@')[0] || 'U'),
    color: profile?.color || autoColor(user.id),
    is_admin: profile?.is_admin ?? false,
    email: user.email ?? '',
  };

  return <AppShell initialData={data} user={userMember} />;
}
