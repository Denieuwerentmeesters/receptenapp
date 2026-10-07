-- Deze week volgt je bestelling, niet meer de kalender.
--
-- - weekmenu_gekozen.besteld_op: wanneer dit recept naar AH of Jumbo ging.
--   Daarmee weet de app wat er in huis is om te koken, ook voor een recept dat
--   naar een volgende week is meegenomen (daar hoort geen rij in bestelling bij).
-- - weekmenu_gekozen.opgeruimd_op: gekookt en van je lijst; het recept staat
--   niet meer in Deze week, wel in je geschiedenis.
-- - gebruiker_voorkeuren.actieve_week: de week die de app als "Deze week"
--   toont. Null = de kalenderweek. Gezet bij een bestelling (zodat je bestelde
--   recepten op maandag niet verdwijnen) en bij het doorschuiven.
--
-- Alleen kolommen erbij: de oude app draait hier gewoon tegen door.

alter table weekmenu_gekozen
  add column if not exists besteld_op   timestamptz,
  add column if not exists opgeruimd_op timestamptz;

alter table gebruiker_voorkeuren
  add column if not exists actieve_week date;

-- Wat al besteld is krijgt zijn datum uit de bestelling.
update weekmenu_gekozen g
set besteld_op = b.besteld_op
from (
  select user_id, week_start_datum, unnest(recept_ids) as recept_id, min(besteld_op) as besteld_op
  from bestelling
  group by 1, 2, 3
) b
where b.user_id = g.user_id
  and b.week_start_datum = g.week_start_datum
  and b.recept_id = g.recept_id
  and g.besteld_op is null;
