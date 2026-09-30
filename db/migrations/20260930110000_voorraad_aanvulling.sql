-- "Op"-knop in de voorraadkast (plan gemak en bonus, onderdeel 2).
--
-- Raakt iets op, dan gaat het in de voorraadkast uit én komt het als extra
-- product op je lijst. Deze kolom markeert zulke regels, zodat ze na de
-- boodschappen (bestelling bevestigd of "Klaar met boodschappen") vanzelf
-- weer op "in huis" gaan.
--
-- Achterwaarts veilig: één kolom erbij met een default.

alter table boodschappenlijst_item
  add column if not exists voorraad_aanvulling boolean not null default false;
