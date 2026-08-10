-- Alleen hoofdgerechten in de database.
--
-- Tot nu toe stond de hele gescrapete set in `recepten` en filterde alleen de
-- weekmenu-generator de niet-avondmaaltijden weg. Dat is de verkeerde plek: een
-- Aperol Spritz hoort niet in een receptenapp voor "wat eten we vanavond", ook
-- niet als je door alle recepten bladert.
--
-- Weg: desserts, gebak, drankjes, sauzen, dips, borrelhapjes, basisrecepten,
-- plus bij- en voorgerechten, snacks en ontbijt/brunch.
-- Blijft: 475 van de 581, waarvan 181 vegetarisch.
--
-- Dit is een verwijdering. De brondata staat onaangeroerd in data/recepten.json,
-- dus terugdraaien is scripts/import_recepten.py opnieuw draaien.

delete from recepten
where bron_type = 'scraper'
  and tags && array[
    'dessert', 'cheesecake', 'ijstaart', 'koekjes', 'bars', 'gebak', 'frans gebak', 'cake',
    'drank', 'cocktail', 'mocktail', 'alcoholvrij', 'limoncello',
    'basisrecept', 'saus', 'pastasaus', 'romige saus', 'dip', 'hummus',
    'marinade', 'bouillon', 'borrel', 'borrelhapje', 'hapje', 'pannenkoeken',
    'bijgerecht', 'voorgerecht', 'snack', 'ontbijt', 'brunch'
  ];

-- De generator hoeft nu niet meer te filteren: de pool is al schoon. Dat scheelt
-- een lijst die op twee plekken hetzelfde moest zijn.
create or replace function public.genereer_weekmenu(
  p_user_id text,
  p_week_start date default public.week_start(),
  p_aantal integer default 10
)
returns integer
language plpgsql
as $$
declare
  v_vega_minimum       integer;
  v_max_bereidingstijd integer;
  v_favoriete_keukens  text[];
  v_vega_aantal        integer;
  v_geplaatst          integer;
begin
  -- Al gegenereerd voor deze week? Dan niets doen: de lijst moet niet veranderen
  -- elke keer dat de app opengaat (plan §1.4).
  if exists (
    select 1 from weekmenu_getoond
    where user_id = p_user_id and week_start_datum = p_week_start
  ) then
    return 0;
  end if;

  select vega_minimum, max_bereidingstijd, favoriete_keukens
    into v_vega_minimum, v_max_bereidingstijd, v_favoriete_keukens
  from gebruiker_voorkeuren where user_id = p_user_id;

  if not found then
    v_vega_minimum := 6; v_favoriete_keukens := '{}';
  end if;

  v_vega_aantal := least(v_vega_minimum, p_aantal);

  with beschikbaar as (
    select r.id, r.tags, r.keuken
    from recepten r
    where
      -- de pool: gedeeld + eigen + goedgekeurd gedeeld van anderen
      (r.user_id is null or r.user_id = p_user_id or r.deel_status = 'goedgekeurd')
      -- hard filter: max bereidingstijd
      and (v_max_bereidingstijd is null
           or r.bereidingstijd_minuten is null
           or r.bereidingstijd_minuten <= v_max_bereidingstijd)
      -- cooldown: daadwerkelijk gekookt telt zwaar (26 weken)
      and not exists (
        select 1 from weekmenu_gekozen g
        where g.user_id = p_user_id and g.recept_id = r.id
          and g.week_start_datum > p_week_start - interval '26 weeks'
      )
      -- cooldown: wel getoond, niet gekozen mag sneller terug (4 weken)
      and not exists (
        select 1 from weekmenu_getoond t
        where t.user_id = p_user_id and t.recept_id = r.id
          and t.week_start_datum > p_week_start - interval '4 weeks'
      )
  ),
  -- Zacht filter: favoriete keukens krijgen een hoger gewicht, maar sluiten
  -- niets uit.
  gewogen as (
    select
      id,
      ('vegetarisch' = any(tags)) as vega,
      power(
        random(),
        1.0 / case when keuken = any(v_favoriete_keukens) then 3.0::double precision else 1.0 end
      ) as score
    from beschikbaar
  ),
  gekozen_vega as (
    select id, score from gewogen where vega order by score desc limit v_vega_aantal
  ),
  gekozen_vrij as (
    select id, score from gewogen
    where id not in (select id from gekozen_vega)
    order by score desc
    limit p_aantal - (select count(*) from gekozen_vega)
  ),
  alles as (
    select id, score from gekozen_vega
    union all
    select id, score from gekozen_vrij
  ),
  invoer as (
    insert into weekmenu_getoond (user_id, week_start_datum, recept_id, positie, is_vegetarisch)
    select
      p_user_id, p_week_start, a.id,
      row_number() over (order by a.score desc),
      'vegetarisch' = any(r.tags)
    from alles a join recepten r on r.id = a.id
    returning 1
  )
  select count(*) into v_geplaatst from invoer;

  return v_geplaatst;
end;
$$;

grant execute on function public.genereer_weekmenu(text, date, integer) to authenticated;
