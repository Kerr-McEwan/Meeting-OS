# Meeting OS — M Squared

Internal meeting-operations tool for M Squared and EBS Construction. Built with Next.js 14 (App Router) and Supabase.

- **Meeting Agenda** — pivot table with agenda items down the side and meetings across the top. Each cell is Notes / Decisions / Actions.
- **Action Log** — all actions across the current series, filterable by status / owner / meeting, with overdue highlighting.
- **Decision Log** — decisions grouped by meeting, searchable.
- Sign-in is restricted to `@msquared.co.uk` and `@ebsconstruction.co.uk` addresses via magic link.

## Quick start (local dev)

```bash
npm install
cp .env.example .env.local
# Fill in Supabase URL + keys, then:
npm run dev
```

Open http://localhost:3000.

## One-time setup

### 1. Create a Supabase project

1. Go to <https://supabase.com> and create a new project.
2. **Project Settings → API**: copy the project URL, the `anon` public key, and the `service_role` secret key.
3. **Authentication → Providers → Email**: make sure **Email** is enabled. Turn off "Confirm email" if you want instant access after clicking the magic link (recommended for internal use).
4. **Authentication → URL Configuration**: add your Vercel URL and `http://localhost:3000` to the "Redirect URLs" list.

### 2. Run the migrations

Open **Supabase → SQL Editor → New query** and run each file in order:

1. `supabase/migrations/0001_init.sql` — tables, enums, RLS policies, profile trigger.
2. `supabase/migrations/0002_domain_trigger.sql` — blocks sign-up from non-allowed email domains at the database level.
3. `supabase/migrations/0003_seed.sql` — one Leadership Weekly series with 8 agenda items, one past meeting (populated) and one upcoming meeting, plus a few example actions and decisions. Delete this row by row once you have real data.

If you prefer the CLI: `supabase db push` after linking the project.

### 3. Edit the allowed email domains (optional)

The allowlist is stored in the `allowed_email_domains` table. To add or remove a domain, run:

```sql
insert into allowed_email_domains (domain) values ('anotherdomain.co.uk');
delete from allowed_email_domains where domain = 'something.com';
```

Keep the `ALLOWED_EMAIL_DOMAINS` env var in sync (used by the middleware for an early bounce at the edge).

### 4. Set local env vars

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ALLOWED_EMAIL_DOMAINS=msquared.co.uk,ebsconstruction.co.uk
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Deploying to Vercel

1. Push this repo to GitHub (already done on `claude/build-m-squared-app-i94CH`).
2. Go to <https://vercel.com/new>, import the repo.
3. On the "Configure Project" screen, add the same four env vars as above, but set `NEXT_PUBLIC_SITE_URL` to the Vercel production URL (e.g. `https://meeting-os.vercel.app`).
4. Click **Deploy**.
5. Back in Supabase → **Authentication → URL Configuration**, add the Vercel URL to the redirect allowlist.

Future pushes to `main` (or whatever branch you merge into) auto-deploy.

## How sign-in works

- User enters their email on `/login`.
- We call `supabase.auth.signInWithOtp(...)`, which emails them a magic link.
- The link lands on `/auth/callback`, which exchanges the code for a session cookie and bounces them back to `/app`.
- **Three defence layers** ensure only `@msquared.co.uk` and `@ebsconstruction.co.uk` addresses get in:
  1. Client-side check in the login form (fast feedback).
  2. `middleware.ts` runs on every request — if a signed-in user's email no longer matches, they're signed out immediately.
  3. A Postgres `BEFORE INSERT` trigger on `auth.users` raises an exception if the email domain isn't in `allowed_email_domains`, so even a bypassed client can't create a stray account.

## Tech stack

- **Next.js 14** (App Router, TypeScript, React 18)
- **Supabase** — Postgres, Auth, Row Level Security
- **CSS** — pure CSS from the Claude Design handoff, no Tailwind. Ported verbatim to `app/globals.css`.

## Project layout

```
app/
  layout.tsx              Global html shell + fonts
  globals.css             All styles (ported from handoff)
  login/                  Magic-link sign-in form
  auth/callback           OAuth / OTP code exchange
  auth/sign-out           POST to end the session
  app/                    Authenticated app routes
    page.tsx              Loads initial data, renders <AppShell />
    empty-state.tsx       Shown when no meeting series exist
components/
  app-shell.tsx           Main client component — holds state, wires Supabase writes
  atoms.tsx               Icon, Avatar, StatusPill, StatusDropdown, SeriesPicker, SearchInput
  sidebar.tsx             Sidebar, Topbar, Stats
  horizontal-view.tsx     Pivot table
  cell-drawer.tsx         Side drawer for editing a cell
  action-log.tsx          Action Log page
  decision-log.tsx        Decision Log page
  new-series-modal.tsx    2-step modal for creating a new meeting series
  tweaks-panel.tsx        Appearance toggles (theme, density, typography, accent)
lib/
  supabase/
    browser.ts            Browser Supabase client
    server.ts             Server Supabase client (uses Next cookies)
    middleware.ts         Session-refresh + domain-enforcing middleware helper
  allowed-domains.ts      The email-domain allowlist
  data-loader.ts          Server-side initial data fetch
  types.ts                Shared TypeScript types
  utils.ts                formatDate, daysUntil, etc.
supabase/migrations/      SQL migrations — run in order in the Supabase SQL editor
middleware.ts             Applies the session refresh + domain check on every request
```

## Iterating on the UI

Everything visual lives in:

- **`app/globals.css`** — colours, spacing, density, component styles. Tweak CSS vars at the top to rebrand.
- **`components/tweaks-panel.tsx`** — the live "Tweaks" FAB lets you toggle theme / density / typography / accent / pivot cell style at runtime. Your picks are saved to `localStorage`.
- Individual component files under `components/` own their own markup.

## Common tasks

- **Add a user to the team**: they just need to sign in once with their company email — the trigger auto-creates their `profiles` row. You can then edit their display name / role / avatar colour in the Supabase table editor.
- **Add a new allowed domain**: `insert into allowed_email_domains ...` (see section 3) **and** update `ALLOWED_EMAIL_DOMAINS` in Vercel env vars.
- **Reset the demo data**: delete rows from `meeting_series` (cascades to sections, agenda_items, meetings, etc.).
