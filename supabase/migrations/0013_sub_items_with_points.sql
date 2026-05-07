-- Convert agenda_items.sub_items from text[] to jsonb so each sub-item can
-- carry its own list of discussion points.
--
-- Old shape: ["Morale check", "Capacity update"]
-- New shape: [{"text":"Morale check","points":["Recent feedback","Team feeling"]},
--             {"text":"Capacity update","points":[]}]
--
-- Existing sub-items are preserved with empty points arrays.

alter table public.agenda_items
  add column if not exists sub_items_jsonb jsonb not null default '[]'::jsonb;

update public.agenda_items
set sub_items_jsonb = coalesce((
  select jsonb_agg(jsonb_build_object('text', s, 'points', '[]'::jsonb))
  from unnest(sub_items) as s
), '[]'::jsonb)
where sub_items is not null
  and array_length(sub_items, 1) > 0
  and sub_items_jsonb = '[]'::jsonb;

alter table public.agenda_items drop column sub_items;
alter table public.agenda_items rename column sub_items_jsonb to sub_items;
