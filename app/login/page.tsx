import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllowedDomains } from '@/lib/allowed-domains';
import LoginForm from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(searchParams.next || '/app');

  const domains = getAllowedDomains();
  return <LoginForm allowedDomains={domains} errorCode={searchParams.error} next={searchParams.next} />;
}
