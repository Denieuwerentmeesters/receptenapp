-- zorg_voor_gebruiker() draaide als `security definer`. Op Neon zijn de
-- JWT-claims daarbinnen niet zichtbaar: auth.user_id() geeft dan null en de
-- functie viel om met "Geen geldige sessie".
--
-- Definer was ook nergens voor nodig. De aanroeper heeft grants op `gebruiker`
-- en `gebruiker_voorkeuren`, en de policies op beide tabellen staan precies deze
-- twee rijen toe (`... = auth.user_id()`). Als invoker doet de functie dus
-- hetzelfde, maar dan mét claims — en zonder de rechtenverhoging die je bij een
-- definer altijd goed moet blijven nadenken.

create or replace function public.zorg_voor_gebruiker()
returns text
language plpgsql
as $$
declare
  v_id text := auth.user_id();
begin
  if v_id is null then
    raise exception 'Geen geldige sessie';
  end if;

  insert into public.gebruiker (id) values (v_id) on conflict (id) do nothing;
  insert into public.gebruiker_voorkeuren (user_id) values (v_id) on conflict (user_id) do nothing;

  return v_id;
end;
$$;

grant execute on function public.zorg_voor_gebruiker() to authenticated;

-- Dezelfde valkuil zit in de weekmenu-generator. Die leest auth.user_id() niet
-- zelf (de user-id komt als parameter binnen), maar hij schrijft wel in
-- weekmenu_getoond, en als definer omzeilt hij de RLS-check daarop. Als invoker
-- geldt de policy gewoon, wat meteen afdwingt dat je alleen een menu voor jezelf
-- kunt laten genereren.
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
  -- Alleen voor jezelf: anders zou je met een andere id andermans menu kunnen
  -- vullen. De RLS-policy vangt het ook af, maar een duidelijke fout is beter
  -- dan een stille nul.
  if p_user_id is distinct from auth.user_id() then
    raise exception 'Je kunt alleen een weekmenu voor jezelf genereren';
  end if;

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
      (r.user_id is null or r.user_id = p_user_id or r.deel_status = 'goedgekeurd')
      and (v_max_bereidingstijd is null
           or r.bereidingstijd_minuten is null
           or r.bereidingstijd_minuten <= v_max_bereidingstijd)
      and not exists (
        select 1 from weekmenu_gekozen g
        where g.user_id = p_user_id and g.recept_id = r.id
          and g.week_start_datum > p_week_start - interval '26 weeks'
      )
      and not exists (
        select 1 from weekmenu_getoond t
        where t.user_id = p_user_id and t.recept_id = r.id
          and t.week_start_datum > p_week_start - interval '4 weeks'
      )
  ),
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
