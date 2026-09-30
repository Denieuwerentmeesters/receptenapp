-- Correcties op de zoekgaten-koppelingen (Reinoud, 30-09-2026).
--
-- - Romatomaten zijn gewoon romatomaten (vers), niet gepelde tomaten uit blik:
--   dat koppelden we eerder vandaag verkeerd (20260930160000).
-- - Bier: een sixpack Heineken.
-- - Bloedsinaasappel: winterfruit; als die er niet is gewoon handsinaasappelen.
-- - Klapstuk: runderlap. Rauwe biet: biet (bij Jumbo alleen gekookt).
-- - Thaise roerbakgroentemix: Thaise wokgroente. Zachte taco: tortillawraps.
-- - Zeeduivelfilet: kabeljauwfilet.
-- Upsert: bestaande sleutels (romatomaten) worden overschreven.
-- Ook bijgewerkt in data/ah_mapping.json en data/jumbo_mapping.json.

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('romatomaten', 'ah roma tomaten 750 g', 67874, null, now()),
  ('romatomaat', 'ah roma tomaten 750 g', 67874, null, now()),
  ('roma tomaten', 'ah roma tomaten 750 g', 67874, null, now()),
  ('roma tomaat', 'ah roma tomaten 750 g', 67874, null, now()),
  ('bier', 'heineken premium pilsener 6-pack', 80101, null, now()),
  ('bloedsinaasappel', 'ah handsinaasappelen', 67896, null, now()),
  ('klapstuk', 'ah riblap ca. 720 g', 187574, null, now()),
  ('rauwe bietje', 'ah biologisch rode bieten los', 203002, 203002, now()),
  ('thaise roerbakgroentemix', 'ah thaise wokgroente prei rode peper 400 g', 67663, null, now()),
  ('zachte taco', 'ah tortilla naturel wraps medium 8 stuks', 136836, null, now()),
  ('zeeduivelfilet', 'ah kabeljauwfilet', 416296, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = now();

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku, laatst_geverifieerd)
values
  ('romatomaten', 'Jumbo Roma Tomaten 750 g', '417400SC', null, now()),
  ('romatomaat', 'Jumbo Roma Tomaten 750 g', '417400SC', null, now()),
  ('roma tomaten', 'Jumbo Roma Tomaten 750 g', '417400SC', null, now()),
  ('roma tomaat', 'Jumbo Roma Tomaten 750 g', '417400SC', null, now()),
  ('bier', 'Heineken Premium Pilsener Bier Blik 6 x 500ml', '539048PAK', null, now()),
  ('bloedsinaasappel', 'Jumbo Handsinaasappelen 2 kg', '40589NET', null, now()),
  ('klapstuk', 'Jumbo Rund Sukadelappen 3 Stuks ca. 525 g', '58366KGR', null, now()),
  ('rauwe bietje', 'Jumbo Gekookte Bietjes Biologisch 500 g', '194938ZK', null, now()),
  ('thaise roerbakgroentemix', 'Jumbo Wokgroenten Thais 400 g', '782262ZK', null, now()),
  ('zachte taco', 'Jumbo Tortilla Naturel 8 Stuks', '356627PAK', null, now()),
  ('zeeduivelfilet', 'Jumbo Kabeljauwfilet Naturel 2 Stuks ca. 260 g', '681341KGR', null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();
