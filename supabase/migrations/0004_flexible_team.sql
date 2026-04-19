-- Allow team members to exist as profile rows without an auth.users row,
-- so attendees can be added inline from the UI without forcing them to
-- sign up first. When a guest later signs in via magic link, they will
-- get a separate auth-linked profile. Reconciling by email is a follow-up.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

-- Email becomes optional (guest profiles may not have one yet).
-- The unique constraint stays — Postgres allows multiple NULLs by default,
-- so this still prevents two real profiles sharing an email.
alter table public.profiles
  alter column email drop not null;

-- Mark whether a profile is auth-linked (real sign-in) or a guest stub.
alter table public.profiles
  add column if not exists is_guest boolean not null default false;
