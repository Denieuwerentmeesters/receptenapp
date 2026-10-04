-- "Zelf samenstellen": een menu dat Claude op verzoek maakt (keuken, aantal
-- personen, wensen). De recepten daaruit krijgen een eigen bron_type.
--
-- Bewust een migratie met alleen dit: Postgres laat een nieuwe enum-waarde pas
-- gebruiken nadat de transactie waarin hij is toegevoegd klaar is. De tabel,
-- de constraint en de generator die de waarde noemen staan daarom in de
-- volgende migratie.

alter type bron_type add value if not exists 'samengesteld';
