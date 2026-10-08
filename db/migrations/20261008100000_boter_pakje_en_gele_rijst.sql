-- Nazorg na de eerste importtest (8 oktober 2026).
--
-- 1. Boter was de smeerbare kuip. AH heeft twee producten die allebei
--    "AH Roomboter ongezouten 250 g" heten: 127487 is de kuip ("direct uit de
--    koelkast smeerbaar") en 193236 het pakje ("voor koken en bakken"). De
--    mapping stond op de kuip; een recept bedoelt het pakje. De bio-variant
--    (58082) en gezouten (2456) zijn al pakjes. Nagekeken op ah.nl.
-- 2. Gele rijst had geen mapping: Lassie Gele Rijst 325 g bij AH en Jumbo.
--
-- Achterwaarts veilig: alleen andere productnummers en nieuwe rijen.

update ah_product_cache
set standaard_product_id = 193236,
    laatst_geverifieerd = now()
where ingredient_key in ('boter', 'roomboter')
  and standaard_product_id = 127487;

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('gele rijst', 'lassie gele rijst 325 g', 62372, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;

insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (193236, 250, 'g'),
  (62372, 325, 'g')
on conflict (product_id) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('gele rijst', 'Lassie Gele Rijst 325 g', '531901PAK', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('531901PAK', 325, 'g')
on conflict (sku) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;
