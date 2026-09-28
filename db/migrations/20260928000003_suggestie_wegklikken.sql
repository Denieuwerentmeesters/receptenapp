-- Een suggestie uit je weekmenu kun je wegklikken (het kruisje in "Deze week",
-- of het hartje in Ontdekken weer uitzetten).
--
-- We verwijderen de rij in weekmenu_getoond niet, maar zetten verborgen_op.
-- Twee redenen: de generator kijkt of er voor deze week al rijen bestaan — is
-- alles weggeklikt, dan zou 'ie anders een nieuw menu maken — en hij slaat
-- recepten over die de afgelopen vier weken getoond zijn. Wat je wegklikte
-- hoeft ook niet volgende week meteen terug te komen.
--
-- Zet je een weggeklikte suggestie via Ontdekken weer in je week, dan gaat
-- verborgen_op terug naar null.
--
-- Geen nieuwe grant of policy nodig: update op weekmenu_getoond mag al, en
-- "eigen rijen" is `for all`.

alter table weekmenu_getoond add column verborgen_op timestamptz;
