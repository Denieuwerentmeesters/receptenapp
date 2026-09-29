-- Krop sla en zalmsnippers in de mapping.
--
-- "Sla" en "krop sla" gaven een zoeklink; bedoeld is een gewone krop sla.
-- "Zalmsnippers" (sleutel zalmsnipper) stond er alleen als "gerookte
-- zalmsnippers". Nagekeken op ah.nl en jumbo.com.
-- Ook bijgewerkt in data/ah_mapping.json en data/jumbo_mapping.json.

insert into ah_product_cache
  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('sla', 'ah kropsla', 382984, null, now()),
  ('kropsla', 'ah kropsla', 382984, null, now()),
  ('krop sla', 'ah kropsla', 382984, null, now()),
  ('zalmsnipper', 'ah gerookte zalmsnippers', 168829, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = now();

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('sla', 'Jumbo Kropsla', '302247STK', null),
  ('kropsla', 'Jumbo Kropsla', '302247STK', null),
  ('krop sla', 'Jumbo Kropsla', '302247STK', null),
  ('zalmsnipper', 'Jumbo Zalmsnippers Houtgerookt 150 g', '681086STK', null),
  ('gerookte zalmsnipper', 'Jumbo Zalmsnippers Houtgerookt 150 g', '681086STK', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();
