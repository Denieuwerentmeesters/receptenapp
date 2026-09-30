-- Verpakkingen tellen (plan gemak en bonus, onderdeel 4B).
--
-- Inhoud per Jumbo-SKU, zodat twee recepten met 500 g gehakt twee pakken van
-- 500 g opleveren en niet één. Per SKU en niet per ingrediënt, net als
-- jumbo_prijs: een bio- of huismerkvariant heeft een eigen inhoud.
-- eenheid is altijd een basiseenheid: g, ml of stuks.
--
-- Gevuld door scripts/jumbo_verpakkingen.py --migratie (de volgende migratie).
-- Voor AH is er (nog) niets: ah.nl is niet te scrapen en de productnamen in
-- de AH-mapping noemen geen inhoud. Daar geldt één verpakking per ingrediënt.

create table if not exists jumbo_verpakking (
  sku     text primary key,
  inhoud  numeric(10, 2) not null check (inhoud > 0),
  eenheid text not null check (eenheid in ('g', 'ml', 'stuks'))
);

alter table jumbo_verpakking enable row level security;

-- Zelfde regel als de mappings en prijzen: iedereen leest, alleen migraties schrijven.
drop policy if exists "iedereen leest de verpakkingen" on jumbo_verpakking;
create policy "iedereen leest de verpakkingen" on jumbo_verpakking
  for select to authenticated using (true);

grant select on jumbo_verpakking to authenticated;
