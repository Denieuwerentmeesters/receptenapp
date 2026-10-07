-- Recepten importeren: wat er bij een import wordt vastgelegd.
--
--   scan                 Eén rij per keer dat api/extraheer.ts een recept
--                        uitlas: welke bron, of het lukte en wat het kostte.
--                        Daarmee telt de functie een daglimiet tegen misbruik,
--                        en hier komt straks de teller van Pinch Plus uit.
--   recepten.bron_maker  De naam van de maker: het Instagram-account of de
--                        naam van de website. Op het receptscherm als
--                        bronvermelding, met de link in `url`.
--   recepten.scan_id     Welke scan dit recept opleverde (voor de kosten per
--                        opgeslagen recept). De app schrijft 'm bij het
--                        opslaan; de scan zelf is voor de app alleen leesbaar.
--
-- De functie schrijft `scan` met DATABASE_URL (zonder RLS); de app mag alleen
-- de eigen rijen lezen. Zo kan niemand zijn eigen teller wegpoetsen.

create table scan (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references gebruiker (id) on delete cascade,
  -- 'instagram', 'website', 'screenshot', 'kookboek', 'tekst'
  soort         text not null check (soort in ('instagram', 'website', 'screenshot', 'kookboek', 'tekst')),
  -- null bij foto's en tekst
  url           text,
  status        text not null check (status in ('gelukt', 'mislukt')),
  -- Telt mee voor de limiet: alleen een gelukte scan. Mislukt of geen recept
  -- gevonden kost de gebruiker niets.
  telt_mee      boolean not null default false,
  tokens_in     integer not null default 0,
  tokens_uit    integer not null default 0,
  -- Schatting in eurocenten: Claude, uitschrijven en de scraper samen.
  kosten_cent   numeric(8, 3) not null default 0,
  -- Waarom het misging, of welke route het nam ('onderschrift', 'video', …).
  toelichting   text,
  model         text,
  aangemaakt_op timestamptz not null default now()
);

create index scan_limiet on scan (user_id, aangemaakt_op);

alter table scan enable row level security;

create policy "eigen scans lezen" on scan
  for select to authenticated using (user_id = auth.user_id());

grant select on scan to authenticated;

-- --------------------------------------------------------------- recepten

alter table recepten add column bron_maker text;
alter table recepten add column scan_id uuid references scan (id) on delete set null;

comment on column recepten.bron_maker is
  'De maker van een geïmporteerd recept: het Instagram-account (@naam) of de naam van de website. Op het receptscherm als bronvermelding; de link staat in url.';
comment on column recepten.scan_id is
  'De scan (api/extraheer.ts) waar dit recept uit kwam; null bij de pool en bij recepten die je zelf typte.';

-- De url was uniek over alle recepten: de gescrapete pool is op bron-URL
-- gededupliceerd. Nu twee gebruikers hetzelfde recept kunnen importeren, is
-- de url uniek per gebruiker. `nulls not distinct`: de pool (user_id null)
-- blijft onderling uniek.
drop index if exists recepten_url_uniek;
create unique index recepten_url_uniek on recepten (user_id, url) nulls not distinct
  where url is not null;

-- Een geïmporteerd recept is van de maker, niet van jou om te herpubliceren:
-- het komt nooit in de gedeelde pool (plan, juridische keuzes). Zelfde vorm
-- als kookboek_altijd_prive en samengesteld_altijd_prive.
alter table recepten
  add constraint import_altijd_prive
    check (bron_type not in ('website', 'screenshot', 'instagram') or deel_status = 'prive');

-- Een screenshot kan net zo goed een kookboekpagina zijn: ook geen deellink,
-- zoals kookboek_geen_deellink. Een website- of Instagram-import wél: de
-- bereiding staat in eigen woorden en de maker staat erbij.
alter table recepten
  add constraint screenshot_geen_deellink
    check (bron_type <> 'screenshot' or deellink_sinds is null);
