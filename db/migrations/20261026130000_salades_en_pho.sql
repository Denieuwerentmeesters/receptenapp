-- Zeven salades en gerechten van delicious. magazine en de pho van Miljuschka in
-- de gedeelde pool.
--
-- Zelfde vorm als 20260929180000_hollandse_klassiekers.sql: user_id null,
-- bron_type 'scraper', deel_status 'goedgekeurd', bron-URL erbij. Titel en
-- bereiding zijn eigen woorden; de ingrediënten komen van de bron.
-- Afwijking: de Vietnamese noedelsalade verwijst voor de dressing naar een
-- kookboek; de dressing (vissaus, limoen, suiker, chili, knoflook) en de
-- lente-ui-olie zijn een standaarduitwerking.
--
-- Een foto krijgen ze vanzelf van de nachtelijke cron (api/afbeeldingen.ts).
-- Idempotent op url.

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Oosterse salade met kibbeling en rijstnoedels', 'Oosterse salade met kibbeling en rijstnoedels', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/oosterse-kibbelingsalade/', 4, 25, 'Aziatisch',
  array['salade', 'vis', 'kibbeling', 'noedels', 'snel']::text[],
  '[{"hoeveelheid": "200", "eenheid": "g", "naam": "spitskool (gesneden)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "rode ui"}, {"hoeveelheid": "150", "eenheid": "g", "naam": "wortel (julienne, 1 zakje)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "komkommer"}, {"hoeveelheid": "0.5", "eenheid": null, "naam": "bosje radijs"}, {"hoeveelheid": "5", "eenheid": "el", "naam": "zoete chilisaus"}, {"hoeveelheid": "4", "eenheid": "el", "naam": "lichte sojasaus"}, {"hoeveelheid": "3", "eenheid": "el", "naam": "witte wijnazijn"}, {"hoeveelheid": "2", "eenheid": "el", "naam": "neutrale olie of sesamolie"}, {"hoeveelheid": "200", "eenheid": "g", "naam": "rijstnoedels"}, {"hoeveelheid": "500", "eenheid": "g", "naam": "kibbeling (kant-en-klaar van de visboer)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "bos koriander (grof gehakt)"}, {"hoeveelheid": null, "eenheid": null, "naam": "zout"}]'::jsonb,
  array['Snijd de spitskool in ultradunne reepjes en de rode ui in dunne halve ringen. Bestrooi met een snuf zout en masseer ongeveer 3 minuten met je handen. Meng de wortel erdoor. Snijd komkommer en radijs in dunne plakjes en meng ze erdoor.', 'Klop de zoete chilisaus met de sojasaus, de azijn en de olie tot een dressing.', 'Kook de rijstnoedels volgens de verpakking en spoel ze koud af. Meng ze door de groenten met tweederde van de dressing.', 'Warm de kibbeling zo nodig kort op in een koekenpan, leg hem op de salade en schenk de rest van de dressing erover. Strooi royaal gehakte koriander erover.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/oosterse-kibbelingsalade/' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Pastasalade met kikkererwten, ''nduja en garnalen', 'Pastasalade met kikkererwten, ''nduja en garnalen', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/pastasalade-met-kikkererwten-nduja-garnalen/', 4, 25, 'Italiaans',
  array['pasta', 'salade', 'garnalen', 'kikkererwten', 'snel']::text[],
  '[{"hoeveelheid": "350", "eenheid": "g", "naam": "ditalini of tubetti"}, {"hoeveelheid": "4", "eenheid": "el", "naam": "extra vierge olijfolie"}, {"hoeveelheid": "300", "eenheid": "g", "naam": "rauwe gepelde garnalen (grote, fijngesneden)"}, {"hoeveelheid": "70", "eenheid": "g", "naam": "''nduja (smeerbare salami)"}, {"hoeveelheid": "2", "eenheid": "tl", "naam": "vloeibare honing"}, {"hoeveelheid": "2", "eenheid": "tl", "naam": "sherryazijn"}, {"hoeveelheid": "250", "eenheid": "g", "naam": "kikkererwten (1 blik, uitgelekt en afgespoeld)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "kleine venkel (in flinterdunne reepjes)"}, {"hoeveelheid": null, "eenheid": null, "naam": "veldsla of spinazieblaadjes en dille (om te garneren)"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper en zout"}]'::jsonb,
  array['Kook de pasta beetgaar, giet af en spoel koud.', 'Bak de garnalen 2 tot 3 minuten gaar in 1 el olie op hoog vuur en schep ze in een kom.', 'Verhit de rest van de olie en bak de ''nduja ongeveer 2 minuten, terwijl je hem met een lepel opbreekt. Schep hem in een grote kom en meng met de honing en de azijn. Breng op smaak met zout en peper en schep de pasta en kikkererwten erdoor.', 'Schep de salade op een schaal en verdeel de venkel en garnalen erover. Garneer met veldsla en dille.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/pastasalade-met-kikkererwten-nduja-garnalen/' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Orzosalade met romanesco en radijsbladpesto', 'Orzosalade met romanesco en radijsbladpesto', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/orzosalade-met-romanesco-en-radijsbladpesto-2/', 4, 25, 'Italiaans',
  array['pasta', 'salade', 'orzo', 'geitenkaas']::text[],
  '[{"hoeveelheid": "250", "eenheid": "g", "naam": "orzo"}, {"hoeveelheid": "300", "eenheid": "g", "naam": "romanescoroosjes"}, {"hoeveelheid": "1", "eenheid": null, "naam": "bos radijsjes (met blad)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "teen knoflook"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "pijnboompitten"}, {"hoeveelheid": "6", "eenheid": "el", "naam": "extra vierge olijfolie"}, {"hoeveelheid": "3", "eenheid": "el", "naam": "parmezaanse kaas (geraspt)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "kleine rode ui (in halve ringen)"}, {"hoeveelheid": "50", "eenheid": "g", "naam": "zwarte olijven (in ringetjes)"}, {"hoeveelheid": "175", "eenheid": "g", "naam": "geitenkaas (in stukjes)"}, {"hoeveelheid": "2", "eenheid": "el", "naam": "verse oreganoblaadjes"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper en zout"}]'::jsonb,
  array['Kook de orzo volgens de verpakking en kook de romanescoroosjes in 5 tot 6 minuten beetgaar.', 'Snijd het blad van de radijsjes en de radijsjes zelf in dunne plakjes.', 'Pureer het radijsblad met de knoflook, pijnboompitten en olijfolie tot pesto en roer de parmezaan en wat peper erdoor.', 'Giet de orzo en romanesco af, spoel snel koud en laat goed uitlekken. Schep de pesto door de orzo en meng de romanesco, radijs, ui, olijven en geitenkaas erdoor. Breng op smaak, schep op een schaal en bestrooi met oregano.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/orzosalade-met-romanesco-en-radijsbladpesto-2/' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Pastasalade met gegrilde perzik en blauwe kaas', 'Pastasalade met gegrilde perzik en blauwe kaas', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/pastasalade-met-gegrilde-perziken/', 4, 30, 'Mediterraans',
  array['vegetarisch', 'pasta', 'salade', 'perzik', 'zomer']::text[],
  '[{"hoeveelheid": "375", "eenheid": "g", "naam": "speltpasta (fusilli)"}, {"hoeveelheid": "4", "eenheid": null, "naam": "perziken (gehalveerd en ontpit)"}, {"hoeveelheid": "2", "eenheid": "tl", "naam": "milde olijfolie"}, {"hoeveelheid": "0.5", "eenheid": null, "naam": "citroen (het sap)"}, {"hoeveelheid": "100", "eenheid": "g", "naam": "Siciliaanse olijven (gemarineerd, ontpit, 3 el olie uit het potje opvangen)"}, {"hoeveelheid": "120", "eenheid": "g", "naam": "stevige blauwe kaas (in dunne plakjes)"}, {"hoeveelheid": "50", "eenheid": "g", "naam": "amandelschaafsel"}, {"hoeveelheid": null, "eenheid": null, "naam": "bladpeterselie (om te garneren)"}]'::jsonb,
  array['Kook de pasta beetgaar in licht gezouten water en giet af.', 'Bestrijk de perzikhelften met de olie en gril ze op de barbecue of in een hete grillpan ongeveer 2 minuten per kant. Laat iets afkoelen en halveer ze.', 'Schep de pasta met de perziken, het citroensap, de olijven met hun olie, de blauwe kaas en de amandelen om in een schaal. Serveer warm of koud met peterselie.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/pastasalade-met-gegrilde-perziken/' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Salade van pompoen, freekeh en halloumi met pittige honingdressing', 'Salade van pompoen, freekeh en halloumi met pittige honingdressing', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/pompoen-freekehsalade-met-pittige-honingdressing/', 6, 65, 'Mediterraans',
  array['vegetarisch', 'salade', 'pompoen', 'halloumi', 'herfst']::text[],
  '[{"hoeveelheid": "1", "eenheid": null, "naam": "kabocha- of oranje pompoen (zonder zaden, in parten)"}, {"hoeveelheid": "2.5", "eenheid": "el", "naam": "olijfolie met citroen"}, {"hoeveelheid": "1", "eenheid": "tl", "naam": "gemalen komijn"}, {"hoeveelheid": "1", "eenheid": "tl", "naam": "gemalen koriander"}, {"hoeveelheid": "1", "eenheid": "tl", "naam": "gemalen venkel"}, {"hoeveelheid": "110", "eenheid": "g", "naam": "freekeh"}, {"hoeveelheid": "450", "eenheid": "g", "naam": "halloumi (uitgelekt, in dikke plakken)"}, {"hoeveelheid": "30", "eenheid": "g", "naam": "waterkers"}, {"hoeveelheid": "0.25", "eenheid": null, "naam": "radicchio (bladeren losgehaald)"}, {"hoeveelheid": "2", "eenheid": "el", "naam": "geroosterde pompoenpitten"}, {"hoeveelheid": "5", "eenheid": "el", "naam": "extra vierge olijfolie"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "citroensap"}, {"hoeveelheid": "3", "eenheid": null, "naam": "teentjes knoflook (geperst)"}, {"hoeveelheid": "2", "eenheid": "el", "naam": "vloeibare honing"}, {"hoeveelheid": "2", "eenheid": "tl", "naam": "dijonmosterd"}, {"hoeveelheid": "2", "eenheid": "tl", "naam": "Aleppo-peper (of 1 tl chilivlokken)"}, {"hoeveelheid": "1", "eenheid": "tl", "naam": "gerookt paprikapoeder"}, {"hoeveelheid": null, "eenheid": null, "naam": "peper en zout"}]'::jsonb,
  array['Verwarm de oven voor op 180 °C. Schep de pompoenparten om met de citroenolie, komijn, koriander, venkel, peper en zout, leg ze op een bakplaat met bakpapier en rooster ze 40 tot 45 minuten goudbruin en gaar.', 'Kook de freekeh volgens de verpakking in goed gezouten water, spoel koud en laat uitlekken.', 'Klop alle ingrediënten voor de dressing door elkaar en laat op kamertemperatuur staan.', 'Bak de halloumi in een droge koekenpan op hoog vuur 1 tot 2 minuten per kant goudbruin.', 'Meng de waterkers, freekeh, radicchio en de helft van de pompoenpitten met de halloumi en de helft van de dressing. Breng op smaak.', 'Leg de pompoen op een schaal, verdeel het freekehmengsel en de rest van de pitten erover en schenk de overige dressing erover.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/pompoen-freekehsalade-met-pittige-honingdressing/' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Geroosterde knolselderij, venkel en clementine met amandelaioli', 'Geroosterde knolselderij, venkel en clementine met amandelaioli', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/geroosterde-knolselderij-venkel-en-clementine-met-amandelaioli-2/', 4, 65, 'anders',
  array['vegetarisch', 'winter', 'knolselderij', 'venkel', 'oven']::text[],
  '[{"hoeveelheid": "600", "eenheid": "g", "naam": "knolselderij"}, {"hoeveelheid": null, "eenheid": null, "naam": "boter of olijfolie (om in te bakken)"}, {"hoeveelheid": "2", "eenheid": null, "naam": "venkelknollen (in partjes van 1 cm)"}, {"hoeveelheid": "2", "eenheid": null, "naam": "clementines (ongeschild, gehalveerd)"}, {"hoeveelheid": null, "eenheid": null, "naam": "chilivlokken (flinke snuf)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "biologische citroen (rasp)"}, {"hoeveelheid": "150", "eenheid": "g", "naam": "geblancheerde amandelen"}, {"hoeveelheid": "1", "eenheid": null, "naam": "citroen"}, {"hoeveelheid": "60", "eenheid": "ml", "naam": "extra vierge olijfolie"}, {"hoeveelheid": "1", "eenheid": "tl", "naam": "dijonmosterd"}, {"hoeveelheid": "1", "eenheid": null, "naam": "teentje knoflook"}, {"hoeveelheid": null, "eenheid": null, "naam": "zeezoutvlokken en peper"}]'::jsonb,
  array['Week 100 g van de amandelen minstens 30 minuten, liefst een nacht, in 125 ml koud water. Verwarm de oven voor op 220 °C.', 'Schil de knolselderij royaal en snijd hem in onregelmatige blokjes van ongeveer 2 cm. Rooster de overige amandelen 8 minuten in de oven tot ze donkergoudbruin zijn (let op, ze verbranden snel) en laat afkoelen.', 'Maak de aioli: blend de geweekte amandelen met 125 ml vers water, het sap van een halve citroen, de olie en de mosterd op hoge snelheid tot een gladde pasta. Voeg de knoflook en de geroosterde amandelen toe en blend opnieuw glad. Breng op smaak met zout, peper en zo nodig meer citroen of olie.', 'Bak de knolselderij met een flinke klont boter, goed gekruid, in een grote pan aan alle kanten bruin en leg hem op een bakplaat. Bak de venkel op dezelfde manier bruin.', 'Bak de clementines 5 minuten met de snijkant omlaag tot ze geblakerd zijn. Leg ze met de venkel op de bakplaat en bestrooi met chilivlokken en citroenrasp.', 'Zet alles 10 minuten in de oven tot de groenten gaar en geblakerd zijn. Haal de clementinepartjes uit de schil, verdeel ze over de groenten en serveer met flink wat aioli.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/geroosterde-knolselderij-venkel-en-clementine-met-amandelaioli-2/' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Vietnamese noedelsalade met kruiden, wortel en pinda''s', 'Vietnamese noedelsalade met kruiden, wortel en pinda''s', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/noedelsalade-goi-bun-uit-de-bijbel-van-de-vietnamese-keuken/', 4, 30, 'Aziatisch',
  array['salade', 'noedels', 'Vietnamees']::text[],
  '[{"hoeveelheid": "350", "eenheid": "g", "naam": "rijstvermicelli"}, {"hoeveelheid": "75", "eenheid": "ml", "naam": "neutrale olie (om warm over de lente-ui te gieten)"}, {"hoeveelheid": "3", "eenheid": null, "naam": "lente-uien (fijngesneden)"}, {"hoeveelheid": "4", "eenheid": "el", "naam": "vissaus"}, {"hoeveelheid": "3", "eenheid": "el", "naam": "limoensap"}, {"hoeveelheid": "2", "eenheid": "el", "naam": "suiker"}, {"hoeveelheid": "100", "eenheid": "ml", "naam": "water"}, {"hoeveelheid": "1", "eenheid": null, "naam": "rode chilipeper (fijngesneden)"}, {"hoeveelheid": "1", "eenheid": null, "naam": "teentje knoflook (fijngehakt)"}, {"hoeveelheid": "5", "eenheid": "el", "naam": "ongezouten geroosterde pinda''s (grof gehakt)"}, {"hoeveelheid": "8", "eenheid": null, "naam": "takjes munt"}, {"hoeveelheid": "50", "eenheid": "g", "naam": "Thaise basilicum (blaadjes, grof gesneden)"}, {"hoeveelheid": "50", "eenheid": "g", "naam": "koriander"}, {"hoeveelheid": "1", "eenheid": null, "naam": "komkommer (in dunne plakjes of reepjes)"}, {"hoeveelheid": "300", "eenheid": "g", "naam": "wortel (in fijne reepjes)"}, {"hoeveelheid": "200", "eenheid": "g", "naam": "taugé"}, {"hoeveelheid": "1", "eenheid": null, "naam": "krop botersla of lollo (in losse bladeren)"}]'::jsonb,
  array['Kook de rijstvermicelli beetgaar volgens de verpakking, giet af en laat goed uitlekken.', 'Maak de lente-ui-olie: verhit de olie en giet hem over de fijngesneden lente-ui. Roer vissaus, limoensap, suiker, water, chili en knoflook door elkaar tot een dressing.', 'Meng in een grote kom de noedels met de lente-ui-olie, de dressing en de kruiden, komkommer, wortel, taugé en sla.', 'Verdeel over een schaal, garneer met de pinda''s en serveer direct.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/noedelsalade-goi-bun-uit-de-bijbel-van-de-vietnamese-keuken/' and user_id is null);

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Vietnamese pho met rundvlees en rijstnoedels', 'Vietnamese pho met rundvlees en rijstnoedels', 'Miljuschka', 'https://miljuschka.nl/vietnamese-pho-soep-met-rundvlees-en-rijstnoedels/', 6, 340, 'Aziatisch',
  array['soep', 'rundvlees', 'noedels', 'Vietnamees', 'weekendproject']::text[],
  '[{"hoeveelheid": "3", "eenheid": "kg", "naam": "kalfsbotten en ossenstaart of schenkel"}, {"hoeveelheid": "2", "eenheid": null, "naam": "uien"}, {"hoeveelheid": "1", "eenheid": null, "naam": "bol knoflook"}, {"hoeveelheid": "200", "eenheid": "g", "naam": "gember"}, {"hoeveelheid": "2", "eenheid": null, "naam": "stengels citroengras"}, {"hoeveelheid": "3", "eenheid": null, "naam": "steranijs"}, {"hoeveelheid": "2", "eenheid": null, "naam": "kaneelstokjes"}, {"hoeveelheid": "3", "eenheid": null, "naam": "kardemompeulen"}, {"hoeveelheid": "3", "eenheid": null, "naam": "kruidnagels"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "korianderzaad"}, {"hoeveelheid": "50", "eenheid": "ml", "naam": "vissaus"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "suiker of zoete ketjap"}, {"hoeveelheid": "2", "eenheid": "tl", "naam": "zout"}, {"hoeveelheid": null, "eenheid": null, "naam": "zwarte peper"}, {"hoeveelheid": "400", "eenheid": "g", "naam": "steak of ossenhaas"}, {"hoeveelheid": "4", "eenheid": null, "naam": "lente-uien"}, {"hoeveelheid": "2", "eenheid": null, "naam": "chilipepers"}, {"hoeveelheid": "2", "eenheid": null, "naam": "limoenen"}, {"hoeveelheid": "450", "eenheid": "g", "naam": "platte rijstnoedels"}, {"hoeveelheid": "150", "eenheid": "g", "naam": "taugé"}, {"hoeveelheid": null, "eenheid": null, "naam": "gemengde verse kruiden (koriander, lange koriander, Thaise basilicum)"}]'::jsonb,
  array['Zet de botten en de ossenstaart in een grote pan onder koud water, breng aan de kook en kook ongeveer 10 minuten tot er schuim komt. Giet af, spoel botten en vlees schoon en spoel ook de pan om.', 'Halveer de uien en de bol knoflook en schroei ze met de gember ongeveer 15 minuten boven een gasvlam of onder de grill tot ze goed zwart zijn. Schraap het zwartste deel er gedeeltelijk af.', 'Kneus het citroengras en vouw het dubbel. Doe botten en vlees terug in de pan met het citroengras, de ui, knoflook, gember en specerijen en schenk er 3 liter water bij. Breng aan de kook en laat op laag vuur ongeveer 5 uur heel zachtjes trekken, met af en toe afschuimen.', 'Breng de bouillon op smaak met de vissaus, suiker of ketjap, zout en peper. Pluk het vlees van de ossenstaart en bewaar het.', 'Snijd de steak in dunne plakjes, de lente-ui in ringen, de chilipepers fijn (zonder zaadlijsten) en de limoenen in partjes.', 'Kook de noedels volgens de verpakking en verdeel ze over kommen. Schenk de hete bouillon erover en leg het ossenstaartvlees, de biefstukplakjes en de chili erop. Serveer met lente-ui, taugé, limoen en kruiden.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://miljuschka.nl/vietnamese-pho-soep-met-rundvlees-en-rijstnoedels/' and user_id is null);
