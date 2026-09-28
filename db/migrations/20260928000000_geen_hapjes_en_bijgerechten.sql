-- Hapjes, voorgerechten en bijgerechten die de vorige opschoning misten.
--
-- 20260809000009 filterde op tags. Maar een groot deel van de recepten van
-- uitpaulineskeuken.nl kwam binnen met één of twee tags ('kip', 'vegetarisch'),
-- dus een carpaccio of een aardappelgratin had geen 'voorgerecht' of
-- 'bijgerecht' om op te vangen. Die stonden gewoon in de weekmenu-pool.
--
-- Deze lijst is met de hand nagelopen, op titel en ingrediënten. Criterium:
-- zou je hier op een doordeweekse avond je avondeten van maken? Bij twijfel
-- bleef het staan — steak tartare, nacho's met gehakt, hele geroosterde
-- knolselderij, gegrilde asperges en truffelkaasfondue zijn allemaal te
-- verdedigen als hoofdgerecht. Soepen en salades blijven ook: de meeste zijn
-- maaltijdsoepen en maaltijdsalades.
--
-- Op URL en niet op titel: de URL is uniek (recepten_url_uniek), een titel
-- niet per se. 37 recepten; de pool gaat van 475 naar 438.
--
-- Net als bij 0009: dit is een verwijdering. De brondata staat onaangeroerd in
-- data/recepten.json. Wie een van deze recepten deze week gekozen had, ziet
-- 'm uit het weekmenu verdwijnen (on delete cascade); ingrediënten die al op de
-- boodschappenlijst stonden blijven staan (on delete set null).

delete from recepten
where bron_type = 'scraper'
  and url in (
    -- Bijgerechten
    'https://miljuschka.nl/aardappel-gratin-recept/',  -- Aardappelgratin
    'https://uitpaulineskeuken.nl/recept/aardappelgratin-met-truffel',  -- Aardappelgratin met truffel
    'https://uitpaulineskeuken.nl/recept/aardappel-koekjes',  -- Aardappel koekjes met zure room
    'https://uitpaulineskeuken.nl/recept/rode-bietjes-met-feta',  -- Rode bietjes met feta uit de Airfryer
    'https://miljuschka.nl/geroosterde-honingspruitjes-met-feta/',  -- Geroosterde honingspruitjes met feta
    'https://miljuschka.nl/heerlijk-bijgerecht-geroosterde-zoete-aardappel-met-peer/',  -- Geroosterde zoete aardappel met peer
    'https://uitpaulineskeuken.nl/recept/gegrilde-little-gem',  -- Gegrilde little gem
    'https://uitpaulineskeuken.nl/recept/crispy-potato-salad',  -- Crispy potato salad
    'https://uitpaulineskeuken.nl/recept/insalata-mista',  -- Insalata mista
    'https://uitpaulineskeuken.nl/recept/rauwkost-salade',  -- Rauwkost salade
    'https://uitpaulineskeuken.nl/recept/aziatische-komkommersalade',  -- Aziatische komkommersalade
    -- Voorgerechten
    'https://uitpaulineskeuken.nl/recept/avocado-met-garnalen',  -- Avocado met garnalen
    'https://uitpaulineskeuken.nl/recept/aziatische-carpaccio',  -- Aziatische carpaccio
    'https://uitpaulineskeuken.nl/recept/zalm-carpaccio',  -- Zalm carpaccio
    'https://uitpaulineskeuken.nl/recept/carpaccio-in-glaasje',  -- Carpaccio in glaasje
    'https://uitpaulineskeuken.nl/recept/gemarineerde-zalm-met-biet',  -- Gemarineerde zalm met biet
    'https://uitpaulineskeuken.nl/recept/gegratineerde-coquilles',  -- Gegratineerde coquilles
    'https://uitpaulineskeuken.nl/recept/zalmterrine',  -- Zalmterrine
    -- Hapjes en borrel
    'https://uitpaulineskeuken.nl/recept/bruschetta-champignons',  -- Bruschetta met champignons
    'https://uitpaulineskeuken.nl/recept/butter-board',  -- Aziatisch butter board
    'https://uitpaulineskeuken.nl/recept/brie-uit-de-oven',  -- Brie uit de oven met gegrilde nectarines
    'https://uitpaulineskeuken.nl/recept/crispy-sushi-bites',  -- Crispy sushi bites
    'https://uitpaulineskeuken.nl/recept/sushi-springrolls-met-zalm',  -- Sushi springrolls met zalm
    'https://uitpaulineskeuken.nl/recept/deviled-eggs',  -- Deviled eggs met zalm
    'https://uitpaulineskeuken.nl/recept/garnalen-kroketjes',  -- Garnalen kroketjes met citroen-mayo
    'https://uitpaulineskeuken.nl/recept/geitenkaas-hapje',  -- Geitenkaas hapje met nootjes en honing
    'https://uitpaulineskeuken.nl/recept/kerst-amuses',  -- Kerst amuses met kaas: 3 makkelijke recepten
    'https://uitpaulineskeuken.nl/recept/kersthapjes',  -- 3x makkelijke kersthapjes
    'https://uitpaulineskeuken.nl/recept/spaanse-pintxos',  -- Spaanse pintxos: 3 x makkelijke hapjes
    'https://miljuschka.nl/omeletrolletjes-met-rosbief-of-gerookte-zalm/',  -- Omeletrolletjes met rosbief of gerookte zalm
    'https://uitpaulineskeuken.nl/recept/sandwich-taart-met-zalm',  -- Sandwich taart met zalm
    'https://miljuschka.nl/crunchy-herring-krokant-gebakken-gezouten-haring/',  -- Crunchy haring – krokant gebakken gezouten haring
    -- Bakken, basis en fruit
    'https://miljuschka.nl/courgettemuffins-uit-de-airfryer/',  -- Courgettemuffins uit de airfryer
    'https://miljuschka.nl/paashaas-kaasbroodjes/',  -- Paashaasjes kaasbroodjes
    'https://uitpaulineskeuken.nl/recept/pasteibakjes-maken',  -- Pasteibakjes maken
    'https://uitpaulineskeuken.nl/recept/zelf-ravioli-maken',  -- Zelf ravioli maken
    'https://uitpaulineskeuken.nl/recept/fruitsalade'   -- Fruitsalade
  );
