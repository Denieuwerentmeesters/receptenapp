-- Gierst koppelen (Reinoud, 5 nov 2026): AH Smaakt Gierst, wi467252, 400 g, € 2,29.
-- Inhoud en prijs uit de AH-productpagina via een zoekresultaat (de AH-API gaf
-- die dag 404); de maandelijkse prijsronde controleert ze opnieuw.
-- Jumbo heeft geen gierst: daar blijft het een zoeklink.
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, laatst_geverifieerd)
values ('gierst', 'smaakt gierst', 467252, now())
on conflict (ingredient_key) do nothing;

insert into ah_verpakking (product_id, inhoud, eenheid) values (467252, 400, 'g')
on conflict (product_id) do nothing;

insert into ah_prijs (product_id, prijs, peildatum) values (467252, 2.29, '2026-11-05')
on conflict (product_id) do nothing;
