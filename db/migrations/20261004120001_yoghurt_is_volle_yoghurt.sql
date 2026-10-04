-- Yoghurt is volle yoghurt — tenzij het recept iets anders zegt.
--
-- "yoghurt" stond bij AH en Jumbo op magere yoghurt. Een recept dat om
-- yoghurt vraagt bedoelt bijna altijd volle. Wie magere wil schrijft dat
-- erbij, en krijgt het dan ook: die krijgt hier een eigen regel met het
-- product dat tot nu toe onder "yoghurt" stond. Zonder die regel zou "magere
-- yoghurt" via het woord yoghurt alsnog volle worden.
--
-- De bio-variant bij magere blijft leeg: bij Jumbo was dat halfvolle, bij AH
-- is niet nagekeken wat het is. Bij twijfel geen.
-- Achterwaarts veilig: alleen andere productnummers in bestaande kolommen.
-- Ook bijgewerkt in data/ah_mapping.json en data/jumbo_mapping.json.

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
select 'magere yoghurt', weergavenaam, standaard_product_id, null, now()
from ah_product_cache
where ingredient_key = 'yoghurt'
on conflict (ingredient_key) do nothing;

update ah_product_cache c
set weergavenaam = v.weergavenaam,
    standaard_product_id = v.standaard_product_id,
    bio_product_id = v.bio_product_id,
    huismerk_product_id = v.huismerk_product_id,
    laatst_geverifieerd = now()
from ah_product_cache v
where c.ingredient_key = 'yoghurt'
  and v.ingredient_key = 'volle yoghurt';

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku, laatst_geverifieerd)
select 'magere yoghurt', weergavenaam, standaard_sku, null, now()
from jumbo_product_cache
where ingredient_key = 'yoghurt'
on conflict (ingredient_key) do nothing;

update jumbo_product_cache c
set weergavenaam = v.weergavenaam,
    standaard_sku = v.standaard_sku,
    bio_sku = v.bio_sku,
    huismerk_sku = v.huismerk_sku,
    laatst_geverifieerd = now()
from jumbo_product_cache v
where c.ingredient_key = 'yoghurt'
  and v.ingredient_key = 'volle yoghurt';
