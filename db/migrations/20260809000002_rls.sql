-- Row Level Security — staat op elke tabel aan vanaf het begin (tech-stack §3.4).
--
-- Op de Neon Data API is dit niet optioneel: een tabel zonder policy is via de
-- REST-endpoint volledig leesbaar voor iedere ingelogde gebruiker.
-- auth.user_id() leest het `sub`-claim uit de JWT.

alter table recepten               enable row level security;
alter table weekmenu_getoond       enable row level security;
alter table weekmenu_gekozen       enable row level security;
alter table gebruiker_voorkeuren   enable row level security;
alter table boodschappenlijst_item enable row level security;
alter table ah_product_cache       enable row level security;
alter table push_token             enable row level security;

-- ---------------------------------------------------------------- recepten

-- Leesbaar: de gedeelde pool + je eigen recepten + goedgekeurd gedeelde van
-- anderen. Die laatste tak is meteen het hele deel-mechanisme uit plan §7.3.
create policy "leesbare recepten" on recepten
  for select to authenticated using (
    user_id is null
    or user_id = auth.user_id()
    or deel_status = 'goedgekeurd'
  );

create policy "eigen recepten toevoegen" on recepten
  for insert to authenticated with check (user_id = auth.user_id());

create policy "eigen recepten wijzigen" on recepten
  for update to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

create policy "eigen recepten verwijderen" on recepten
  for delete to authenticated using (user_id = auth.user_id());

-- ------------------------------------------------ eigen rijen, per tabel

create policy "eigen rijen" on weekmenu_getoond
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

create policy "eigen rijen" on weekmenu_gekozen
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

create policy "eigen rijen" on gebruiker_voorkeuren
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

create policy "eigen rijen" on boodschappenlijst_item
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

create policy "eigen rijen" on push_token
  for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

-- ------------------------------------------------------ AH-productmapping

-- Iedereen leest, niemand schrijft via de API: het mappingscript draait met de
-- directe connectiestring en omzeilt RLS. Zo kan een client de tabel nooit
-- vervuilen.
create policy "iedereen leest de mapping" on ah_product_cache
  for select to authenticated using (true);

-- ----------------------------------------------------------------- grants

-- PostgREST kijkt naar tabelrechten *en* RLS. Zonder grants zie je niets,
-- ook al klopt je policy.
grant usage on schema public to authenticated;
grant select on recepten, ah_product_cache to authenticated;
grant insert, update, delete on recepten to authenticated;
grant select, insert, update, delete
  on weekmenu_getoond, weekmenu_gekozen, gebruiker_voorkeuren,
     boodschappenlijst_item, push_token, gebruiker
  to authenticated;

-- ------------------------------------------- gebruiker + voorkeuren aanmaken

-- De app roept dit één keer aan bij de eerste start. security definer, want de
-- gebruiker mag buiten deze route om niets in `gebruiker` inserten.
create function public.zorg_voor_gebruiker()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := auth.user_id();
begin
  if v_id is null then
    raise exception 'Geen geldige sessie';
  end if;

  insert into gebruiker (id) values (v_id) on conflict (id) do nothing;
  insert into gebruiker_voorkeuren (user_id) values (v_id) on conflict (user_id) do nothing;

  return v_id;
end;
$$;

grant execute on function public.zorg_voor_gebruiker() to authenticated;
