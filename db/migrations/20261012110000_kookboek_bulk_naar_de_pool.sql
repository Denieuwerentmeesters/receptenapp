-- Vervolg op 20261012100000_bulkrecepten_naar_de_pool.sql: die zette alleen
-- 'eigen_input' van een admin in de pool. Een deel van de eerste lading stond
-- als 'kookboek_foto' op dat account en bleef dus onder "Mijn recepten" staan.
--
-- Die gaan ook naar de pool. Dat is een uitzondering op "kookboek blijft
-- altijd privé" (besluit Reinoud, 12 okt 2026), alleen voor deze eerste
-- lading. De regel zelf en de constraint kookboek_altijd_prive blijven: een
-- kookboekfoto die iemand in de app toevoegt blijft privé.
--
-- Zelfde afbakening als de vorige: van een admin, zonder scan. Alles wat
-- sinds het importeren (20261007150001) via de app is toegevoegd heeft een
-- scan_id en blijft van de gebruiker. Een recept waarvan de bron-URL al in de
-- pool staat is een dubbele en blijft staan (recepten_url_uniek).
--
-- Idempotent: na de eerste keer voldoet er niets meer aan.

do $$
declare
  r record;
  verplaatst int := 0;
  dubbel int := 0;
begin
  for r in
    select rc.id, rc.url
    from recepten rc
    join gebruiker g on g.id = rc.user_id
    where g.is_admin
      and rc.bron_type = 'kookboek_foto'
      and rc.scan_id is null
    order by rc.aangemaakt_op, rc.id
  loop
    if r.url is not null and exists (
      select 1 from recepten where user_id is null and url = r.url
    ) then
      dubbel := dubbel + 1;
      continue;
    end if;

    update recepten
    set user_id = null, bron_type = 'scraper', deel_status = 'goedgekeurd', deellink_sinds = null
    where id = r.id;
    verplaatst := verplaatst + 1;
  end loop;

  raise notice 'Kookboekrecepten naar de pool: %, overgeslagen als dubbele url: %', verplaatst, dubbel;
end;
$$;
