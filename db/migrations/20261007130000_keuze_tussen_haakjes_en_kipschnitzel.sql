-- Een keuze tussen haakjes telt mee, en vlees voor wie geen vega wil.
--
-- "geraspte kaas (cheddar of jong belegen)" kreeg een zoeklink: de haakjes
-- vielen weg en "kaas" zijn plakken. Nu telt de eerste keuze (zoekProduct in
-- src/lib/zoekProduct.ts), en daarvoor horen geraspte cheddar en geraspte
-- jong belegen in de mapping. "Geraspte kaas" zonder soort is jong belegen,
-- zoals in bijna elk Nederlands recept; wie iets anders wil schrijft dat
-- erbij. Bij AH stond de geraspte cheddar al onder "cheddarkaas".
--
-- Kipschnitzel is de vleesvariant die je op de lijst kunt kiezen bij een vega
-- kipschnitzel (src/lib/vega.ts). Rundergehakt, kipgehakt, rookworst en
-- spekblokjes stonden er al.
--
-- Achterwaarts veilig: alleen nieuwe rijen. Ook bijgewerkt in
-- data/ah_mapping.json, data/jumbo_mapping.json, data/ah_producten.json en
-- data/jumbo_verpakkingen.json.

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('geraspte cheddar', 'ah cheddar geraspte kaas', 454161, null, now()),
  ('geraspte jong belegen', 'ah goudse jong belegen 48+ geraspt', 419547, null, now()),
  ('geraspte kaas', 'ah goudse jong belegen 48+ geraspt', 419547, null, now()),
  ('kipschnitzel', 'ah scharrel kipschnitzel 2 stuks', 533082, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = now();

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku, laatst_geverifieerd)
values
  ('geraspte cheddar', 'Jumbo Geraspte Cheddar Kaas 50+ 150 g', '588988ZK', null, now()),
  ('geraspte jong belegen', 'Jumbo Geraspte Kaas Jong Belegen 48+ 175 g', '395036ZK', null, now()),
  ('geraspte kaas', 'Jumbo Geraspte Kaas Jong Belegen 48+ 175 g', '395036ZK', null, now()),
  ('kipschnitzel', 'Jumbo Kipschnitzel 2 Stuks', '721509KGR', null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();

-- De inhoud, zodat de lijst het aantal verpakkingen kan tellen.
insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (419547, 175, 'g'),
  (533082, 205, 'g')
on conflict (product_id) do update set
  inhoud = excluded.inhoud,
  eenheid = excluded.eenheid;

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('395036ZK', 175, 'g'),
  ('721509KGR', 2, 'stuks')
on conflict (sku) do update set
  inhoud = excluded.inhoud,
  eenheid = excluded.eenheid;
