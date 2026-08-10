-- Twee tabellen voor de schermen uit `Profiel en Voorraad.dc.html`.

-- ---------------------------------------------------------------- favoriet

-- Favorieten wegen mee in het weekmenu: ze komen vaker terug.
create table favoriet (
  user_id       text not null references gebruiker (id) on delete cascade,
  recept_id     uuid not null references recepten (id) on delete cascade,
  aangemaakt_op timestamptz not null default now(),
  primary key (user_id, recept_id)
);

alter table favoriet enable row level security;

create policy "eigen rijen" on favoriet
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

grant select, insert, delete on favoriet to authenticated;

-- --------------------------------------------------------------- voorraad

-- De voorraadkast: wat hier aan staat valt van je boodschappenlijst af.
-- We bewaren de genormaliseerde sleutel, want daarop matcht de lijst.
create table voorraad_item (
  user_id        text not null references gebruiker (id) on delete cascade,
  ingredient_key text not null,
  naam           text not null,
  categorie      text,
  in_huis        boolean not null default true,
  bijgewerkt_op  timestamptz not null default now(),
  primary key (user_id, ingredient_key)
);

alter table voorraad_item enable row level security;

create policy "eigen rijen" on voorraad_item
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

grant select, insert, update, delete on voorraad_item to authenticated;

-- ------------------------------------------- favorieten wegen mee in de week

-- Een favoriet krijgt hetzelfde gewicht als een favoriete keuken. Zo zie je ze
-- vaker terug zonder dat ze de andere recepten verdringen.
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
    select r.id, r.tags, r.keuken,
           exists (select 1 from favoriet f where f.user_id = p_user_id and f.recept_id = r.id) as is_favoriet
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
