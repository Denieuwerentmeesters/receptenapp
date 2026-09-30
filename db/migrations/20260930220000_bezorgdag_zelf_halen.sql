-- Bezorgdag en zelf halen (plan "gemak en bonus", onderdeel 5).
--
-- zelf_halen: je haalt je boodschappen zelf in de winkel. Dan telt de bonus
-- van vandaag, niet die van de eerste bezorgdag.
-- bestelling.bezorgdatum: de dag waarop je liet bezorgen (of ophaalde), zodat
-- Bespaard! het bonusvoordeel over de juiste week kan rekenen.
-- genereer_weekmenu: gelijk aan 20260930210000, alleen de peildatum houdt nu
-- rekening met zelf_halen.
--
-- Achterwaarts veilig: kolommen erbij met een default, en dezelfde
-- functie-signatuur.

alter table gebruiker_voorkeuren
  add column if not exists zelf_halen boolean not null default false;

alter table bestelling
  add column if not exists bezorgdatum date;

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
  v_winkel             text;
  v_zelf_halen         boolean;
  v_peil               date;
  v_vega_aantal        integer;
  v_geplaatst          integer;
begin
  if exists (
    select 1 from weekmenu_getoond
    where user_id = p_user_id and week_start_datum = p_week_start
  ) then
    return 0;
  end if;

  select vega_minimum, max_bereidingstijd, favoriete_keukens, voorkeurswinkel, zelf_halen
    into v_vega_minimum, v_max_bereidingstijd, v_favoriete_keukens, v_winkel, v_zelf_halen
  from gebruiker_voorkeuren where user_id = p_user_id;

  if not found then
    v_vega_minimum := 6; v_favoriete_keukens := '{}'; v_winkel := 'ah'; v_zelf_halen := false;
  end if;

  -- Zelf halen: de bonus van vandaag. Anders de eerste bezorgdag: morgen, en
  -- valt morgen op zondag, dan maandag.
  v_peil := case
    when v_zelf_halen then current_date
    else current_date + case when extract(dow from current_date + 1) = 0 then 2 else 1 end
  end;
  v_peil := greatest(v_peil, p_week_start);

  v_vega_aantal := least(v_vega_minimum, p_aantal);

  with beschikbaar as (
    select r.id, r.tags, r.keuken,
           exists (select 1 from favoriet f where f.user_id = p_user_id and f.recept_id = r.id) as is_favoriet,
           exists (select 1 from recept_bonus b
                   where b.recept_id = r.id and b.winkel = v_winkel
                     and v_peil between b.geldig_van and b.geldig_tot) as in_bonus
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
        1.0 / (
          case when keuken = any(v_favoriete_keukens) then 3.0::double precision else 1.0 end
          * case when is_favoriet then 3.0::double precision else 1.0 end
          * case when in_bonus then 2.0::double precision else 1.0 end
        )
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
