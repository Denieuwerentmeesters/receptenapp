-- Cijfer en notitie na het koken (plan "cijfer na het koken").
--
-- Eén rij per keer koken, zodat je later ziet of een recept beter werd na je
-- notitie. Het cijfer is leeg als je alleen een notitie achterliet. Alleen de
-- kok beoordeelt, niet het huishouden: de rij is persoonlijk.
--
-- Wat het cijfer doet (generator): 5 of lager valt voor jou af, 8 of hoger
-- heeft een cooldown van 8 weken in plaats van 26. Het gemiddelde over alle
-- koks staat op recepten (cijfer_gemiddeld, cijfer_aantal). Dat houdt een
-- trigger bij in plaats van een nachtelijke ronde: pg_cron zit op Neon achter
-- een betaald plan, en een trigger is altijd actueel.
--
-- Achterwaarts veilig: alleen toevoegingen.

create table if not exists beoordeling (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references gebruiker (id) on delete cascade,
  recept_id     uuid not null references recepten (id) on delete cascade,
  cijfer        smallint check (cijfer between 1 and 10),
  notitie       text check (char_length(notitie) <= 1000),
  gekookt_op    date not null default current_date,
  aangemaakt_op timestamptz not null default now(),
  check (cijfer is not null or notitie is not null)
);

create index if not exists beoordeling_gebruiker_recept
  on beoordeling (user_id, recept_id, aangemaakt_op desc);
create index if not exists beoordeling_recept on beoordeling (recept_id);

alter table beoordeling enable row level security;

drop policy if exists "eigen rijen" on beoordeling;
create policy "eigen rijen" on beoordeling
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

grant select, insert, update, delete on beoordeling to authenticated;

-- --------------------------------------------------- gemiddelde over alle koks

alter table recepten
  add column if not exists cijfer_gemiddeld numeric(3, 1),
  add column if not exists cijfer_aantal    integer not null default 0;

-- Het laatste cijfer van elke kok telt, zodat één gebruiker niet vaker meetelt.
-- Security definer: de trigger schrijft op recepten van anderen. Hij roept
-- auth.user_id() niet aan (zie de valkuil in CLAUDE.md).
create or replace function public.herreken_cijfer(p_recept_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update recepten r
  set cijfer_gemiddeld = s.gem, cijfer_aantal = s.n
  from (
    select round(avg(cijfer)::numeric, 1) as gem, count(*)::integer as n
    from (
      select distinct on (user_id) cijfer
      from beoordeling
      where recept_id = p_recept_id and cijfer is not null
      order by user_id, aangemaakt_op desc
    ) laatste
  ) s
  where r.id = p_recept_id;
$$;

create or replace function public.beoordeling_herreken()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.herreken_cijfer(coalesce(new.recept_id, old.recept_id));
  return null;
end;
$$;

drop trigger if exists beoordeling_herreken on beoordeling;
create trigger beoordeling_herreken
  after insert or update or delete on beoordeling
  for each row execute function public.beoordeling_herreken();

-- ------------------------------------------------------- weekmenu-generator
--
-- Ongewijzigd ten opzichte van 20261004100001_samenstelling.sql, behalve:
-- een laatste cijfer van 5 of lager houdt het recept voor jou uit de suggesties,
-- en bij 8 of hoger is de cooldown 8 weken in plaats van 26.

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
      -- Je laatste cijfer: 5 of lager valt af, 8 of hoger komt eerder terug.
      and coalesce((
        select b.cijfer from beoordeling b
        where b.user_id = p_user_id and b.recept_id = r.id and b.cijfer is not null
        order by b.aangemaakt_op desc limit 1
      ), 6) > 5
      and not exists (
        select 1 from weekmenu_gekozen g
        where g.user_id = p_user_id and g.recept_id = r.id
          and g.week_start_datum > p_week_start - case
            when coalesce((
              select b.cijfer from beoordeling b
              where b.user_id = p_user_id and b.recept_id = r.id and b.cijfer is not null
              order by b.aangemaakt_op desc limit 1
            ), 6) >= 8 then interval '8 weeks' else interval '26 weeks' end
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
