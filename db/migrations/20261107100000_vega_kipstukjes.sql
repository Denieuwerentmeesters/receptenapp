-- Vega kip bij kipfilet (Reinoud, 7 nov 2026): op de lijst kies je bij kipfilet
-- tussen vega en gewone kip, zoals bij gehakt. De vega-versie is
-- AH Terra Plantaardige kipstukjes 300 g en Jumbo Vegetarische Kipstukjes Naturel 350 g.
-- Prijs en inhoud uit de zoekresultaten van 7 nov 2026; de maandelijkse
-- prijsronde controleert ze opnieuw.
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, laatst_geverifieerd)
values ('vega kipstukjes', 'ah terra plantaardige kipstukjes 300 g', 580545, now())
on conflict (ingredient_key) do nothing;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, laatst_geverifieerd)
values ('vega kipstukjes', 'Jumbo Vegetarische Kipstukjes Naturel 350 g', '681017TRA', now())
on conflict (ingredient_key) do nothing;

insert into ah_verpakking (product_id, inhoud, eenheid) values (580545, 300, 'g')
on conflict (product_id) do nothing;

insert into ah_prijs (product_id, prijs, peildatum) values (580545, 3.45, '2026-11-07')
on conflict (product_id) do nothing;

insert into jumbo_verpakking (sku, inhoud, eenheid) values ('681017TRA', 350, 'g')
on conflict (sku) do nothing;

insert into jumbo_prijs (sku, prijs, peildatum) values ('681017TRA', 4.00, '2026-11-07')
on conflict (sku) do nothing;
