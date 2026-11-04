-- Kip: kleinere verpakkingen als standaard.
--
-- Een recept vraagt voor een huishouden meestal 200 tot 300 g kip, maar de
-- standaard was de familieverpakking: 770 g dijfilet en 800 g filet bij AH,
-- 750 g dijfilet bij Jumbo. Wie 250 g nodig had kreeg dus 750 g in het mandje.
-- Nu de standaard een verpakking van ongeveer 250 tot 400 g is; heb je meer
-- nodig, dan telt aantalVerpakkingen er gewoon een bij.
--
-- Bio-varianten en "kippendijen of bot" (530 g) blijven zoals ze waren.
--
-- Achterwaarts veilig: alleen andere nummers en nieuwe verpakkingsrijen.

update ah_product_cache
set standaard_product_id = 533083, weergavenaam = 'ah scharrel kipfilet 2 stuks 300 g', laatst_geverifieerd = now()
where ingredient_key = 'kipfilet';

update ah_product_cache
set standaard_product_id = 626381, weergavenaam = 'ah scharrel kipdijfilet 240 g', laatst_geverifieerd = now()
where ingredient_key in ('kipdij', 'kipdijfilet', 'kippendij', 'kippendijfilet');

update jumbo_product_cache
set standaard_sku = '596700KGR', weergavenaam = 'Jumbo Scharrelkip Filet ca. 415g', laatst_geverifieerd = now()
where ingredient_key = 'kipfilet';

update jumbo_product_cache
set standaard_sku = '746512KGR', weergavenaam = 'Jumbo Scharrelkip Kipdijfilet ca. 245 g', laatst_geverifieerd = now()
where ingredient_key in ('kipdij', 'kipdijfilet', 'kippendij', 'kippendijfilet');

insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (533083, 300, 'g'),
  (626381, 240, 'g')
on conflict (product_id) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('596700KGR', 415, 'g'),
  ('746512KGR', 245, 'g')
on conflict (sku) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;
