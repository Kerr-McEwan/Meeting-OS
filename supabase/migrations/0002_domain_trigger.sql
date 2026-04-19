-- Reject any sign-up whose email domain is not on the allowlist.
-- The list is kept in a table so you can edit it via the SQL editor
-- without a deploy.

create table if not exists public.allowed_email_domains (
  domain text primary key
);

-- Seed the two M Squared / EBS Construction domains. Edit via the SQL editor
-- if you ever need to add or remove one.
insert into public.allowed_email_domains (domain) values
  ('msquared.co.uk'),
  ('ebsconstruction.co.uk')
on conflict do nothing;

create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  d text := lower(split_part(new.email, '@', 2));
begin
  if d is null or d = '' then
    raise exception 'Invalid email address: %', new.email;
  end if;
  if not exists (select 1 from public.allowed_email_domains where domain = d) then
    raise exception 'Email domain % is not permitted. Contact your admin.', d
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_domain_on_signup on auth.users;
create trigger enforce_email_domain_on_signup
  before insert on auth.users
  for each row execute function public.enforce_email_domain();
