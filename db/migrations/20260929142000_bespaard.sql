-- "Bespaard!": wat je mandje kost naast wat een maaltijdbox zou kosten.
--
-- Achterwaarts veilig: alleen twee nieuwe tabellen.

-- ------------------------------------------------------------- jumbo_prijs

-- Gewone prijs per Jumbo-SKU, gevuld door scripts/jumbo_prijzen.py --migratie.
-- Per SKU en niet per ingrediënt: dezelfde SKU hoort soms bij meerdere
-- sleutels (aardappel, aardappelen), en een bio-SKU heeft een eigen prijs.
create table if not exists jumbo_prijs (
  sku       text primary key,
  prijs     numeric(8, 2) not null,
  peildatum date not null
);

alter table jumbo_prijs enable row level security;

-- Zelfde regel als de mappings: iedereen leest, alleen migraties schrijven.
drop policy if exists "iedereen leest de prijzen" on jumbo_prijs;
create policy "iedereen leest de prijzen" on jumbo_prijs
  for select to authenticated using (true);

grant select on jumbo_prijs to authenticated;

-- -------------------------------------------------------------- bestelling

-- Eén rij per keer dat je bevestigt dat je mandje aankwam. De bedragen worden
-- op dat moment vastgelegd: gaan de prijzen later omhoog, dan verandert wat je
-- toen bespaarde niet mee.
create table if not exists bestelling (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null references gebruiker (id) on delete cascade,
  week_start_datum   date not null,
  besteld_op         timestamptz not null default now(),
  winkel             text not null check (winkel in ('ah', 'jumbo')),
  personen           integer not null check (personen > 0),
  -- De recepten die in deze bestelling meetellen. Een recept telt één keer
  -- per week, ook als je in twee rondes bestelt.
  recept_ids         uuid[] not null default '{}',
  maaltijden         integer not null check (maaltijden >= 0),
  mandje_kosten      numeric(8, 2) not null,
  maaltijdbox_kosten numeric(8, 2) not null
);

create index if not exists bestelling_user_week on bestelling (user_id, week_start_datum);

alter table bestelling enable row level security;

drop policy if exists "eigen rijen" on bestelling;
create policy "eigen rijen" on bestelling
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

grant select, insert on bestelling to authenticated;
