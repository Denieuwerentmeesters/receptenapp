-- Twee fouten in ingredient_key():
--
--  1. De meervouds-s-regel `(\w{4,})s$` haalde ook de s weg die bij de stam
--     hoort: sojasaus -> sojasau, roomkaas -> roomkaa, pindakaas -> pindakaa,
--     vissaus -> vissau. Die sleutels matchen nergens mee, en het zijn precies
--     veelvoorkomende ingrediënten.
--
--     Nederlandse meervouds-s hangt aan een stam die eindigt op een medeklinker
--     of een enkele klinker (aardappels -> aardappel, bosuitjes -> bosuitje).
--     Eindigt het woord op twee klinkers gevolgd door s (saus, kaas, muis), dan
--     is die s onderdeel van het woord. Die uitzondering is nu de regel.
--
--  2. "paprika's" werd "paprika s": de apostrof verdween, de losse s bleef staan.
--     Nu vangen we 's expliciet af, en losse letters vallen sowieso weg.
--
-- Let op: -en-meervouden (ui/uien, citroen/citroenen) worden niet
-- teruggebracht. Dat is bewust — daar zijn te veel woorden die op -en eindigen
-- zonder meervoud te zijn. De mappingtabel krijgt gewoon beide sleutels.
--
-- Spiegel van ingredientKey() in app/src/lib/schaal.ts en van ingredient_key()
-- in scripts/ah_mapping.py. Alle drie moeten dezelfde sleutel opleveren.

create or replace function public.ingredient_key(naam text)
returns text
language sql
immutable
as $$
  with gestript as (
    select regexp_replace(
      -- bezits-/meervouds-apostrof eerst weg, anders blijft er een losse s over
      regexp_replace(lower(unaccent(coalesce(naam, ''))), '''s\M', ' ', 'g'),
      -- alles tussen haakjes is toelichting, geen product
      '\([^)]*\)', ' ', 'g') as t
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
  ),
  zonder_losse_letters as (
    -- losse letters zijn restanten van afkortingen en apostrofs, geen product
    select trim(regexp_replace(t, '\m\w\M', ' ', 'g')) as t
    from zonder_ruis
  ),
  opgeschoond as (
    select trim(regexp_replace(t, '\s+', ' ', 'g')) as t
    from zonder_losse_letters
  )
  select nullif(
    case
      -- eindigt op twee klinkers + s? Dan hoort die s bij het woord.
      when t ~ '[aeiou][aeiou]s$' then t
      when length(t) >= 5 and t ~ 's$' then left(t, length(t) - 1)
      else t
    end,
    ''
  )
  from opgeschoond;
$$;

comment on function public.ingredient_key(text) is
  'Normaliseert een receptingrediëntnaam tot een matchsleutel voor ah_product_cache.';
