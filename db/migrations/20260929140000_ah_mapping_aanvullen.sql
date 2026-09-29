-- AH-mapping aanvullen: gangbare ingrediënten die op een zoeklink uitkwamen.
--
-- Eén voor één op ah.nl opgezocht en op de productpagina nagekeken. Een deel is
-- een tweede sleutel voor een product dat al gemapt was (ei → eieren,
-- kerstomaten → cherrytomaten). Twijfelgevallen (pompoen, bruine suiker,
-- little gem, azijn) blijven een zoeklink.
--
-- Twee bestaande rijen stonden fout en zijn rechtgezet: 'kipdij' wees naar een
-- kant-en-klare döner (nu kipdijfilet), 'shiitake' naar gemarineerde
-- truffelshiitake (nu gewone shiitake).
-- Ook bijgewerkt in data/ah_mapping.json.

insert into ah_product_cache
  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('amandelmeel', 'molensteen amandelmeel', 420734, null, now()),
  ('bospeen', 'ah bospeen', 127590, null, now()),
  ('cacaopoeder', 'blooker cacaopoeder', 127402, null, now()),
  ('chiazaad', 'ah chiazaad', 492706, 470037, now()),
  ('doperwt', 'ah doperwten 0 zout', 492395, 66112, now()),
  ('ei', 'ah vrije uitloop eieren l', 30030, 168502, now()),
  ('filodeeg', 'easy bakery filo bladerdeeg', 66154, null, now()),
  ('gelatine', 'dr oetker bladgelatine helder', 526137, null, now()),
  ('gelatineblaadje', 'dr oetker bladgelatine helder', 526137, null, now()),
  ('gemberwortel', 'ah biologisch gember', 104818, 104818, now()),
  ('gist', 'dr oetker gist levure', 30228, null, now()),
  ('gruyere', 'ah zwitserse gruyere', 224073, null, now()),
  ('gruyere kaas', 'ah zwitserse gruyere', 224073, null, now()),
  ('hoisinsaus', 'lee kum kee hoisin saus', 232539, null, now()),
  ('italiaanse kruiden', 'ah italiaanse kruidenmix', 238967, null, now()),
  ('kaneelstokje', 'verstegen kaneel heel', 414963, null, now()),
  ('kerstomaat', 'ah cherrytomaten', 4137, 67739, now()),
  ('kerstomaten', 'ah cherrytomaten', 4137, 67739, now()),
  ('kipdij', 'ah scharrel kipdijfilet', 531848, 600464, now()),
  ('kippendij', 'ah scharrel kipdijfilet', 531848, 600464, now()),
  ('knoflookteen', 'ah knoflook', 4160, 185774, now()),
  ('kruimige aardappel', 'ah iets kruimige aardappel', 96049, 108672, now()),
  ('lasagnebladen', 'ah lasagne', 467978, null, now()),
  ('lasagnevel', 'ah lasagne', 467978, null, now()),
  ('lasagnevellen', 'ah lasagne', 467978, null, now()),
  ('paneermeel', 'ah paneermeel naturel broodkruim', 196776, null, now()),
  ('parmezaan', 'ah parmigiano reggiano', 163822, 238913, now()),
  ('pastinaak', 'ah biologisch pastinaak', 203003, 203003, now()),
  ('peultje', 'ah peulen', 504990, null, now()),
  ('poedersuiker', 'van gilse poedersuiker', 187619, null, now()),
  ('pure chocolade', 'ah reep puur', 523482, 196282, now()),
  ('ras el hanout', 'verstegen world spice blend ras el hanout', 518449, null, now()),
  ('rode chilipeper', 'ah rode peper', 387770, 104818, now()),
  ('runderbouillon', 'ah bouillon rund', 492037, null, now()),
  ('saffraan', 'verstegen saffraan heel', 414972, null, now()),
  ('sambal oelek', 'ah sambal oelek', 450146, null, now()),
  ('shiitake', 'ah biologisch shiitake', 525265, 525265, now()),
  ('snack komkommer', 'ah snoepgroente komkommer', 502305, null, now()),
  ('snackkomkommer', 'ah snoepgroente komkommer', 502305, null, now()),
  ('tortilla wraps', 'ah tortilla naturel wraps medium 8 stuks', 136836, null, now()),
  ('venkelknol', 'ah venkel', 226181, null, now()),
  ('venkelzaad', 'verstegen venkelzaad', 223827, null, now()),
  ('winterwortel', 'ah winterpeen', 4076, 561136, now()),
  ('witte basterdsuiker', 'van gilse witte basterdsuiker', 187620, null, now()),
  ('witte chocolade', 'ah reep witte chocolade', 435940, null, now()),
  ('zwarte peper', 'ah zwarte peper gemalen', 197974, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = now();
