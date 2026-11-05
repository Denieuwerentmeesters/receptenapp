-- Goedkoper alternatief voor parmezaan in de boodschappenlijst (Reinoud, 5 nov 2026):
-- het zakje AH Biologisch Italiaanse Parmigiano Reggiano (wi400471, 40 g, € 1,99).
-- Grana Padano (wi462470 / Jumbo 492900STK) staat al onder 'grana padano'.
-- Bij Jumbo is er geen zakje; de standaard daar (flakes 125 g) is al € 3,49.
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, laatst_geverifieerd)
values ('parmezaan zakje', 'ah biologisch italiaanse parmigiano reggiano', 400471, now())
on conflict (ingredient_key) do nothing;

insert into ah_verpakking (product_id, inhoud, eenheid) values (400471, 40, 'g')
on conflict (product_id) do nothing;

insert into ah_prijs (product_id, prijs, peildatum) values (400471, 1.99, '2026-11-05')
on conflict (product_id) do nothing;
