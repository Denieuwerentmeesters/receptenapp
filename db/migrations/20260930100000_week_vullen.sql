-- "Vul mijn week" (plan gemak en bonus, onderdeel 3).
--
-- Achterwaarts veilig: alleen kolommen erbij, met een default.
--
-- kookavonden: hoeveel recepten "Vul mijn week" op je lijst zet. In te
-- stellen in Instellingen, 1 t/m 7.
--
-- automatisch: dit recept koos de app, niet jij. Zo kunnen we later zien hoe
-- vaak een automatische keuze geruild wordt, en het kiezen bijstellen.
-- Geen nieuwe grant of policy nodig: de tabellen zijn al te lezen en te
-- schrijven voor je eigen rijen.

alter table gebruiker_voorkeuren
  add column if not exists kookavonden integer not null default 4
    check (kookavonden between 1 and 7);

alter table weekmenu_gekozen
  add column if not exists automatisch boolean not null default false;

-- Ruilen haalt een recept uit je week, en daarmee verdwijnt ook de rij in
-- weekmenu_gekozen. Het moment van ruilen bewaren we daarom op de suggestie
-- zelf, die blijft bestaan (verborgen).
alter table weekmenu_getoond
  add column if not exists geruild_op timestamptz;
