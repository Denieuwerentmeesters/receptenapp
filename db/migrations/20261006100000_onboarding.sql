-- Onboarding voor nieuwe gebruikers (plan "onboarding voor nieuwe gebruikers").
--
-- Achterwaarts veilig: een kolom erbij en een nieuwe tabel.
--
--   onboarding_klaar_op   Leeg zolang je de uitleg en de vijf vragen nog niet
--                         hebt gehad; de app stuurt je dan naar /welkom. Wie er
--                         al was krijgt nu een datum en merkt er niets van.
--   onboarding_event      Waar mensen afhaken en of de onboarding tot een
--                         eerste week leidt. De app schrijft, niemand leest
--                         via de app: uitlezen gaat met de hand in de database.

alter table gebruiker_voorkeuren
  add column if not exists onboarding_klaar_op timestamptz;

update gebruiker_voorkeuren set onboarding_klaar_op = now() where onboarding_klaar_op is null;

create table onboarding_event (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references gebruiker (id) on delete cascade,
  event         text not null check (event in (
    'onboarding_gestart', 'uitleg_overgeslagen', 'vraag_beantwoord',
    'vraag_overgeslagen', 'onboarding_klaar', 'week_gevuld_onboarding'
  )),
  -- Bij welke kaart, welke vraag, hoeveel recepten. Nooit het antwoord zelf:
  -- een allergie hoort hier niet te staan.
  extra         jsonb not null default '{}',
  aangemaakt_op timestamptz not null default now()
);

create index onboarding_event_per_event on onboarding_event (event, aangemaakt_op);

alter table onboarding_event enable row level security;

create policy "eigen events schrijven" on onboarding_event
  for insert to authenticated with check (user_id = auth.user_id());

grant insert on onboarding_event to authenticated;
