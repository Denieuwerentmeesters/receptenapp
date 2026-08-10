-- Receptenapp — kernschema v1
-- Hoort bij docs/tech-stack.md §4 en docs/app-plan-weekmenu-en-ah.md §1, §2, §5.
--
-- Uitgangspunt: multi-user vanaf dag één, zonder inlogscherm. Elke tabel heeft
-- een user_id en RLS staat overal aan (zie 20260809000002_rls.sql). De gescrapete
-- pool krijgt user_id = null (= gedeeld), zodat de weekmenu-query vanaf het begin
-- "gedeelde pool + wat van mij is" is en niet later door de hele app heen
-- gecorrigeerd hoeft te worden.
--
-- user_id is text, niet uuid: het is het `sub`-claim uit de JWT en dat formaat
-- ligt bij de auth-provider, niet bij ons.

create type bron_type as enum ('scraper', 'kookboek_foto', 'eigen_input');
create type deel_status as enum ('prive', 'aangevraagd', 'goedgekeurd', 'afgewezen');
create type afbeelding_bron as enum ('gegenereerd', 'origineel_bron', 'kookboek_foto', 'eigen_foto');

-- ---------------------------------------------------------------- recepten

create table recepten (
  id                     uuid primary key default gen_random_uuid(),
  -- null = onderdeel van de gedeelde, gescrapete pool
  user_id                text references gebruiker (id) on delete cascade,
  titel                  text not null,
  titel_nl               text,
  bron                   text not null,
  -- null bij kookboek- en eigen recepten: een fysiek boek heeft geen URL
  url                    text,
  personen               integer not null default 4 check (personen > 0),
  bereidingstijd_minuten integer,
  keuken                 text,
  tags                   text[] not null default '{}',
  ingredienten           jsonb  not null default '[]',
  bereiding_nl           text[] not null default '{}',
  afbeelding_url         text,
  afbeelding_bron        afbeelding_bron,
  bron_type              bron_type   not null default 'scraper',
  deel_status            deel_status not null default 'prive',
  aangemaakt_op          timestamptz not null default now(),

  -- Kookboekrecepten mogen nooit gedeeld worden (plan §7.3) — hard afgedwongen,
  -- geen instelling die per ongeluk aan te zetten is.
  constraint kookboek_altijd_prive
    check (bron_type <> 'kookboek_foto' or deel_status = 'prive')
);

-- De gescrapete dataset is uniek op bron-URL; eigen recepten hebben er geen.
create unique index recepten_url_uniek on recepten (url) where url is not null;
create index recepten_pool on recepten (user_id, deel_status);
create index recepten_tags on recepten using gin (tags);
create index recepten_titel_zoek on recepten using gin (to_tsvector('dutch', titel));

-- ------------------------------------------------------------ weekmenu

create table weekmenu_getoond (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references gebruiker (id) on delete cascade,
  week_start_datum date not null,
  recept_id        uuid not null references recepten (id) on delete cascade,
  positie          integer not null,
  is_vegetarisch   boolean not null default false,
  unique (user_id, week_start_datum, recept_id)
);

create index weekmenu_getoond_week on weekmenu_getoond (user_id, week_start_datum);

create table weekmenu_gekozen (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references gebruiker (id) on delete cascade,
  week_start_datum date not null,
  recept_id        uuid not null references recepten (id) on delete cascade,
  gekozen_op       timestamptz not null default now(),
  gekookt_op       timestamptz,
  unique (user_id, week_start_datum, recept_id)
);

create index weekmenu_gekozen_week on weekmenu_gekozen (user_id, week_start_datum);

-- --------------------------------------------------------- voorkeuren

create table gebruiker_voorkeuren (
  user_id             text primary key references gebruiker (id) on delete cascade,
  favoriete_keukens   text[] not null default '{}',
  vega_minimum        integer not null default 6 check (vega_minimum between 0 and 10),
  max_bereidingstijd  integer,
  biologisch_voorkeur boolean not null default false,
  voorkeurswinkel     text not null default 'ah' check (voorkeurswinkel in ('ah', 'jumbo')),
  aantal_personen     integer not null default 4 check (aantal_personen > 0),
  pushbericht_aan     boolean not null default true,
  pushbericht_dag     integer not null default 0 check (pushbericht_dag between 0 and 6), -- 0 = zondag
  pushbericht_tijd    time    not null default '17:00',
  bijgewerkt_op       timestamptz not null default now()
);

-- ---------------------------------------------------- boodschappenlijst

create table boodschappenlijst_item (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references gebruiker (id) on delete cascade,
  week_start_datum date not null,
  naam             text not null,
  ingredient_key   text not null,
  hoeveelheid      numeric,
  eenheid          text,
  categorie        text,
  bron_type        text not null default 'recept' check (bron_type in ('recept', 'extra')),
  bron_recept_id   uuid references recepten (id) on delete set null,
  is_afgevinkt     boolean not null default false,
  aangemaakt_op    timestamptz not null default now()
);

create index boodschappen_week on boodschappenlijst_item (user_id, week_start_datum);

-- ------------------------------------------------------ AH-productmapping

-- Gedeelde lookup-tabel: geen user_id, iedereen leest, alleen de eigenaarsrol
-- schrijft (het mappingscript uit tech-stack §5 draait met de directe
-- connectiestring, niet via de Data API).
create table ah_product_cache (
  ingredient_key       text primary key,
  weergavenaam         text,
  standaard_product_id integer,
  bio_product_id       integer,
  laatst_geverifieerd  timestamptz not null default now()
);

-- ------------------------------------------------------------ push-tokens

-- Een rij per gebruiker per toestel — niet één veld in de instellingen.
create table push_token (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references gebruiker (id) on delete cascade,
  token         text not null,
  platform      text not null check (platform in ('ios', 'android')),
  laatst_gezien timestamptz not null default now(),
  unique (user_id, token)
);
