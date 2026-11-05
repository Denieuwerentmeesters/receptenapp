-- Gewone prijs per AH-productnummer, naast ah_verpakking en jumbo_prijs.
--
-- Voor de prijs per recept per persoon: wat kost het recept, met wat je in de
-- voorraadkast hebt eraf. Per productnummer en niet per ingrediënt, zoals bij
-- de verpakkingen: een bio- of huismerkvariant heeft een eigen prijs.
--
-- Gevuld door scripts/ah_verpakkingen.py --migratie (de volgende migratie), die
-- ook de verpakkingen meeneemt. Het is de prijs vóór bonus (priceBeforeBonus):
-- aanbiedingen wisselen per week. Achterwaarts veilig: alleen een nieuwe tabel.

create table if not exists ah_prijs (
  product_id integer primary key,
  prijs      numeric(8, 2) not null check (prijs > 0),
  peildatum  date not null
);

alter table ah_prijs enable row level security;

-- Zelfde regel als de mappings en prijzen: iedereen leest, alleen migraties schrijven.
drop policy if exists "iedereen leest de ah-prijzen" on ah_prijs;
create policy "iedereen leest de ah-prijzen" on ah_prijs
  for select to authenticated using (true);

grant select on ah_prijs to authenticated;
