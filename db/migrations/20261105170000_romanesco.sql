-- Romanesco koppelen (Reinoud, 5 nov 2026): "romanescoroosjes" is gewoon romanesco.
-- AH Mini romanesco (wi604090, per stuk, € 1,69). De gewone AH Romanesco
-- (wi231701) staat als uit het assortiment op ah.nl, dus die nemen we niet.
-- Prijs uit de AH-pagina via een zoekresultaat; de AH-API gaf die dag 404.
-- Jumbo: nog geen product gevonden, daar blijft het een zoeklink.
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, laatst_geverifieerd)
values ('romanesco', 'ah mini romanesco', 604090, now()),
       ('romanescoroosje', 'ah mini romanesco', 604090, now())
on conflict (ingredient_key) do nothing;

insert into ah_verpakking (product_id, inhoud, eenheid) values (604090, 1, 'stuks')
on conflict (product_id) do nothing;

insert into ah_prijs (product_id, prijs, peildatum) values (604090, 1.69, '2026-11-05')
on conflict (product_id) do nothing;
