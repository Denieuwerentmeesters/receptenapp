-- Receptenapp op Neon — gebruikersfundament.
--
-- Supabase leverde auth.users en auth.uid() kant-en-klaar. Op Neon komt de
-- identiteit uit de JWT die de Data API meekrijgt: het `sub`-claim is te lezen
-- via auth.user_id(). We houden daarnaast een eigen `gebruiker`-tabel bij, zodat
-- foreign keys ergens naartoe wijzen en we per gebruiker iets kunnen opslaan.
--
-- Zet de Data API aan op de branch en koppel je auth-provider vóór je dit draait.

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- Rollen die de Neon Data API gebruikt. Bestaan ze al, dan slaan we ze over.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anonymous') then
    create role anonymous nologin;
  end if;
end $$;

create table gebruiker (
  -- Gelijk aan het `sub`-claim uit de JWT.
  id            text primary key,
  aangemaakt_op timestamptz not null default now()
);

alter table gebruiker enable row level security;

create policy "eigen gebruiker" on gebruiker
  for all to authenticated
  using (id = auth.user_id())
  with check (id = auth.user_id());
