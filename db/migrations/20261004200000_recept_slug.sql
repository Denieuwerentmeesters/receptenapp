-- De link naar een recept op de website krijgt de naam van het gerecht:
-- /r/romige-kip-met-spinazie in plaats van /r/199ad632-e86c-….
--
-- Alleen recepten uit de gedeelde pool (user_id null, of goedgekeurd gedeeld)
-- krijgen een slug. Die zijn toch al voor iedereen te lezen, dus een naam die
-- je kunt raden geeft niets weg. Een eigen recept met een deellink houdt het
-- id in de link (/r/<naam>-<id>, zie api/recept.ts): daar is juist het niet te
-- raden id wat het recept privé houdt.
--
-- Een slug blijft staan als de titel later verandert, zodat een gedeelde link
-- niet breekt. De oude /r/<id> blijft ook werken.

alter table recepten add column slug text;

comment on column recepten.slug is
  'Naam in de link /r/<slug>; alleen voor recepten uit de gedeelde pool, gezet door een trigger.';

create unique index recepten_slug on recepten (slug) where slug is not null;

-- Spiegel van naamSlug() in app/src/lib/slug.ts.
create function public.recept_slug(titel text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from left(
        trim(both '-' from regexp_replace(lower(unaccent(coalesce(titel, ''))), '[^a-z0-9]+', '-', 'g')),
        80)),
      ''),
    'recept');
$$;

-- De app kan de kolom niet zelf zetten: de trigger bepaalt 'm. Eenmaal gegeven
-- blijft hij; een recept buiten de pool krijgt er geen. Bestaat de naam al,
-- dan komt er een volgnummer achter.
create function public.recept_slug_bijwerken()
returns trigger
language plpgsql
as $$
declare
  basis text;
  kandidaat text;
  n int := 1;
begin
  if tg_op = 'UPDATE' and old.slug is not null then
    new.slug := old.slug;
    return new;
  end if;

  if not (new.user_id is null or new.deel_status = 'goedgekeurd') then
    new.slug := null;
    return new;
  end if;

  basis := public.recept_slug(coalesce(new.titel_nl, new.titel));
  kandidaat := basis;
  while exists (select 1 from recepten where slug = kandidaat and id <> new.id) loop
    n := n + 1;
    kandidaat := basis || '-' || n;
  end loop;
  new.slug := kandidaat;
  return new;
end;
$$;

create trigger recept_slug
  before insert or update on recepten
  for each row execute function public.recept_slug_bijwerken();

-- De bestaande pool, oudste eerst: bij twee gelijke namen houdt het oudste
-- recept de naam zonder volgnummer.
do $$
declare
  r record;
begin
  for r in
    select id from recepten
    where user_id is null or deel_status = 'goedgekeurd'
    order by aangemaakt_op, id
  loop
    update recepten set slug = null where id = r.id;
  end loop;
end;
$$;
