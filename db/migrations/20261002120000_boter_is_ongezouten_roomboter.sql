-- Boter is roomboter, ongezouten — tenzij het recept iets anders zegt.
--
-- "boter" stond bij AH op gezouten roomboter, "roomboter" op ongezouten. Een
-- recept dat om boter vraagt bedoelt bijna altijd ongezouten. Wie gezouten wil
-- schrijft dat erbij, en krijgt het dan ook.
--
-- Bij Jumbo stonden boter en roomboter al allebei op ongezouten.
-- Achterwaarts veilig: alleen andere productnummers in bestaande kolommen.

update ah_product_cache
set weergavenaam = 'ah roomboter ongezouten',
    standaard_product_id = 127487,
    laatst_geverifieerd = now()
where ingredient_key = 'boter';

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('gezouten roomboter', 'ah roomboter gezouten', 2456, null, now()),
  ('gezouten boter', 'ah roomboter gezouten', 2456, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;
