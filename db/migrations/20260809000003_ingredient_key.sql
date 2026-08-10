-- Genormaliseerde ingredient_key (tech-stack §4, punt 1).
--
-- De AH-mapping matcht op naam, en "1 ui" / "uien" / "rode ui" moeten naar
-- hetzelfde product kunnen wijzen. Matchen op de ruwe receptstring zakt naar
-- ~40% hitrate. Deze functie maakt van een receptingrediëntnaam een sleutel:
-- lowercase, zonder accenten, zonder bijzinnen tussen haakjes, zonder
-- bereidingswoorden en zonder meervouds-s.
--
-- Spiegel van ingredientKey() in app/src/lib/schaal.ts en van ingredient_key()
-- in scripts/ah_mapping.py. Alle drie moeten dezelfde sleutel opleveren, anders
-- matcht de mapping niet.

create function public.ingredient_key(naam text)
returns text
language sql
immutable
as $$
  with gestript as (
    -- accenten weg, lowercase, en alles tussen haakjes eruit:
    -- dat is toelichting, geen product
    select regexp_replace(lower(unaccent(coalesce(naam, ''))), '\([^)]*\)', ' ', 'g') as t
  ),
  zonder_ruis as (
    select regexp_replace(
      regexp_replace(
        -- bereidingswoorden dragen niets bij aan de match
        regexp_replace(
          t,
          '\m(verse?|vers|gedroogde?|gemalen|geraspte?|fijngesneden|grofgesneden|gesneden|gehakte?|geschilde|biologische?|bio|kleine?|grote?|halve|hele|extra|vergine|zonder vel|naar smaak|om te frituren|optioneel)\M',
          ' ', 'g'),
        -- interpunctie en cijfers
        '[^a-z ]', ' ', 'g'),
      '\s+', ' ', 'g'
    ) as t
    from gestript
  )
  -- meervouds-s eraf: "tomaten" -> "tomaat" is te veel maatwerk, maar de
  -- trailing s weghalen dekt het gros
  select nullif(regexp_replace(trim(t), '(\w{4,})s$', '\1'), '')
  from zonder_ruis;
$$;

comment on function public.ingredient_key(text) is
  'Normaliseert een receptingrediëntnaam tot een matchsleutel voor ah_product_cache.';

-- De boodschappenlijst vult ingredient_key zelf; deze index maakt het samenvoegen
-- en dedupliceren over meerdere recepten heen snel.
create index boodschappen_key on boodschappenlijst_item (user_id, week_start_datum, ingredient_key);
