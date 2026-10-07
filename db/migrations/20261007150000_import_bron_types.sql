-- Recepten importeren (plan "recepten importeren en Pinch Plus", fase 1 en 4):
-- een link van een website of Instagram, of een paar screenshots. Elke bron
-- krijgt een eigen bron_type, zodat het receptscherm weet wat het moet tonen
-- ("Recept van @account · Bekijk op Instagram") en de pool weet wat erbuiten
-- blijft.
--
-- Alleen de enum-waarden, net als 20261004100000_bron_samengesteld.sql:
-- Postgres laat een nieuwe waarde pas gebruiken nadat de transactie waarin
-- hij is toegevoegd klaar is. De tabel en de constraints staan in de volgende
-- migratie.

alter type bron_type add value if not exists 'website';
alter type bron_type add value if not exists 'screenshot';
alter type bron_type add value if not exists 'instagram';
