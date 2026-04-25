-- Remove the hard-coded domain restriction at the database level.
-- Anyone can now be invited to Meeting OS by email. The privacy model is
-- enforced by RLS (users only see meetings they're listed as attendees of),
-- so an uninvited account that somehow lands a session can still see
-- nothing.
--
-- The allowed_email_domains table stays in place — empty or populated, it's
-- harmless and lets you re-enable a strict domain allowlist quickly later
-- by re-creating the trigger below.

drop trigger if exists enforce_email_domain_on_signup on auth.users;
drop function if exists public.enforce_email_domain();
