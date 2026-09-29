-- Vijf recepten erbij in de gedeelde pool: vier Hollandse klassiekers en een
-- minestrone van delicious. magazine.
--
-- Zelfde vorm als de gescrapete pool (user_id null, bron_type 'scraper',
-- deel_status 'goedgekeurd'). Níét 'eigen_input': useMijnRecepten toont alles
-- wat geen 'scraper' is, dus dan zouden ze bij iedereen onder Mijn recepten staan.
--
-- De vier klassiekers hebben geen bron-URL; de bereiding is voor de app
-- geschreven. Bij de minestrone komen de ingrediënten van de bron en is de
-- bereiding in eigen woorden, net als bij de rest van de pool.
--
-- Een foto krijgen ze vanzelf: de nachtelijke cron (api/afbeeldingen.ts) pakt
-- alles zonder afbeelding_url op, hooguit 8 per run.
--
-- Idempotent: de klassiekers op titel, de minestrone op url.

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Boerenkoolstamppot met rookworst en jus', 'Boerenkoolstamppot met rookworst en jus', 'Receptenapp', null, 4, 45, 'Nederlands',
  array['stamppot', 'varkensvlees', 'winter', 'comfort food']::text[],
  '[{"hoeveelheid": "1500", "eenheid": "g", "naam": "kruimige aardappelen"}, {"hoeveelheid": "1000", "eenheid": "g", "naam": "boerenkool"}, {"hoeveelheid": "2", "eenheid": null, "naam": "rookworst"}, {"hoeveelheid": "125", "eenheid": "g", "naam": "spekblokjes"}, {"hoeveelheid": "150", "eenheid": "ml", "naam": "melk"}, {"hoeveelheid": "50", "eenheid": "g", "naam": "boter"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "mosterd"}, {"hoeveelheid": null, "eenheid": null, "naam": "nootmuskaat"}, {"hoeveelheid": "40", "eenheid": "g", "naam": "boter (voor de jus)"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "bloem"}, {"hoeveelheid": "1", "eenheid": null, "naam": "runderbouillonblokje"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper en zout"}]'::jsonb,
  array['Schil de aardappelen, snijd ze in gelijke stukken en zet ze in een grote pan net onder water. Breng aan de kook met een snuf zout.', 'Leg de boerenkool bovenop de aardappelen, doe het deksel erop en laat alles samen in ongeveer 20 minuten gaar koken. Druk de kool na een paar minuten wat aan zodra hij slinkt.', 'Verwarm intussen de rookworsten volgens de verpakking in een pan met heet water dat niet meer kookt, zodat het vel heel blijft.', 'Bak de spekblokjes zonder extra vet in een koekenpan knapperig en laat ze uitlekken op keukenpapier. Laat het uitgebakken vet in de pan.', 'Maak de jus: smelt de boter in de pan met het spekvet, roer de bloem erdoor en laat een minuutje bakken tot het goudbruin is. Schenk er al roerend 300 ml heet water bij, verkruimel het bouillonblokje erin en laat een paar minuten zachtjes doorkoken tot de jus iets gebonden is.', 'Giet de aardappelen en boerenkool goed af. Stamp ze fijn met de boter, de warme melk en de mosterd. Breng op smaak met nootmuskaat, peper en zout en schep de spekjes erdoor.', 'Snijd de rookworst in stukken en serveer de stamppot met een kuiltje jus in het midden.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where titel = 'Boerenkoolstamppot met rookworst en jus' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Zuurkoolstamppot met spekjes en rookworst', 'Zuurkoolstamppot met spekjes en rookworst', 'Receptenapp', null, 4, 40, 'Nederlands',
  array['stamppot', 'varkensvlees', 'winter', 'comfort food']::text[],
  '[{"hoeveelheid": "1250", "eenheid": "g", "naam": "kruimige aardappelen"}, {"hoeveelheid": "750", "eenheid": "g", "naam": "zuurkool"}, {"hoeveelheid": "200", "eenheid": "g", "naam": "spekblokjes"}, {"hoeveelheid": "1", "eenheid": null, "naam": "rookworst"}, {"hoeveelheid": "1", "eenheid": null, "naam": "ui"}, {"hoeveelheid": "2", "eenheid": null, "naam": "laurierblaadjes"}, {"hoeveelheid": "150", "eenheid": "ml", "naam": "melk"}, {"hoeveelheid": "30", "eenheid": "g", "naam": "boter"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "mosterd"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper en zout"}]'::jsonb,
  array['Schil de aardappelen, snijd ze in stukken en kook ze in ongeveer 20 minuten gaar in water met een snuf zout.', 'Zet de zuurkool met een bodem water (ongeveer 100 ml) en de laurierblaadjes op en laat hem met het deksel op de pan 20 minuten zachtjes stoven. Knijp de kool daarna goed uit en haal de laurier eruit. Hou je niet van erg zuur, spoel de zuurkool dan eerst even af.', 'Verwarm de rookworst in heet, niet kokend water.', 'Snipper de ui. Bak de spekblokjes in een koekenpan knapperig, voeg de ui toe en bak die in een paar minuten zacht en goudbruin.', 'Giet de aardappelen af en stamp ze met de warme melk, de boter en de mosterd tot een smeuïge puree.', 'Roer de zuurkool en het spek met de ui (en een scheut van het bakvet) door de puree en breng op smaak met peper. Serveer met plakken rookworst.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where titel = 'Zuurkoolstamppot met spekjes en rookworst' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Hutspot met klapstuk', 'Hutspot met klapstuk', 'Receptenapp', null, 4, 180, 'Nederlands',
  array['stamppot', 'rundvlees', 'winter', 'comfort food']::text[],
  '[{"hoeveelheid": "800", "eenheid": "g", "naam": "klapstuk"}, {"hoeveelheid": "1", "eenheid": null, "naam": "ui (voor het vlees)"}, {"hoeveelheid": "2", "eenheid": null, "naam": "laurierblaadjes"}, {"hoeveelheid": "4", "eenheid": null, "naam": "kruidnagels"}, {"hoeveelheid": "1", "eenheid": null, "naam": "runderbouillonblokje"}, {"hoeveelheid": "1000", "eenheid": "g", "naam": "kruimige aardappelen"}, {"hoeveelheid": "1000", "eenheid": "g", "naam": "winterwortel"}, {"hoeveelheid": "750", "eenheid": "g", "naam": "uien"}, {"hoeveelheid": "50", "eenheid": "g", "naam": "boter"}, {"hoeveelheid": "100", "eenheid": "ml", "naam": "melk"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper en zout"}]'::jsonb,
  array['Wrijf het klapstuk in met peper en zout. Zet het in een pan met zoveel water dat het net onder staat, samen met een gepelde ui waarin je de kruidnagels hebt geprikt, de laurier en het bouillonblokje.', 'Breng aan de kook, schep het schuim eraf en laat het vlees met het deksel op een kier 2,5 tot 3 uur heel zacht trekken tot het uit elkaar valt.', 'Schil de aardappelen en snijd ze in stukken. Schrap de winterwortel en snijd hem in blokjes. Pel de uien en snijd ze in parten.', 'Haal het vlees uit de pan en houd het warm onder aluminiumfolie. Zeef het kookvocht.', 'Kook de wortel met ongeveer een halve liter van het kookvocht 10 minuten, doe dan de aardappelen en de uien erbij en kook alles samen in 20 minuten gaar. Voeg zo nodig nog wat water toe.', 'Giet af en vang het vocht op. Stamp de groenten grof met de boter en de warme melk; wat stukjes mogen blijven. Maak de hutspot smeuïg met een scheutje kookvocht en breng op smaak met peper en zout.', 'Trek het klapstuk met twee vorken in draden of snijd het in plakken en serveer het bij de hutspot, met wat van het kookvocht als jus.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where titel = 'Hutspot met klapstuk' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Zeeuwse mosselen met frites', 'Zeeuwse mosselen met frites', 'Receptenapp', null, 4, 40, 'Nederlands',
  array['vis', 'mosselen', 'snel']::text[],
  '[{"hoeveelheid": "4", "eenheid": "kg", "naam": "mosselen"}, {"hoeveelheid": "2", "eenheid": null, "naam": "uien"}, {"hoeveelheid": "1", "eenheid": null, "naam": "prei"}, {"hoeveelheid": "2", "eenheid": "stengels", "naam": "bleekselderij"}, {"hoeveelheid": "1", "eenheid": null, "naam": "winterwortel"}, {"hoeveelheid": "2", "eenheid": "teentjes", "naam": "knoflook"}, {"hoeveelheid": "250", "eenheid": "ml", "naam": "droge witte wijn"}, {"hoeveelheid": "30", "eenheid": "g", "naam": "boter"}, {"hoeveelheid": "1", "eenheid": "bosje", "naam": "peterselie"}, {"hoeveelheid": "1000", "eenheid": "g", "naam": "friet (diepvries)"}, {"hoeveelheid": null, "eenheid": null, "naam": "mayonaise"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper"}]'::jsonb,
  array['Spoel de mosselen in een gootsteen met koud water. Gooi mosselen met een kapotte schelp weg, net als open exemplaren die na een tik tegen het aanrecht niet dichtgaan. Trek eventuele baardjes eraf.', 'Bak de frites in de oven of airfryer volgens de verpakking, zodat ze tegelijk met de mosselen klaar zijn.', 'Snipper de uien, snijd de prei in ringen, de bleekselderij in dunne boogjes en de wortel in dunne reepjes. Hak de knoflook fijn.', 'Smelt de boter in een grote, hoge pan en fruit de groenten met de knoflook in een paar minuten zacht, zonder dat ze kleuren.', 'Zet het vuur hoog, schenk de wijn erbij en voeg de mosselen toe. Doe het deksel erop en laat 5 tot 7 minuten stomen tot de schelpen open zijn. Schud de pan tussendoor een paar keer met het deksel erop, zodat de mosselen van onder naar boven gaan.', 'Strooi grof gehakte peterselie en versgemalen peper erover. Mosselen die dicht zijn gebleven gooi je weg.', 'Serveer de mosselen in de pan of in diepe kommen met het kookvocht, met frites en mayonaise ernaast.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where titel = 'Zeeuwse mosselen met frites' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
) values (
  'Minestrone met bonen, cavolo nero en saucijzen', 'Minestrone met bonen, cavolo nero en saucijzen', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/minestrone-met-bonen-cavolo-nero-en-saucijzen/', 6, 45, 'Italiaans',
  array['soep', 'varkensvlees', 'winter', 'comfort food']::text[],
  '[{"hoeveelheid": "3", "eenheid": "el", "naam": "olijfolie"}, {"hoeveelheid": "320", "eenheid": "g", "naam": "italiaanse saucijzen"}, {"hoeveelheid": "1", "eenheid": null, "naam": "ui"}, {"hoeveelheid": "1", "eenheid": "stengel", "naam": "bleekselderij"}, {"hoeveelheid": "1", "eenheid": null, "naam": "wortel"}, {"hoeveelheid": "2", "eenheid": "teentjes", "naam": "knoflook"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "rozemarijn"}, {"hoeveelheid": "180", "eenheid": "ml", "naam": "droge witte wijn"}, {"hoeveelheid": "1", "eenheid": "l", "naam": "kippenbouillon"}, {"hoeveelheid": "500", "eenheid": "ml", "naam": "passata"}, {"hoeveelheid": "400", "eenheid": "g", "naam": "cannellini bonen (1 blik)"}, {"hoeveelheid": "150", "eenheid": "g", "naam": "risottorijst"}, {"hoeveelheid": "300", "eenheid": "g", "naam": "cavolo nero"}, {"hoeveelheid": null, "eenheid": null, "naam": "pecorino"}, {"hoeveelheid": null, "eenheid": null, "naam": "basilicum"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper en zout"}]'::jsonb,
  array['Snipper de ui, snijd de bleekselderij in boogjes en de wortel in kleine stukjes. Pers de knoflook en hak de rozemarijn fijn. Haal het vel van de saucijzen.', 'Verhit de olie in een grote soeppan en bak het saucijzenvlees in ongeveer 5 minuten rul; prak het met een houten lepel in kleine stukjes.', 'Zet het vuur iets lager, doe de ui, bleekselderij, wortel, knoflook en rozemarijn erbij en laat 5 minuten zacht worden. Schep af en toe om.', 'Blus af met de wijn en laat die in een minuut of vijf tot de helft inkoken.', 'Spoel en laat de bonen uitlekken. Voeg de bouillon, passata, bonen en rijst toe met wat peper en zout. Breng aan de kook en laat de soep 20 minuten zachtjes koken; roer af en toe zodat de rijst niet aanzet.', 'Snijd de harde nerf uit de cavolo nero, scheur het blad in stukken en laat het de laatste 1 à 2 minuten in de soep slinken.', 'Schep de soep in kommen en maak af met geraspte pecorino en blaadjes basilicum.']::text[],
  'scraper', 'goedgekeurd', null
)
on conflict (url) where url is not null do nothing;

-- AH-mapping voor twee nieuwe ingrediënten, op ah.nl opgezocht. AH heeft alleen
-- biologische zuurkool, dus standaard en bio wijzen naar hetzelfde product.
-- Klapstuk en Italiaanse saucijzen verkoopt ah.nl niet los: die blijven een
-- zoeklink. Ook bijgewerkt in data/ah_mapping.json.

insert into ah_product_cache
  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('friet', 'ah extra krokante friet', 580674, null, now()),
  ('zuurkool', 'ah biologisch zuurkool naturel', 51774, 51774, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = now();
