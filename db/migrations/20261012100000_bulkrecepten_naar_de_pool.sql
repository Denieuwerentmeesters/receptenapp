-- De recepten die in het begin in bulk zijn toegevoegd stonden op het account
-- van een admin, als 'eigen_input' of 'kookboek_foto'. Daardoor stonden ze bij die admin onder
-- "Mijn recepten" op Ontdekken, tussen wat hij echt zelf toevoegde. Ze horen
-- in de gedeelde pool: voor iedereen te zien en te gebruiken.
--
-- Zelfde vorm als de rest van de pool (user_id null, bron_type 'scraper',
-- deel_status 'goedgekeurd'), zie 20260929180000_hollandse_klassiekers.sql.
-- De slug-trigger geeft ze daarbij een naam in de link.
--
-- Wat meegaat: 'eigen_input' en 'kookboek_foto' van een admin zonder scan.
-- Alles wat sinds het importeren (20261007150001) via de app is toegevoegd
-- heeft een scan_id en blijft van de gebruiker.
--
-- De kookboekrecepten zijn een uitzondering op "kookboek blijft altijd privé"
-- (besluit Reinoud, 12 okt 2026), alleen voor deze eerste lading. De regel
-- zelf en de constraint kookboek_altijd_prive blijven: een kookboekfoto die
-- iemand in de app toevoegt blijft privé.
--
-- Wat blijft staan:
--   * website, screenshot, instagram: van de maker (import_altijd_prive);
--   * samengesteld: hoort bij een menu;
--   * een recept waarvan de bron-URL al in de pool staat: dat is een dubbele,
--     en de pool is uniek op url (recepten_url_uniek).
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
      and rc.bron_type in ('eigen_input', 'kookboek_foto')
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

  raise notice 'Naar de pool: %, overgeslagen als dubbele url: %', verplaatst, dubbel;
end;
$$;
