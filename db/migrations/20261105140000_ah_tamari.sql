-- Tamari koppelen aan AH (Reinoud, 5 nov 2026): Saitaku Tamari Soy Sauce, wi164489.
-- Bij Jumbo staat 'tamari' al (49933FLS, Saitaku Tamari Soy Sauce 150 ml).
-- De AH-API geeft dit nummer niet terug, dus inhoud (150 ml, zoals bij Jumbo) is
-- niet bij AH nagekeken en er is geen prijs: de receptprijs valt terug op de
-- klassenschatting tot scripts/ah_verpakkingen.py het wel vindt.
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, laatst_geverifieerd)
values ('tamari', 'saitaku tamari soy sauce', 164489, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;

insert into ah_verpakking (product_id, inhoud, eenheid) values (164489, 150, 'ml')
on conflict (product_id) do nothing;
