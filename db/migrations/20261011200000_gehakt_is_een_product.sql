-- "gehakt" is een product, geen bereiding.
--
-- ingredient_key haalde "gehakte?" weg als bereidingswoord ("gehakte
-- peterselie"). Daardoor werd een los "gehakt" (7 recepten) een lege sleutel:
-- geen product, geen vega-keuze, en op de lijst samengevoegd met elke andere
-- lege sleutel. Nu valt alleen "gehakte" weg. Een "gehakt" achteraan
-- ("knoflook, gehakt") haalt de app weg via lijstSleutel (BEREIDING) en telt
-- zoekProduct als onschuldig (BEREID), dus die regels vinden hun product nog.
--
-- Spiegel van ingredientKey() in app/src/lib/schaal.ts en ingredient_key() in
-- scripts/ah_mapping.py; alle drie zijn in dezelfde PR aangepast.
-- Achterwaarts veilig: opgeslagen sleutels blijven staan, de app rekent de
-- sleutel bij het zoeken opnieuw uit de naam.

create or replace function public.ingredient_key(naam text)
returns text
language sql
immutable
as $$
  with gestript as (
    select regexp_replace(
      regexp_replace(lower(unaccent(coalesce(naam, ''))), '''s\M', ' ', 'g'),
      '\([^)]*\)', ' ', 'g') as t
  ),
  zonder_ruis as (
    select regexp_replace(
      regexp_replace(
        regexp_replace(
          t,
          '\m(verse?|vers|gedroogde?|gemalen|geraspte?|fijngesneden|grofgesneden|gesneden|gehakte|geschilde|biologische?|bio|kleine?|grote?|halve|hele|extra|vergine|zonder vel|naar smaak|om te frituren|optioneel)\M',
          ' ', 'g'),
        '[^a-z ]', ' ', 'g'),
      '\s+', ' ', 'g'
    ) as t
    from gestript
  ),
  zonder_losse_letters as (
    select trim(regexp_replace(t, '\m\w\M', ' ', 'g')) as t
    from zonder_ruis
  ),
  opgeschoond as (
    select trim(regexp_replace(t, '\s+', ' ', 'g')) as t
    from zonder_losse_letters
  )
  select nullif(
    case
      when length(t) >= 5 and t ~ '(el|er|em|en|ie|je|e)s$' then left(t, length(t) - 1)
      else t
    end,
    ''
  )
  from opgeschoond;
$$;

-- De nieuwe sleutels: gehakt zonder soort is rundergehakt, half-om-half heet
-- bij AH "gemengd gehakt". Nagekeken bij AH en Jumbo op 11 oktober 2026.
-- Standaard gaat het als vegagehakt naar het mandje (src/lib/vega.ts).

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('gehakt', 'ah rundergehakt', 4004, null, now()),
  ('half om half gehakt', 'ah gemengd gehakt 500 g', 561333, null, now()),
  ('half om halfgehakt', 'ah gemengd gehakt 500 g', 561333, null, now()),
  ('gemengd gehakt', 'ah gemengd gehakt 500 g', 561333, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;

insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (4004, 300, 'g'),
  (561333, 500, 'g')
on conflict (product_id) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('gehakt', 'Jumbo Rundergehakt 500 g', '131278BAK', null),
  ('half om half gehakt', 'Jumbo Half-om-Half Gehakt Varken-Rund 500 g', '785730BAK', null),
  ('half om halfgehakt', 'Jumbo Half-om-Half Gehakt Varken-Rund 500 g', '785730BAK', null),
  ('gemengd gehakt', 'Jumbo Half-om-Half Gehakt Varken-Rund 500 g', '785730BAK', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('131278BAK', 500, 'g'),
  ('785730BAK', 500, 'g')
on conflict (sku) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;
