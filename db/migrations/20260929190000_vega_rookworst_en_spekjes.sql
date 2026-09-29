-- Vega rookworst en vega spekjes in beide mappings.
--
-- Net als gehakt gaan rookworst en spekjes uit een recept standaard vega naar
-- het mandje; op de boodschappenlijst kun je per regel terug naar wat het
-- recept vraagt (app/src/lib/vega.ts). De app zoekt het product op onder
-- 'vega rookworst' en 'vega spekjes'.
-- Ook bijgewerkt in data/ah_mapping.json en data/jumbo_mapping.json.

insert into ah_product_cache
  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('vega rookworst', 'unox rookworst vegetarisch', 445001, null, now()),
  ('vega spekjes', 'ah terra plantaardige spekjes', 519526, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = now();

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('vega rookworst', 'Unox Rookworst Vegetarisch 250 g', '213515STK', null),
  ('vega spekjes', 'Vivera Plantaardige Spekjes 175 g', '675976TRA', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku;
