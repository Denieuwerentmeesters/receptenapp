-- Gedeelde lijst met je huisgenoot (plan "gemak en bonus", onderdeel 6;
-- issue #50).
--
-- Een huishouden is de lijst van de eigenaar. Wie lid is, leest en schrijft
-- de rijen van de eigenaar: weekmenu, boodschappenlijst, voorraadkast,
-- voorkeuren en bestellingen. Per tabel komt er één extra policy naast
-- "eigen rijen"; er verandert niets aan sleutels of bestaande rijen. Je eigen
-- rijen blijven staan en zijn terug als je het huishouden verlaat.
-- Persoonlijk blijven: favorieten, beoordelingen en eigen recepten.
--
-- Achterwaarts veilig: alleen toevoegingen. Zolang niemand lid is, verandert
-- er voor niemand iets.

-- ------------------------------------------------------------ huishouden_lid

-- Eén huishouden per gebruiker: user_id is de sleutel. De policies hieronder
-- verwijzen naar geen andere tabel, zodat de policies op de gedeelde tabellen
-- (die wél naar huishouden_lid kijken) niet in een kringetje lopen.
create table if not exists huishouden_lid (
  user_id        text primary key references gebruiker (id) on delete cascade,
  eigenaar_id    text not null references gebruiker (id) on delete cascade,
  lid_email      text,
  eigenaar_email text,
  via_code       text not null,
  sinds          timestamptz not null default now(),
  check (user_id <> eigenaar_id)
);

create index if not exists huishouden_lid_eigenaar on huishouden_lid (eigenaar_id);

-- ---------------------------------------------------- huishouden_uitnodiging

create table if not exists huishouden_uitnodiging (
  code           text primary key check (code ~ '^[A-Z0-9]{8}$'),
  eigenaar_id    text not null references gebruiker (id) on delete cascade,
  eigenaar_email text,
  verloopt_op    timestamptz not null default now() + interval '7 days',
  aangemaakt_op  timestamptz not null default now()
);

alter table huishouden_uitnodiging enable row level security;

-- Alleen de eigenaar ziet en beheert zijn uitnodigingen.
drop policy if exists "eigen uitnodigingen" on huishouden_uitnodiging;
create policy "eigen uitnodigingen" on huishouden_uitnodiging
  for all to authenticated
  using (eigenaar_id = auth.user_id()) with check (eigenaar_id = auth.user_id());

grant select, insert, delete on huishouden_uitnodiging to authenticated;

-- Wie een code heeft, mag weten van wie die is; de uitnodigingen zelf zijn
-- niet te lezen. Daarom security definer. Let op de valkuil uit CLAUDE.md:
-- binnen een definer-functie werkt auth.user_id() niet. Deze twee functies
-- roepen het bewust niet aan; wie je bent controleert de policy op
-- huishouden_lid.
create or replace function public.uitnodiging_info(p_code text)
returns table (eigenaar_id text, eigenaar_email text)
language sql
security definer
set search_path = public
as $$
  select u.eigenaar_id, u.eigenaar_email
  from huishouden_uitnodiging u
  where u.code = upper(p_code) and u.verloopt_op > now()
$$;

create or replace function public.uitnodiging_geldig(p_code text, p_eigenaar text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from huishouden_uitnodiging u
    where u.code = upper(p_code) and u.eigenaar_id = p_eigenaar and u.verloopt_op > now()
  )
$$;

revoke all on function public.uitnodiging_info(text) from public;
revoke all on function public.uitnodiging_geldig(text, text) from public;
grant execute on function public.uitnodiging_info(text) to authenticated;
grant execute on function public.uitnodiging_geldig(text, text) to authenticated;

alter table huishouden_lid enable row level security;

-- Lezen: je eigen lidmaatschap, en als eigenaar je leden.
drop policy if exists "eigen lidmaatschap" on huishouden_lid;
create policy "eigen lidmaatschap" on huishouden_lid
  for select to authenticated
  using (user_id = auth.user_id() or eigenaar_id = auth.user_id());

-- Lid worden: alleen jezelf, en alleen met een geldige code van die eigenaar.
drop policy if exists "lid worden met code" on huishouden_lid;
create policy "lid worden met code" on huishouden_lid
  for insert to authenticated
  with check (user_id = auth.user_id() and public.uitnodiging_geldig(via_code, eigenaar_id));

-- Weggaan kan het lid zelf; de eigenaar kan een lid verwijderen.
drop policy if exists "verlaten of verwijderen" on huishouden_lid;
create policy "verlaten of verwijderen" on huishouden_lid
  for delete to authenticated
  using (user_id = auth.user_id() or eigenaar_id = auth.user_id());

grant select, insert, delete on huishouden_lid to authenticated;

-- ------------------------------------------------------ gedeelde tabellen

-- Naast "eigen rijen": de rijen van de eigenaar van jouw huishouden.
-- Permissieve policies tellen op (OR), dus "eigen rijen" blijft gewoon werken.
do $$
declare
  t text;
begin
  foreach t in array array[
    'weekmenu_getoond', 'weekmenu_gekozen', 'boodschappenlijst_item',
    'voorraad_item', 'gebruiker_voorkeuren', 'bestelling'
  ] loop
    execute format('drop policy if exists "rijen van je huishouden" on %I', t);
    execute format($p$
      create policy "rijen van je huishouden" on %I
        for all to authenticated
        using (user_id in (select h.eigenaar_id from huishouden_lid h where h.user_id = auth.user_id()))
        with check (user_id in (select h.eigenaar_id from huishouden_lid h where h.user_id = auth.user_id()))
    $p$, t);
  end loop;
end
$$;
