-- Controle bereiding ↔ ingrediënten (npm run stapaudit, PR #203): een stap noemt
-- olijfolie of boter, maar het product stond niet in de lijst. Aangevuld zonder
-- hoeveelheid ("naar smaak"), want die staat nergens in het recept.
-- Achterwaarts veilig: alleen een regel erbij; idempotent (slaat een recept
-- over waar het product al staat). ingredienten_en krijgt dezelfde regel,
-- zodat beide lijsten even lang blijven en de Engelse versie blijft werken.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Pasta met broccoli, mozzarella en citroen',                'olijfolie', 'olive oil'),
      ('Gegrilde asperges in kruiden-roomsaus',                    'olijfolie', 'olive oil'),
      ('Noedels met gewokte garnalen',                             'olijfolie', 'olive oil'),
      ('Salade met artisjok, linzen en geitenkaas',                'olijfolie', 'olive oil'),
      ('Moederdag ontbijtplank met kaas wentelteefjes',            'boter',     'butter'),
      ('Kabeljauw uit de pan met tomatensalsa',                    'boter',     'butter'),
      ('Kiptaart met een hoed van bladerdeeg',                     'boter',     'butter')
    ) as v(titel, naam, naam_en)
  loop
    update recepten
    set ingredienten = ingredienten
          || jsonb_build_array(jsonb_build_object('hoeveelheid', null, 'eenheid', null, 'naam', r.naam)),
        ingredienten_en = case
          when ingredienten_en is not null and jsonb_array_length(ingredienten_en) = jsonb_array_length(ingredienten)
          then ingredienten_en || jsonb_build_array(jsonb_build_object('eenheid', null, 'naam', r.naam_en))
          else ingredienten_en end
    where coalesce(titel_nl, titel) = r.titel
      and not exists (
        select 1 from jsonb_array_elements(ingredienten) i
        where i->>'naam' ilike '%' || r.naam || '%'
      );
  end loop;
end $$;
