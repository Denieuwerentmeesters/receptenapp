-- Bespaard!: de bestelling van 1 oktober 2026 herstellen.
--
-- Die werd vastgelegd als 1 maaltijd, terwijl het mandje (€ 44,03) voor drie
-- maaltijden voor vier was. Daardoor stond er −€ 23 in plaats van een
-- besparing. Drie maaltijden voor vier is 3 × 4 × € 5,31 = € 63,72; de
-- bezorgkosten van de maaltijdbox telden die week al mee bij 29 september.
--
-- Achterwaarts veilig: één rij, geen schemawijziging. Nog een keer draaien
-- raakt niets, want daarna is maaltijden niet meer 1.

update bestelling
   set maaltijden = 3,
       maaltijdbox_kosten = 63.72
 where (besteld_op at time zone 'Europe/Amsterdam')::date = date '2026-10-01'
   and maaltijden = 1
   and personen = 4
   and mandje_kosten = 44.03;
