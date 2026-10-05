-- Verpakkingen tellen voor AH (vervolg op jumbo_verpakking).
--
-- Inhoud per AH-productnummer, zodat 1 kg vegagehakt drie pakken van 375 g
-- wordt en niet één. Per productnummer en niet per ingrediënt: een bio- of
-- huismerkvariant heeft een eigen inhoud. eenheid is altijd een basiseenheid:
-- g, ml of stuks.
--
-- Gevuld door scripts/ah_verpakkingen.py --migratie (de volgende migratie).
-- Staat een product er niet in, dan telt de app één verpakking, zoals voorheen.

create table if not exists ah_verpakking (
  product_id integer primary key,
  inhoud     numeric(10, 2) not null check (inhoud > 0),
  eenheid    text not null check (eenheid in ('g', 'ml', 'stuks'))
);

alter table ah_verpakking enable row level security;

-- Zelfde regel als de mappings en prijzen: iedereen leest, alleen migraties schrijven.
drop policy if exists "iedereen leest de ah-verpakkingen" on ah_verpakking;
create policy "iedereen leest de ah-verpakkingen" on ah_verpakking
  for select to authenticated using (true);

grant select on ah_verpakking to authenticated;
