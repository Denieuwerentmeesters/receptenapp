-- Plantaardige yoghurt en mayo koppelen (Reinoud, 6 nov 2026).
-- Beide zijn er gewoon bij AH en Jumbo; ze stonden nog niet in de mapping.
-- Yoghurt: AH Terra Plantaardig alternatief voor yoghurt (500 g) en Alpro Mild &
-- Creamy naturel (755 g, Jumbo); "Griekse" en "dikke" krijgen het Griekse alternatief.
-- Mayo: Remia Mayolijn, 100% plantaardig, bij beide winkels (500 ml).
-- Inhoud en prijs uit het zoekresultaat van 6 nov 2026 (de AH-detail-API gaf 404);
-- de maandelijkse prijsronde controleert ze opnieuw.
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, laatst_geverifieerd)
values
  ('plantaardige yoghurt', 'ah terra plantaardig alternatief voor yoghurt', 570908, now()),
  ('vegan yoghurt', 'ah terra plantaardig alternatief voor yoghurt', 570908, now()),
  ('veganistische yoghurt', 'ah terra plantaardig alternatief voor yoghurt', 570908, now()),
  ('dikke plantaardige yoghurt', 'ah terra plantaardig alternatief voor griekse', 601557, now()),
  ('plantaardige griekse yoghurt', 'ah terra plantaardig alternatief voor griekse', 601557, now()),
  ('plantaardige mayonaise', 'remia mayolijn 100% plantaardig', 437725, now()),
  ('plantaardige mayo', 'remia mayolijn 100% plantaardig', 437725, now()),
  ('vegan mayonaise', 'remia mayolijn 100% plantaardig', 437725, now()),
  ('vegan mayo', 'remia mayolijn 100% plantaardig', 437725, now()),
  ('veganistische mayonaise', 'remia mayolijn 100% plantaardig', 437725, now())
on conflict (ingredient_key) do nothing;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, laatst_geverifieerd)
values
  ('plantaardige yoghurt', 'Alpro Mild & Creamy Naturel Plantaardige Variatie Op Yoghurt 755 g', '486574PAK', now()),
  ('vegan yoghurt', 'Alpro Mild & Creamy Naturel Plantaardige Variatie Op Yoghurt 755 g', '486574PAK', now()),
  ('veganistische yoghurt', 'Alpro Mild & Creamy Naturel Plantaardige Variatie Op Yoghurt 755 g', '486574PAK', now()),
  ('dikke plantaardige yoghurt', 'Jumbo Plantaardige Griekse Stijl Naturel 10% Vet 1 kg', '644855TRA', now()),
  ('plantaardige griekse yoghurt', 'Jumbo Plantaardige Griekse Stijl Naturel 10% Vet 1 kg', '644855TRA', now()),
  ('plantaardige mayonaise', 'Remia Mayolijn 500 ml', '425241FLS', now()),
  ('plantaardige mayo', 'Remia Mayolijn 500 ml', '425241FLS', now()),
  ('vegan mayonaise', 'Remia Mayolijn 500 ml', '425241FLS', now()),
  ('vegan mayo', 'Remia Mayolijn 500 ml', '425241FLS', now()),
  ('veganistische mayonaise', 'Remia Mayolijn 500 ml', '425241FLS', now())
on conflict (ingredient_key) do nothing;

insert into ah_verpakking (product_id, inhoud, eenheid) values
  (570908, 500, 'g'),
  (601557, 1000, 'g'),
  (437725, 500, 'ml')
on conflict (product_id) do nothing;

insert into ah_prijs (product_id, prijs, peildatum) values
  (570908, 0.99, '2026-11-06'),
  (601557, 2.99, '2026-11-06'),
  (437725, 2.29, '2026-11-06')
on conflict (product_id) do nothing;

insert into jumbo_verpakking (sku, inhoud, eenheid) values
  ('486574PAK', 755, 'g'),
  ('644855TRA', 1000, 'g'),
  ('425241FLS', 500, 'ml')
on conflict (sku) do nothing;

insert into jumbo_prijs (sku, prijs, peildatum) values
  ('486574PAK', 2.89, '2026-11-06'),
  ('644855TRA', 2.99, '2026-11-06'),
  ('425241FLS', 2.49, '2026-11-06')
on conflict (sku) do nothing;
