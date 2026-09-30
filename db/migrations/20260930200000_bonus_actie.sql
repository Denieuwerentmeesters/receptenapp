-- Bonus en aanbiedingen (plan "gemak en bonus", onderdeel 5).
--
-- Eén rij per actie per ingrediënt, alleen acties die aan onze mapping
-- gekoppeld zijn. Gevuld door de nachtelijke cron api/bonus.ts uit
-- PrijsProfeet; die vervangt per winkel alle rijen in één transactie, zodat
-- verlopen acties vanzelf verdwijnen (PrijsProfeet: prijzen niet langer dan
-- 24 uur als actueel tonen).
--
-- Of een actie telt, hangt af van de bezorgdag: geldig_van <= bezorgdag <=
-- geldig_tot (zie app/src/lib/bonus.ts). Daarom bewaren we ook acties die
-- pas later beginnen, zoals de AH-bonus van volgende week.
--
-- Achterwaarts veilig: alleen een nieuwe tabel.

create table if not exists bonus_actie (
  id             uuid primary key default gen_random_uuid(),
  winkel         text not null check (winkel in ('ah', 'jumbo')),
  bron           text not null default 'prijsprofeet',
  extern_id      text not null,
  ingredient_key text not null,
  titel          text not null,
  prijs_nu       numeric(8, 2),
  prijs_was      numeric(8, 2),
  mechanisme     text,
  geldig_van     date not null,
  geldig_tot     date not null,
  product_url    text,
  opgehaald_op   timestamptz not null default now(),
  unique (winkel, extern_id, ingredient_key, geldig_van)
);

create index if not exists bonus_actie_key on bonus_actie (winkel, ingredient_key);

alter table bonus_actie enable row level security;

-- Zelfde regel als de mappings: iedereen die is ingelogd leest, alleen de
-- server schrijft (directe connectie, buiten RLS).
drop policy if exists "iedereen leest de bonus" on bonus_actie;
create policy "iedereen leest de bonus" on bonus_actie
  for select to authenticated using (true);

grant select on bonus_actie to authenticated;
