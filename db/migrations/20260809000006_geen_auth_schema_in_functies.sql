-- De rol `authenticated` mag auth.user_id() wél gebruiken in een RLS-policy,
-- maar niet aanroepen vanuit een functiebody: "permission denied for schema auth".
-- En als `security definer` draaide de functie wel, maar zag hij de JWT-claims
-- niet en gaf auth.user_id() null terug.
--
-- Beide routes lopen dus dood. In plaats van te blijven duwen tegen Neon's
-- interne schema halen we auth.user_id() uit de functies weg:
--
--  * zorg_voor_gebruiker() vervalt helemaal. De app doet die twee inserts nu
--    zelf via de Data API; de RLS-policies (`... = auth.user_id()`) bewaken dat
--    je alleen jezelf kunt aanmaken. Dat is precies wat de functie deed, maar
--    zonder extra laag.
--
--  * genereer_weekmenu() krijgt geen eigen controle meer op wie je bent. De
--    policy op weekmenu_getoond doet dat al: een insert met de id van iemand
--    anders faalt op de WITH CHECK. De functie hoeft het niet te herhalen.

drop function if exists public.zorg_voor_gebruiker();

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
  -- niets uit. random() ^ (1/gewicht) is een gewogen trekking zonder teruglegging.
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
grant execute on function public.week_start(date) to authenticated;
