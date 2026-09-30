-- Bespaard!: wat de bonus je scheelde, als losse regel naast het hoofdgetal
-- (plan "gemak en bonus", onderdeel 5).
--
-- Vastgelegd op het moment dat je bevestigt dat je mandje aankwam: alleen voor
-- producten die zelf in de actie zaten, en alleen als je genoeg stuks kocht
-- (1 + 1 gratis: twee). Het hoofdgetal (maaltijdbox min mandje, in gewone
-- prijzen) verandert niet.
--
-- Achterwaarts veilig: één kolom met een default.

alter table bestelling
  add column if not exists bonus_voordeel numeric(8, 2) not null default 0;
