-- De meervouds-s-regel was nog te grof. De vorige versie beschermde alleen
-- woorden op twee klinkers + s (saus, kaas), maar sloopte nog steeds
-- "citroengras" → "citroengra" en "ansjovis" → "ansjovi". Die sleutels matchen
-- nergens mee, en je zoekt er bij AH ook niets zinnigs mee.
--
-- De echte regel: het Nederlands plakt de meervouds-s achter onbeklemtoonde
-- uitgangen — -el, -er, -em, -en, -ie, -je en -e (aardappels, wortels,
-- bosuitjes). Achter een gewone klinker gebruikt het Nederlands een apostrof
-- (paprika's), en die vangen we al apart af. Staat er dus een s achter iets
-- anders, dan hoort die s bij het woord.
--
-- Spiegel van ingredientKey() in app/src/lib/schaal.ts en ingredient_key() in
-- scripts/ah_mapping.py.

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
          '\m(verse?|vers|gedroogde?|gemalen|geraspte?|fijngesneden|grofgesneden|gesneden|gehakte?|geschilde|biologische?|bio|kleine?|grote?|halve|hele|extra|vergine|zonder vel|naar smaak|om te frituren|optioneel)\M',
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
