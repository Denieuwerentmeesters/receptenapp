-- Een gekozen recept kan vaker op de lijst, en kan er weer af.
--
-- Twee kolommen op weekmenu_gekozen:
--
--   aantal        Hoe vaak je het recept deze week maakt. "Wil je deze 2x?" zet
--                 'm op 2, en dan staan de ingrediënten ook twee keer op de lijst.
--
--   van_lijst_op  Wanneer het recept van de boodschappenlijst af ging: je
--                 boodschappen zijn gedaan, doorgestuurd naar AH, of je hebt de
--                 lijst gewist. Null = staat nog op je lijst (gele rand in
--                 "Deze week"). Het recept blijft gekozen — je kookt er nog van.
--
-- De boodschappenlijst krijgt voortaan één rij per ingrediënt per recept (via
-- bron_recept_id), in plaats van één samengevoegde rij. Samenvoegen gebeurt bij
-- het tonen. Zo kan een recept er weer af zonder de hoeveelheden van een ander
-- recept mee te nemen. Daar is geen schemawijziging voor nodig; bestaande,
-- al samengevoegde rijen blijven gewoon werken.
--
-- Geen nieuwe policy nodig: "eigen rijen" op weekmenu_gekozen is `for all`.

alter table weekmenu_gekozen
  add column aantal integer not null default 1 check (aantal between 1 and 9),
  add column van_lijst_op timestamptz;

create index boodschappen_recept on boodschappenlijst_item (user_id, week_start_datum, bron_recept_id);
