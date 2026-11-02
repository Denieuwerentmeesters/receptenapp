-- Kookmaatje Plus: wie meer dan 10 recepten door AI laat uitlezen betaalt € 3 per maand.
--
--   abonnement   Eén rij per gebruiker die (ooit) Plus had: tot wanneer het loopt
--                en via welk kanaal het binnenkwam. Alleen de server schrijft
--                (DATABASE_URL, zonder RLS), straks vanuit de webhook van de
--                betaalprovider. De app leest alleen de eigen rij, zodat
--                niemand zichzelf Plus kan geven.
--
-- Gratis telt `scan` met telt_mee (alleen gelukte scans, zie 20261007150001);
-- api/extraheer.ts weigert de elfde zonder lopend abonnement.

create table abonnement (
  user_id       text primary key references gebruiker (id) on delete cascade,
  -- Plus loopt tot dit moment; daarna telt de gratis limiet weer.
  loopt_tot     timestamptz not null,
  -- 'apple' (in-app aankoop), 'stripe' (website) of 'handmatig' (cadeau, test).
  kanaal        text not null check (kanaal in ('apple', 'stripe', 'handmatig')),
  -- Het id bij de provider, om een webhook aan de rij te koppelen.
  extern_id     text,
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);

alter table abonnement enable row level security;

create policy "eigen abonnement lezen" on abonnement
  for select to authenticated using (user_id = auth.user_id());

grant select on abonnement to authenticated;
