-- Geraspte kaas per soort: oud, jong, belegen en jong belegen, bij AH en
-- Jumbo. "Geraspte oude kaas" en "oude geraspte kaas" vielen op een zoeklink:
-- de mapping kende alleen "geraspte kaas" (jong belegen) en "oude kaas"
-- (plakken, en plakken mogen nooit voor geraspt). zoekProduct zoekt nu op
-- "geraspte <soort> kaas" in welke volgorde het recept het ook schrijft.
-- Nagekeken op ah.nl en jumbo.com, 8 oktober 2026. Achterwaarts veilig.

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('geraspte oude kaas', 'ah goudse oud 48+ geraspt', 3853, null, now()),
  ('geraspte jonge kaas', 'ah goudse jong 48+ geraspt', 46564, null, now()),
  ('geraspte belegen kaas', 'ah goudse belegen geraspte kaas 50', 165625, null, now()),
  ('geraspte jong belegen kaas', 'ah goudse jong belegen 48+ geraspt', 419547, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;

insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (3853, 175, 'g'),
  (46564, 175, 'g'),
  (419547, 175, 'g')
on conflict (product_id) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('geraspte oude kaas', 'Jumbo Geraspt Kaas Oud 48+ 175 g', '395039ZK', null),
  ('geraspte jonge kaas', 'Jumbo Geraspte Kaas Jong 48+ 175 g', '395037ZK', null),
  ('geraspte belegen kaas', 'Jumbo Geraspte Kaas Belegen 48+ 175 g', '395035ZK', null),
  ('geraspte jong belegen kaas', 'Jumbo Geraspte Kaas Jong Belegen 48+ 175 g', '395036ZK', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('395039ZK', 175, 'g'),
  ('395037ZK', 175, 'g'),
  ('395035ZK', 175, 'g')
on conflict (sku) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;
