-- Tacoschelpen en ingelegde jalapeño's gaven een zoeklink terwijl ze bij AH
-- en Jumbo gewoon te koop zijn (Reinoud, 28 okt 2026, uit de taco-recepten van
-- 26 okt). Nummers nagekeken in de API van AH: IN_ASSORTMENT.
-- De sleutel was "ingelegde jalapeno" (uit "ingelegde jalapeño's (naar smaak)"):
-- alleen "jalapeno" had een regel. Achterwaarts veilig: alleen nieuwe rijen.

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('tacoschelpen', 'santa maria taco schelpen 135 g', 417521, null, now()),
  ('taco schelpen', 'santa maria taco schelpen 135 g', 417521, null, now()),
  ('ingelegde jalapeno', 'ah jalapenos 295 g', 140616, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;

insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (417521, 135, 'g'),
  (140616, 295, 'g')
on conflict (product_id) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('tacoschelpen', 'Santa Maria Taco Schelpen 12 Stuks 135 g', '730402DS', null),
  ('taco schelpen', 'Santa Maria Taco Schelpen 12 Stuks 135 g', '730402DS', null),
  ('ingelegde jalapeno', 'Santa Maria Jalapeños Green hot 215g', '179657POT', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('730402DS', 135, 'g'),
  ('179657POT', 215, 'g')
on conflict (sku) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;
