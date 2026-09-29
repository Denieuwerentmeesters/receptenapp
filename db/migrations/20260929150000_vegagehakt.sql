-- Vegagehakt in beide mappings.
--
-- Gehakt uit een recept gaat standaard als vegagehakt naar het mandje; op de
-- boodschappenlijst kun je per regel terug naar het gehakt uit het recept
-- (app/src/lib/gehakt.ts). De app zoekt het product op onder 'vegagehakt'.
-- Ook bijgewerkt in data/ah_mapping.json en data/jumbo_mapping.json.

insert into ah_product_cache
  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('vegagehakt', 'ah terra plantaardige rulgehakt', 620842, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = now();

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('vegagehakt', 'Jumbo Plantaardig Gehakt Rul Gegaard 400 g', '716783BAK', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku;
