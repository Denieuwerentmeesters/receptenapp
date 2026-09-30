-- Andere schrijfwijzen voor producten die al gekoppeld zijn (melding Reinoud,
-- 30-09-2026): eiernoodles, basilicumblad, chipotle in adobo en romatomaten
-- kregen een zoeklink.
--
-- We kopiëren de koppeling van een bestaande sleutel, zodat bio- en
-- huismerkvarianten meekomen en er geen nieuw productnummer bij hoeft:
--   eiernoodles, noodles    → noedel          (mie nestjes)
--   basilicumblad(je)       → basilicum
--   chipotle, chipotles     → chipotlesaus    ("chipotle in adobo" vindt 'chipotle' als deel van de naam)
--   romatomaten             → gepelde tomaten (op aanwijzing van Reinoud: uit blik)
-- Bestaat de sleutel al, dan laten we die staan.
-- Ook bijgewerkt in data/ah_mapping.json en data/jumbo_mapping.json.

with alias (nieuw, bron) as (
  values
    ('eiernoodle', 'noedel'), ('eiernoedel', 'noedel'), ('noodle', 'noedel'), ('noodles', 'noedel'),
    ('basilicumblad', 'basilicum'), ('basilicumblaadje', 'basilicum'), ('basilicumblaadjes', 'basilicum'),
    ('chipotle', 'chipotlesaus'), ('chipotles', 'chipotlesaus'),
    ('romatomaten', 'gepelde tomaten'), ('romatomaat', 'gepelde tomaten'),
    ('roma tomaten', 'gepelde tomaten'), ('roma tomaat', 'gepelde tomaten')
)
insert into ah_product_cache
  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, huismerk_product_id, laatst_geverifieerd)
select a.nieuw, c.weergavenaam, c.standaard_product_id, c.bio_product_id, c.huismerk_product_id, now()
from alias a join ah_product_cache c on c.ingredient_key = a.bron
on conflict (ingredient_key) do nothing;

with alias (nieuw, bron) as (
  values
    ('eiernoodle', 'noedel'), ('eiernoedel', 'noedel'), ('noodle', 'noedel'), ('noodles', 'noedel'),
    ('basilicumblad', 'basilicum'), ('basilicumblaadje', 'basilicum'), ('basilicumblaadjes', 'basilicum'),
    ('chipotle', 'chipotlesaus'), ('chipotles', 'chipotlesaus'),
    ('romatomaten', 'gepelde tomaten'), ('romatomaat', 'gepelde tomaten'),
    ('roma tomaten', 'gepelde tomaten'), ('roma tomaat', 'gepelde tomaten')
)
insert into jumbo_product_cache
  (ingredient_key, weergavenaam, standaard_sku, bio_sku, huismerk_sku, laatst_geverifieerd)
select a.nieuw, c.weergavenaam, c.standaard_sku, c.bio_sku, c.huismerk_sku, now()
from alias a join jumbo_product_cache c on c.ingredient_key = a.bron
on conflict (ingredient_key) do nothing;
