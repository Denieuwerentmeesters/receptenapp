-- Plaattaart met spruitjes, makreel en atjar van delicious. magazine in de
-- gedeelde pool.
--
-- Zelfde vorm als 20261026130000_salades_en_pho.sql: user_id null, bron_type
-- 'scraper', deel_status 'goedgekeurd', bron-URL erbij. Titel en bereiding
-- zijn eigen woorden; de ingrediënten komen van de bron (JSON-LD).
--
-- Een foto krijgt het vanzelf van de nachtelijke cron (api/afbeeldingen.ts).
-- Idempotent op url.

insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
)
select
  'Plaattaart met pittige spruitjes, makreel en atjar', 'Plaattaart met pittige spruitjes, makreel en atjar', 'delicious. magazine', 'https://deliciousmagazine.nl/recepten/plaattaart-met-spicy-spruitjes-makreel-atjar/', 4, 30, 'Indonesisch',
  array['vis', 'makreel', 'spruitjes', 'bladerdeeg', 'oven']::text[],
  '[{"hoeveelheid": "1", "eenheid": null, "naam": "rol koelvers bladerdeeg"}, {"hoeveelheid": "125", "eenheid": "g", "naam": "crème fraîche"}, {"hoeveelheid": "350", "eenheid": "g", "naam": "spruitjes (schoongemaakt, gehalveerd)"}, {"hoeveelheid": "2", "eenheid": "el", "naam": "sambal badjak"}, {"hoeveelheid": "1", "eenheid": "el", "naam": "ketjap"}, {"hoeveelheid": "300", "eenheid": "g", "naam": "makreelflakes"}, {"hoeveelheid": "4", "eenheid": "el", "naam": "atjar"}]'::jsonb,
  array['Verwarm de oven voor op 210 °C. Rol het bladerdeeg uit op een bakplaat met bakpapier en strijk de crème fraîche erover, met een rand van ongeveer 1 cm vrij.', 'Meng de spruitjes met de sambal en de ketjap en verdeel ze over de crème fraîche. Bak de plaattaart in ongeveer 20 minuten goudbruin en gaar.', 'Haal de plaattaart uit de oven, verdeel de makreel en de atjar erover en serveer direct. Vind je de spruitjes te pittig, neem dan 2 fijngesneden tenen knoflook in plaats van sambal.']::text[],
  'scraper', 'goedgekeurd', null
where not exists (select 1 from recepten where url = 'https://deliciousmagazine.nl/recepten/plaattaart-met-spicy-spruitjes-makreel-atjar/' and user_id is null);
