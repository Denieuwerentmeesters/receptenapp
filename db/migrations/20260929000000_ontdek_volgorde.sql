-- Volgorde in Ontdekken: gemengd, met gemiddeld meer vegetarisch bovenaan.
--
-- Tot nu toe stond Ontdekken op alfabet, en dan zie je bovenaan wat toevallig
-- met een A begint — vaak vlees. Nu krijgt elk recept een vaste plek uit een
-- hash van zijn id (dus gemengd, maar elke keer dezelfde volgorde, zodat
-- "terug naar je plek" blijft werken). Vegetarische recepten krijgen de helft
-- van die waarde: ze komen gemiddeld twee keer zo vaak bovenaan. Bij een pool
-- die half vega is, is bovenaan zo'n twee derde vegetarisch.
--
-- Een generated column rekent vanzelf mee als de tags veranderen. hashtext is
-- immutable, dus dat mag. Achterwaarts veilig: alleen een kolom erbij; de oude
-- app sorteert gewoon op titel door.

alter table recepten add column ontdek_volgorde double precision
  generated always as (
    ((hashtext(id::text)::bigint + 2147483648) / 4294967296.0)
    * case when 'vegetarisch' = any(tags) then 0.5 else 1 end
  ) stored;

create index recepten_ontdek_volgorde on recepten (ontdek_volgorde, id);
