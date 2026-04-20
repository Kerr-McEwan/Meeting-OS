-- Add sub_items to agenda_items: up to four short numbered points per
-- agenda item, displayed inline under the main title. Stored as a
-- text[] array so we don't need a child table — the app enforces the
-- cap at 4 in the UI.

alter table public.agenda_items
  add column if not exists sub_items text[] not null default '{}'::text[];
