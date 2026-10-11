-- Nazorg na de leverbaarheidscheck van 10 oktober 2026 (scripts/ah_verpakkingen.py).
--
-- AH haalt producten uit het assortiment en geeft ze soms een nieuw nummer.
-- Zo'n nummer in de mapping valt stilletjes uit het mandje: ah.nl voegt het
-- niet toe en meldt niets. Van de 794 gemapte nummers waren er 30 niet
-- (meer) bestelbaar, waaronder bloemkool (4165 bestaat niet meer, nu 4183),
-- gele paprika en de kipdijfilet van "kippendijen of bot".
--
-- 1. Standaardnummers vervangen door het product dat AH er nu voor heeft.
--    Gele paprika verkoopt AH online niet meer los (alleen in de mix van
--    drie); die wordt een rode paprika, in een recept maakt de kleur niet
--    uit. Roma tomaten zijn alleen nog in de winkel: dan gewone tomaten.
-- 2. Wat AH niet meer heeft (nectarines, perziken, varkensnek, gamba's
--    gekookt, rauwe bieten) gaat op null: een zoeklink, en rood op de lijst.
--    Beter zichtbaar dan stilletjes weg.
-- 3. Bio-varianten die weg zijn gaan op null, dan valt kiesVariant terug op
--    de standaard. Een bio-nummer dat niet bestaat trekt anders ook de
--    standaard mee het mandje uit.
-- 4. Nieuwe regels uit de screenshot van 10 oktober: gele courgette (is een
--    courgette), gerookte spek (de spekreepjes), kant-en-klare noedels (de
--    verse udon van Mai Wa, keuze van Reinoud). Ook bij Jumbo.
-- 5. Verpakkingen voor de nieuwe nummers, uit de AH-API.
--
-- Achterwaarts veilig: alleen andere nummers en nieuwe rijen.

-- 1. Vervangen (oud → nieuw), op nummer zodat elke sleutel meegaat.
update ah_product_cache set standaard_product_id = v.nieuw, laatst_geverifieerd = now()
from (values
  (4165,   4183),    -- AH Bloemkool per stuk
  (31584,  627079),  -- AH Ciabatta 300 g
  (67874,  4088),    -- roma tomaten → AH Tomaten 500 g (roma alleen in de winkel)
  (197231, 626382),  -- AH Scharrel kipdijfilet 530 g
  (368705, 4117),    -- gele paprika → AH Paprika rood (geel online uit assortiment)
  (396952, 203861),  -- AH Frambozen 225 g
  (416489, 212148),  -- AH Bramen 150 g
  (465768, 216494),  -- Heinz Tomato ketchup 400 ml
  (483924, 3996),    -- AH Greenfields Runder sukadelappen ca. 700 g
  (505699, 100232),  -- AH Pitloze rode druiven 500 g
  (518874, 589859),  -- Mill & Mortar Sumak poeder 50 g
  (577882, 170004),  -- AH Doosje met kersen 250 g
  (581458, 498340),  -- AH Flatbread 210 g
  (587278, 564897),  -- AH Terra Biologische tofu 325 g (stevige tofu)
  (587622, 510686),  -- Molensteen Havermeel 500 g
  (603444, 436917),  -- AH Kipgehakt naturel 300 g
  (605189, 199922),  -- AH Excellent Biologische kalamata olijf zonder pit 240 g
  (606845, 490540)   -- AH Kroepoek naturel 100 g
) as v (oud, nieuw)
where ah_product_cache.standaard_product_id = v.oud;

-- 2. Niet meer te koop, geen vervanger: zoeklink.
update ah_product_cache set standaard_product_id = null, laatst_geverifieerd = now()
where standaard_product_id in (
  100860,  -- AH Nectarines schaal (seizoen)
  203002,  -- AH Biologisch Rode bieten los (rauwe bietjes)
  484404,  -- AH Gamba's gekookt & ongepeld
  504988,  -- AH Perziken (seizoen)
  574775   -- AH Vakslager Varkensnek
);

-- 3. Bio-varianten.
update ah_product_cache set bio_product_id = 186629, laatst_geverifieerd = now()
where bio_product_id = 185203;  -- AH Biologisch Bloemkool
update ah_product_cache set bio_product_id = 66113, laatst_geverifieerd = now()
where bio_product_id = 66112 and ingredient_key in ('doperwt', 'doperwten');  -- AH Biologisch Doperwten 350 g
update ah_product_cache set bio_product_id = null, laatst_geverifieerd = now()
where bio_product_id in (
  66112,   -- doperwten/wortelen stond ook bij witte asperge
  197308,  -- AH Biologisch Peterselie pot
  203002,  -- AH Biologisch Rode bieten los
  230802,  -- AH Biologisch Koriander pot
  508323,  -- groene thee citroengras (stond bij citroengras)
  600529,  -- AH Biologisch Rode druiven pitloos
  618391   -- AH Biologisch Nectarines
);

-- 4. Nieuwe regels.
insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('gele courgette',       'ah courgette',                       4164,   185202, now()),
  ('gerookte spek',        'ah spekreepjes gerookt 250 g',       130250, 130257, now()),
  ('gerookt spek',         'ah spekreepjes gerookt 250 g',       130250, 130257, now()),
  ('kant en klare noedel', 'mai wa instant japanese fresh udon', 588044, null,   now()),
  ('kant en klare noodle', 'mai wa instant japanese fresh udon', 588044, null,   now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('gele courgette',       'Jumbo Courgette',                   '302245STK', '707618STK'),
  ('gerookte spek',        'Jumbo Gerookte Spek Reepjes 250 g', '679081TRA', null),
  ('gerookt spek',         'Jumbo Gerookte Spek Reepjes 250 g', '679081TRA', null),
  ('kant en klare noedel', 'Jumbo Udon Noodles 300 g',          '411788STK', null),
  ('kant en klare noodle', 'Jumbo Udon Noodles 300 g',          '411788STK', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();

-- 5. Verpakkingen van de nieuwe nummers (AH-API, 10 oktober 2026).
insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (4183,   1,   'stuks'),
  (186629, 1,   'stuks'),
  (626382, 530, 'g'),
  (627079, 300, 'g'),
  (66113,  350, 'g'),
  (203861, 225, 'g'),
  (212148, 150, 'g'),
  (216494, 400, 'ml'),
  (100232, 500, 'g'),
  (589859, 50,  'g'),
  (170004, 250, 'g'),
  (498340, 210, 'g'),
  (564897, 325, 'g'),
  (510686, 500, 'g'),
  (436917, 300, 'g'),
  (199922, 240, 'g'),
  (490540, 100, 'g'),
  (3996,   700, 'g'),
  (588044, 200, 'g')
on conflict (product_id) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;
