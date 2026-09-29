-- Huismerk-voorkeur (Instellingen → Boodschappen → "Huismerk als het kan").
--
-- Achterwaarts veilig: alleen kolommen erbij. Een huismerkvariant staat
-- alleen ingevuld waar de standaard een A-merk is (Verstegen, Heinz, Conimex)
-- en er een huismerk is dat hetzelfde product is. De meeste standaardkeuzes
-- waren al huismerk. Bij twijfel leeg: dan gaat gewoon de standaard mee.
-- Ook bijgewerkt in data/ah_mapping.json, data/jumbo_mapping.json en
-- data/jumbo_prijzen.json.

alter table gebruiker_voorkeuren
  add column if not exists huismerk_voorkeur boolean not null default false;

alter table ah_product_cache
  add column if not exists huismerk_product_id integer;

alter table jumbo_product_cache
  add column if not exists huismerk_sku text;

-- AH, opgezocht op ah.nl (29-09-2026).
update ah_product_cache c set huismerk_product_id = v.id
from (values
  ('cayennepeper', 570444),
  ('cornflake', 471004),
  ('gerookte spekreepje', 130250),
  ('gnocchi', 210482),
  ('kaneel', 197971),
  ('ketchup', 403602),
  ('kroepoek', 490540),
  ('ontbijtkoek', 217848),
  ('paprikapoeder', 197977),
  ('platte rijstnoedel', 627342),
  ('rijstnoedel', 627342),
  ('volle yoghurt', 33712),
  ('wokolie', 140639),
  ('zout', 3372),
  ('zwarte bonen', 188265)
) as v(ingredient_key, id)
where c.ingredient_key = v.ingredient_key;

-- Jumbo, opgezocht op jumbo.com (29-09-2026).
update jumbo_product_cache c set huismerk_sku = v.sku
from (values
  ('doperwtje', '656961POT'),
  ('gerookt ontbijtspek', '713927TRA'),
  ('groentebouillon', '628616STK'),
  ('kappertje', '168900POT'),
  ('ketchup', '222818FLS'),
  ('kipdrumsticks', '596715KGR'),
  ('laurier', '721522BUS'),
  ('linguine', '717470ZK'),
  ('oestersaus', '195727STK'),
  ('paprikapoeder', '719327BUS'),
  ('rode linzen', '711097ZK'),
  ('sesamzaad', '384698CUP'),
  ('spliterwten', '711086ZK'),
  ('sriracha mayo', '751015FLS'),
  ('stevige tofu', '680366STK'),
  ('volkorenbrood', '300146STK'),
  ('wokolie', '548994FLS'),
  ('zilveruitje', '221079POT')
) as v(ingredient_key, sku)
where c.ingredient_key = v.ingredient_key;

-- Prijzen van de nieuwe Jumbo-SKU's, voor "Bespaard!".
insert into jumbo_prijs (sku, prijs, peildatum)
values
  ('656961POT', 0.59, '2026-09-29'),
  ('713927TRA', 3.35, '2026-09-29'),
  ('628616STK', 1.23, '2026-09-29'),
  ('168900POT', 0.49, '2026-09-29'),
  ('222818FLS', 0.55, '2026-09-29'),
  ('596715KGR', 7.23, '2026-09-29'),
  ('195727STK', 1.53, '2026-09-29'),
  ('719327BUS', 2.19, '2026-09-29'),
  ('711097ZK', 1.59, '2026-09-29'),
  ('384698CUP', 2.99, '2026-09-29'),
  ('711086ZK', 1.99, '2026-09-29'),
  ('751015FLS', 1.99, '2026-09-29'),
  ('300146STK', 1.89, '2026-09-29'),
  ('548994FLS', 3.99, '2026-09-29'),
  ('221079POT', 0.69, '2026-09-29')
on conflict (sku) do update set
  prijs = excluded.prijs,
  peildatum = excluded.peildatum;
