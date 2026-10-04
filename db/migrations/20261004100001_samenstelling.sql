-- Zelf samenstellen: de aanvragen en hoe de recepten eraan hangen.
--
--   samenstelling              Eén rij per aanvraag bij api/samenstellen.ts:
--                              wat je vroeg, wat Claude teruggaf en wat het
--                              kostte. Daarmee telt de functie de daglimiet,
--                              en later komt hier "Mijn menu's" uit.
--   recepten.samenstelling_id  Houdt de gerechten van één menu bij elkaar.
--
-- De functie schrijft de rijen met DATABASE_URL (zonder RLS); de app mag ze
-- alleen lezen. Zo kan niemand zijn eigen limiet wegpoetsen.

create table samenstelling (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references gebruiker (id) on delete cascade,
  -- 'nieuw' = een menu vanaf de drie vragen; 'aanpassing' = een ander voorstel
  -- voor één gerecht of het menu bijsturen. Ze hebben elk een eigen daglimiet.
  soort         text not null default 'nieuw' check (soort in ('nieuw', 'aanpassing')),
  keuken        text not null,
  personen      integer not null check (personen > 0),
  wensen        text not null default '',
  begrepen      jsonb not null default '[]',
  -- null zolang het antwoord nog onderweg is
  antwoord      jsonb,
  model         text not null,
  tokens_in     integer not null default 0,
  tokens_uit    integer not null default 0,
  aangemaakt_op timestamptz not null default now()
);

create index samenstelling_limiet on samenstelling (user_id, soort, aangemaakt_op);

alter table samenstelling enable row level security;

create policy "eigen samenstellingen lezen" on samenstelling
  for select to authenticated using (user_id = auth.user_id());

grant select on samenstelling to authenticated;

alter table recepten
  add column samenstelling_id uuid references samenstelling (id) on delete set null;

create index recepten_samenstelling on recepten (samenstelling_id) where samenstelling_id is not null;

-- Een samengesteld recept is door niemand geproefd of nagekeken: het blijft
-- van jou alleen. Zelfde vorm als kookboek_altijd_prive.
alter table recepten
  add constraint samengesteld_altijd_prive
    check (bron_type <> 'samengesteld' or deel_status = 'prive');

-- ------------------------------------------------------- weekmenu-generator
--
-- Samengestelde recepten horen niet in de pool: een bijgerecht voor tien is
-- geen doordeweeks hoofdgerecht. Verder ongewijzigd ten opzichte van
-- 20260930233000_allergieen.sql.

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
  v_allergieen         text[];
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

  select vega_minimum, max_bereidingstijd, favoriete_keukens, voorkeurswinkel, zelf_halen, allergieen
    into v_vega_minimum, v_max_bereidingstijd, v_favoriete_keukens, v_winkel, v_zelf_halen, v_allergieen
  from gebruiker_voorkeuren where user_id = p_user_id;

  if not found then
    v_vega_minimum := 6; v_favoriete_keukens := '{}'; v_winkel := 'ah'; v_zelf_halen := false;
    v_allergieen := '{}';
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
      -- Zelf samengestelde menu's: niet in het weekmenu.
      and r.bron_type <> 'samengesteld'
      -- Een allergeen zonder vervanger: niet in je weekmenu.
      and not (r.allergenen_vast && v_allergieen)
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
