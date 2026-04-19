-- Meeting OS core schema.
--
-- One small team, so policies are simple: every authenticated user whose
-- email domain is allowed can read and write everything. The domain check
-- is enforced at sign-up via a trigger (see 0002_domain_trigger.sql) plus
-- in the Next.js middleware, so if a row-owner is authenticated they are
-- already trusted.

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------
-- profiles: one row per auth.users row, holds display metadata
-- -----------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  initials text,
  role text,
  color text default 'oklch(0.70 0.08 60)',
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  name_guess text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  inits text := upper(
    substring(split_part(name_guess, ' ', 1) from 1 for 1) ||
    coalesce(substring(split_part(name_guess, ' ', 2) from 1 for 1), '')
  );
begin
  insert into public.profiles (id, email, full_name, initials)
  values (new.id, new.email, name_guess, nullif(inits, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------
-- meeting_series: each recurring meeting (Leadership weekly, Ops standup…)
-- -----------------------------------------------------------------------
create table if not exists public.meeting_series (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  cadence text,
  description text,
  color_accent text default 'oklch(0.62 0.15 40)',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------
-- sections: agenda section colour bands, per series
-- -----------------------------------------------------------------------
create table if not exists public.sections (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid not null references public.meeting_series(id) on delete cascade,
  slug text not null,
  name text not null,
  color text not null default 'oklch(0.70 0.08 200)',
  sort_order int not null default 0,
  unique (series_id, slug)
);

-- -----------------------------------------------------------------------
-- agenda_items: rows of the pivot table
-- -----------------------------------------------------------------------
create table if not exists public.agenda_items (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid not null references public.meeting_series(id) on delete cascade,
  section_id uuid references public.sections(id) on delete set null,
  item text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------
-- meetings: columns of the pivot table
-- -----------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid not null references public.meeting_series(id) on delete cascade,
  meeting_date date not null,
  label text,
  chair_id uuid references public.profiles(id) on delete set null,
  upcoming boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------
-- meeting_attendees: who's in each meeting, chair + apology flags
-- -----------------------------------------------------------------------
create table if not exists public.meeting_attendees (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_chair boolean not null default false,
  is_apology boolean not null default false,
  primary key (meeting_id, profile_id)
);

-- -----------------------------------------------------------------------
-- cells: notes + status for (agenda_item × meeting)
-- -----------------------------------------------------------------------
do $$ begin
  create type public.cell_status as enum ('done', 'carry', 'to_action', 'in_progress', 'stuck', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.cells (
  id uuid primary key default uuid_generate_v4(),
  agenda_item_id uuid not null references public.agenda_items(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  notes text not null default '',
  status public.cell_status not null default 'done',
  updated_at timestamptz not null default now(),
  unique (agenda_item_id, meeting_id)
);

-- -----------------------------------------------------------------------
-- decisions
-- -----------------------------------------------------------------------
create table if not exists public.decisions (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid not null references public.meeting_series(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  agenda_item_id uuid references public.agenda_items(id) on delete set null,
  section_id uuid references public.sections(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------
-- actions
-- -----------------------------------------------------------------------
do $$ begin
  create type public.action_status as enum ('to_action', 'in_progress', 'stuck', 'done', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.action_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

create table if not exists public.actions (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid not null references public.meeting_series(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  agenda_item_id uuid references public.agenda_items(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  due_date date,
  status public.action_status not null default 'to_action',
  priority public.action_priority not null default 'medium',
  raised_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.meeting_series    enable row level security;
alter table public.sections          enable row level security;
alter table public.agenda_items      enable row level security;
alter table public.meetings          enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.cells             enable row level security;
alter table public.decisions         enable row level security;
alter table public.actions           enable row level security;

-- Simple policy helper: any authenticated user can do anything. Sign-up is
-- already restricted to the allowed email domains, so we trust anyone who
-- made it through auth.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles','meeting_series','sections','agenda_items','meetings',
    'meeting_attendees','cells','decisions','actions'
  ]) loop
    execute format('drop policy if exists "team_read_%1$s"  on public.%1$s;', t);
    execute format('drop policy if exists "team_write_%1$s" on public.%1$s;', t);
    execute format('create policy "team_read_%1$s"  on public.%1$s for select using (auth.role() = ''authenticated'');', t);
    execute format('create policy "team_write_%1$s" on public.%1$s for all    using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');', t);
  end loop;
end $$;

-- Helpful indexes
create index if not exists agenda_items_series_idx on public.agenda_items (series_id, sort_order);
create index if not exists meetings_series_date_idx on public.meetings (series_id, meeting_date);
create index if not exists cells_meeting_idx on public.cells (meeting_id);
create index if not exists actions_series_status_idx on public.actions (series_id, status);
create index if not exists decisions_meeting_idx on public.decisions (meeting_id);
