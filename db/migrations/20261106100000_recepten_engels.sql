-- Engelse versie van een recept (Reinoud, 6 nov 2026): titel, ingrediënten en
-- bereiding. De Nederlandse kolommen blijven de bron: de AH-mapping, de lijst
-- en de allergieregels werken op de Nederlandse naam. De Engelse tekst is alleen
-- voor weergave.
--   ingredienten_en  jsonb-lijst van { "eenheid": …, "naam": … }, op dezelfde
--                    plek als in `ingredienten` (hoeveelheden blijven daar)
--   bereiding_en     zelfde stappen als bereiding_nl, vertaald
-- Achterwaarts veilig: kolommen erbij, null = nog niet vertaald (de app toont
-- dan het Nederlands).
alter table recepten
  add column if not exists titel_en text,
  add column if not exists ingredienten_en jsonb,
  add column if not exists bereiding_en text[];
