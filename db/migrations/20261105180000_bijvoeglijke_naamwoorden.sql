-- Ingrediënten met een bijvoeglijk naamwoord koppelen (Reinoud, 5 nov 2026).
-- Reinoud zocht de producten bij AH op (16 stuks), de rest is door Claude op
-- ah.nl gezocht en alleen genomen waar het product duidelijk hetzelfde is.
-- Inhoud en prijs komen van de AH-productpagina's (5 nov 2026); Jumbo alleen
-- waar jumbo.com hetzelfde product heeft. Bij twijfel geen mapping: zoeklink.

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, laatst_geverifieerd)
values
  ('shiitake paddenstoelen', 'ah biologisch shiitake', 525265, now()),
  ('lange vinger', 'ah lange vingers', 1035, now()),
  ('digestive koekje', 'ah digestive', 46865, now()),
  ('cherrytomaten aan tak', 'ah sweet cherry cherrytomaten', 165583, now()),
  ('vastkokende roodschillige aardappel', 'ah rouges', 129869, now()),
  ('taggiasche olijven', 'ah excellent taggiasca olijf zonder pit', 480034, now()),
  ('ongekookte beenham met zwoerd', 'ah ovenschotel beenham naturel', 418194, now()),
  ('comte kaas', 'ah excellent comté stuk', 444965, now()),
  ('kewpie mayonaise', 'kewpie mayonnaise', 553348, now()),
  ('roze fondant', 'steensma rolfondant roze', 628150, now()),
  ('rood fruit', 'ah biologisch doosje met zomerfruit', 582546, now()),
  ('fijne maispolenta', 'smaakt polenta', 227849, now()),
  ('bloemkool en broccoliroosje', 'ah broccoliroosjes', 226367, now()),
  ('dille', 'ah dille', 611643, now()),
  ('gemengde rijst', 'lassie meer granenrijst', 525365, now()),
  ('cottage cheese light', 'ah cottage cheese', 595367, now()),
  ('zwart sesamzaad', 'saitaku geroosterd zwart sesamzaad', 203822, now()),
  ('panko paneermeel', 'saitaku panko breadcrumbs', 203823, now()),
  ('blanke amandelen', 'ah geblancheerde amandelen ongezouten', 610759, now()),
  ('courgette spaghetti', 'ah courgette spaghetti', 379923, now()),
  ('gegrilde paprika', 'ah gegrilde rode paprika', 189682, now()),
  ('orechiette pasta', 'de cecco orecchiette', 450222, now()),
  ('kikkoman sojasaus less salt', 'kikkoman sojasaus minder zout', 182796, now()),
  ('san marzano tomaten', 'ah pomodoro san marzano tomaten', 575257, now()),
  ('waterkers', 'ah biologisch waterkers', 107669, now()),
  ('baking soda', 'dr. oetker baksoda', 314377, now()),
  ('sriracha mayonaise', 'go-tan sriracha mayo', 516869, now()),
  ('surinaamse sambal', 'koningsvogel surinaamse sambal', 591788, now()),
  ('japanse mayonaise', 'kewpie mayonnaise', 553348, now()),
  ('fijne havermout', 'ah volkoren havermout fijne', 569985, now()),
  ('thaise rode currypasta', 'koh thai rode currypasta', 188932, now()),
  ('groene pesto', 'ah groene pesto', 170655, now()),
  ('rode pesto', 'ah pesto rosso', 170654, now()),
  ('gerookte kipfilet', 'ah gerookte kipfilet', 171483, now()),
  ('gezouten cashewnoten', 'ah cashew gezouten', 582887, now()),
  ('coquille', 'ah excellent coquilles', 626983, now()),
  ('cranberry', 'ah cranberries', 164756, now()),
  ('chicken wings', 'ah scharrel kippenvleugels', 531859, now()),
  ('witte rijstnoedel', 'ah rijstnoedels 5mm', 627342, now()),
  ('thaise rijstnoedel', 'ah rijstnoedels 5mm', 627342, now()),
  ('volkoren tortilla', 'ah tortilla volkoren wraps', 582864, now()),
  ('witte balsamico azijn', 'mazzetti condimento bianco', 227196, now()),
  ('cantuccini koekje', 'sapori cantuccini almond', 605641, now()),
  ('bevroren zomerfruit', 'ah doosje met zomerfruit', 170001, now()),
  ('griekse pitabroodje', 'ah pita broodjes', 221858, now()),
  ('ingelegde gember', 'saitaku sushi ginger', 166952, now()),
  ('oreo koekjes met chocolade', 'oreo original', 165965, now()),
  ('broccoliroosje', 'ah broccoliroosjes', 226367, now()),
  ('beenham', 'ah ovenschotel beenham naturel', 418194, now()),
  ('orecchiette', 'de cecco orecchiette', 450222, now()),
  ('comte', 'ah excellent comté stuk', 444965, now()),
  ('maispolenta', 'smaakt polenta', 227849, now()),
  ('gerookte kip', 'ah gerookte kipfilet', 171483, now())
on conflict (ingredient_key) do nothing;

insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (1035, 200, 'g'),
  (46865, 400, 'g'),
  (107669, 75, 'g'),
  (129869, 1500, 'g'),
  (164756, 250, 'g'),
  (165583, 250, 'g'),
  (165965, 154, 'g'),
  (166952, 190, 'g'),
  (170001, 250, 'g'),
  (170654, 190, 'g'),
  (170655, 190, 'g'),
  (171483, 100, 'g'),
  (182796, 150, 'ml'),
  (188932, 225, 'g'),
  (189682, 295, 'g'),
  (203822, 95, 'g'),
  (203823, 150, 'g'),
  (221858, 10, 'stuks'),
  (226367, 450, 'g'),
  (227196, 250, 'ml'),
  (227849, 400, 'g'),
  (314377, 25, 'g'),
  (379923, 400, 'g'),
  (418194, 550, 'g'),
  (444965, 200, 'g'),
  (450222, 500, 'g'),
  (480034, 135, 'g'),
  (516869, 215, 'ml'),
  (525265, 125, 'g'),
  (525365, 275, 'g'),
  (531859, 530, 'g'),
  (553348, 355, 'ml'),
  (569985, 1000, 'g'),
  (575257, 500, 'g'),
  (582546, 250, 'g'),
  (582864, 320, 'g'),
  (582887, 250, 'g'),
  (591788, 270, 'g'),
  (595367, 400, 'g'),
  (605641, 175, 'g'),
  (610759, 200, 'g'),
  (611643, 20, 'g'),
  (626983, 200, 'g'),
  (627342, 200, 'g'),
  (628150, 250, 'g')
on conflict (product_id) do nothing;

insert into ah_prijs (product_id, prijs, peildatum)
values
  (1035, 1.59, '2026-11-05'),
  (46865, 0.89, '2026-11-05'),
  (107669, 1.79, '2026-11-05'),
  (129869, 2.99, '2026-11-05'),
  (164756, 2.29, '2026-11-05'),
  (165583, 2.99, '2026-11-05'),
  (165965, 1.19, '2026-11-05'),
  (166952, 3.99, '2026-11-05'),
  (170001, 2.19, '2026-11-05'),
  (170654, 1.29, '2026-11-05'),
  (170655, 1.15, '2026-11-05'),
  (171483, 3.14, '2026-11-05'),
  (182796, 4.49, '2026-11-05'),
  (188932, 3.49, '2026-11-05'),
  (189682, 2.25, '2026-11-05'),
  (203822, 3.79, '2026-11-05'),
  (203823, 3.59, '2026-11-05'),
  (221858, 0.79, '2026-11-05'),
  (226367, 1.49, '2026-11-05'),
  (227196, 2.99, '2026-11-05'),
  (227849, 2.42, '2026-11-05'),
  (314377, 1.05, '2026-11-05'),
  (379923, 2.59, '2026-11-05'),
  (418194, 7.99, '2026-11-05'),
  (444965, 6.69, '2026-11-05'),
  (450222, 2.79, '2026-11-05'),
  (480034, 3.19, '2026-11-05'),
  (516869, 2.99, '2026-11-05'),
  (525265, 2.06, '2026-11-05'),
  (525365, 2.39, '2026-11-05'),
  (531859, 3.65, '2026-11-05'),
  (553348, 5.39, '2026-11-05'),
  (569985, 1.45, '2026-11-05'),
  (575257, 3.19, '2026-11-05'),
  (582546, 2.69, '2026-11-05'),
  (582864, 0.94, '2026-11-05'),
  (582887, 2.75, '2026-11-05'),
  (591788, 3.89, '2026-11-05'),
  (595367, 1.45, '2026-11-05'),
  (605641, 3.19, '2026-11-05'),
  (610759, 2.79, '2026-11-05'),
  (611643, 1.29, '2026-11-05'),
  (626983, 13.99, '2026-11-05'),
  (627342, 1.99, '2026-11-05'),
  (628150, 1.79, '2026-11-05')
on conflict (product_id) do nothing;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, laatst_geverifieerd)
values
  ('lange vinger', 'Jumbo Lange Vingers 200 g', '675679PAK', now()),
  ('dille', 'Jumbo Dille 25 g', '779291ZK', now()),
  ('cottage cheese light', 'Jumbo Cottage Cheese Light 200 g', '779590CUP', now()),
  ('surinaamse sambal', 'Koningsvogel Surinaamse Sambal 270 g', '696482POT', now()),
  ('fijne havermout', 'Jumbo Havermout Fijne Vlokken Volkoren 500 g', '676476TAS', now()),
  ('groene pesto', 'Jumbo Groene Pesto 100 g', '393186CUP', now()),
  ('gerookte kipfilet', 'Jumbo Gerookte Kipfilet ca. 165 g', '700195KGR', now()),
  ('gezouten cashewnoten', 'Jumbo Gezouten Cashewnoten 130 g', '578021CUP', now()),
  ('cranberry', 'Jumbo Vriesverse Cranberry''s 250 g', '605585DS', now()),
  ('volkoren tortilla', 'Jumbo Large Tortilla Volkoren 6 Stuks', '779112ZK', now()),
  ('beenham', 'Jumbo Beenham Naturel ca. 510 g', '589509KGR', now()),
  ('orecchiette', 'Rummo Orecchiette 87 500 g', '338569STK', now()),
  ('comte', 'JuraFlore Comté ca. 190 g', '715824KGR', now())
on conflict (ingredient_key) do nothing;

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('675679PAK', 200, 'g'),
  ('779291ZK', 25, 'g'),
  ('779590CUP', 200, 'g'),
  ('696482POT', 270, 'g'),
  ('676476TAS', 500, 'g'),
  ('393186CUP', 100, 'g'),
  ('700195KGR', 165, 'g'),
  ('578021CUP', 130, 'g'),
  ('605585DS', 250, 'g'),
  ('779112ZK', 6, 'stuks'),
  ('589509KGR', 510, 'g'),
  ('338569STK', 500, 'g'),
  ('715824KGR', 190, 'g')
on conflict (sku) do nothing;

insert into jumbo_prijs (sku, prijs, peildatum)
values
  ('675679PAK', 1.59, '2026-11-05'),
  ('779291ZK', 0.89, '2026-11-05'),
  ('779590CUP', 0.85, '2026-11-05'),
  ('696482POT', 3.89, '2026-11-05'),
  ('676476TAS', 0.75, '2026-11-05'),
  ('393186CUP', 2.09, '2026-11-05'),
  ('700195KGR', 3.28, '2026-11-05'),
  ('578021CUP', 2.99, '2026-11-05'),
  ('605585DS', 1.99, '2026-11-05'),
  ('779112ZK', 0.95, '2026-11-05'),
  ('589509KGR', 7.41, '2026-11-05'),
  ('338569STK', 2.99, '2026-11-05'),
  ('715824KGR', 5.22, '2026-11-05')
on conflict (sku) do nothing;

-- Dezelfde koppeling onder een andere schrijfwijze: de bijvoeglijke naamwoorden
-- veranderen het product niet ("zoute sojasaus" is sojasaus).
with alias (nieuw, bron) as (
  values
    ('langkorrelige witte rijst', 'witte rijst'),
    ('zoute sojasaus', 'sojasaus'),
    ('gezeefde poedersuiker', 'poedersuiker'),
    ('carpaccio vlee', 'carpaccio'),
    ('nieuwe aardappelen', 'aardappelen'),
    ('cherry trostomaten', 'cherrytomaten'),
    ('knapperig stokbrood', 'stokbrood'),
    ('zure appel', 'appel'),
    ('gemengde tomaten', 'tomaten'),
    ('zachtgekookte eieren', 'eieren')
)
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, huismerk_product_id, laatst_geverifieerd)
select a.nieuw, c.weergavenaam, c.standaard_product_id, c.bio_product_id, c.huismerk_product_id, now()
from alias a join ah_product_cache c on c.ingredient_key = a.bron
on conflict (ingredient_key) do nothing;

with alias (nieuw, bron) as (
  values
    ('langkorrelige witte rijst', 'witte rijst'),
    ('zoute sojasaus', 'sojasaus'),
    ('gezeefde poedersuiker', 'poedersuiker'),
    ('carpaccio vlee', 'carpaccio'),
    ('nieuwe aardappelen', 'aardappelen'),
    ('cherry trostomaten', 'cherrytomaten'),
    ('knapperig stokbrood', 'stokbrood'),
    ('zure appel', 'appel'),
    ('gemengde tomaten', 'tomaten'),
    ('zachtgekookte eieren', 'eieren')
)
insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku, huismerk_sku, laatst_geverifieerd)
select a.nieuw, c.weergavenaam, c.standaard_sku, c.bio_sku, c.huismerk_sku, now()
from alias a join jumbo_product_cache c on c.ingredient_key = a.bron
on conflict (ingredient_key) do nothing;
