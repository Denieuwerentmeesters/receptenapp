-- Jumbo-koppeling (plan §4, fase 3): dezelfde vorm als ah_product_cache.
--
-- Jumbo's mandje-link wil SKU's als "641085STK" — een nummer plus een
-- verpakkingsachtervoegsel — dus text in plaats van integer.
--
-- Achterwaarts veilig: alleen een nieuwe tabel. De kolom
-- gebruiker_voorkeuren.voorkeurswinkel ('ah' | 'jumbo') bestond al.

create table if not exists jumbo_product_cache (
  ingredient_key      text primary key,
  weergavenaam        text,
  standaard_sku       text,
  bio_sku             text,
  laatst_geverifieerd timestamptz not null default now()
);

alter table jumbo_product_cache enable row level security;

-- Net als bij AH: iedereen leest, alleen de migraties (directe connectie,
-- buiten RLS) schrijven. Zo kan een client de mapping nooit vervuilen.
drop policy if exists "iedereen leest de mapping" on jumbo_product_cache;
create policy "iedereen leest de mapping" on jumbo_product_cache
  for select to authenticated using (true);

grant select on jumbo_product_cache to authenticated;
