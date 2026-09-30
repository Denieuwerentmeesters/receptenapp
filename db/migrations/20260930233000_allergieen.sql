-- Allergieën: één keer instellen bij Instellingen, en dan overal.
--
-- allergeen_regel: patronen per allergeen, gematcht op de ingrediëntnaam
-- (allergeen_tekst: kleine letters, zonder accenten, zonder toelichting tussen
-- haakjes). 'bevat' is zeker (bloem, parmezaan, pinda's); 'mogelijk' is een
-- samengesteld product waarvan het etiket beslist (bouillon, currypasta,
-- pesto). Een 'bevat'-regel met een vervanger is te omzeilen: het recept
-- blijft in de pool en de boodschappenlijst krijgt de vervanger, zoals bij
-- vega. Alleen gluten en koemelk hebben vervangers.
--
-- De app leest dezelfde tabel en past dezelfde patronen toe (lib/allergenen.ts),
-- voor het blok op het receptscherm en de vervanger op de lijst. Houd de
-- patronen daarom simpel: alleen ^ $ ( | ) ? . — dat werkt gelijk in Postgres
-- en JavaScript. Geen \b: dat is in Postgres een backspace.
--
-- Geiten- en schapenkaas tellen mee als koemelk: bij een koemelkallergie
-- reageer je daar meestal ook op (kruisreactie). Selderij, mosterd, sulfiet,
-- weekdieren en lupine zitten er (nog) niet in.
--
-- recepten.allergenen          allergenen die er zeker in zitten
-- recepten.allergenen_vast     idem, zonder vervanger: die gaan uit de pool
-- recepten.allergenen_twijfel  alleen 'mogelijk': etiket checken
-- Een trigger houdt ze bij. Veranderen de regels, dan herreken je met
--   update recepten set ingredienten = ingredienten;
--
-- gebruiker_voorkeuren.allergieen: wat de gebruiker heeft. genereer_weekmenu
-- laat recepten weg die een van die allergenen vast bevatten; verder gelijk
-- aan 20260930220000.
--
-- Achterwaarts veilig: nieuwe tabel, kolommen met een default, dezelfde
-- functie-signatuur.

create table if not exists allergeen_regel (
  id           serial primary key,
  allergeen    text not null check (allergeen in (
                 'gluten', 'koemelk', 'ei', 'noten', 'pinda', 'vis', 'schaaldieren', 'soja', 'sesam')),
  patroon      text not null,
  -- Matcht dit ook, dan telt de regel niet (glutenvrije bloem, kokosmelk).
  uitzondering text,
  zekerheid    text not null check (zekerheid in ('bevat', 'mogelijk')),
  -- Wat er op de lijst komt in plaats van het origineel; null = geen vervanger.
  vervanger    text
);

alter table allergeen_regel enable row level security;

drop policy if exists "iedereen leest de allergeenregels" on allergeen_regel;
create policy "iedereen leest de allergeenregels" on allergeen_regel
  for select to authenticated using (true);

grant select on allergeen_regel to authenticated;

-- Spiegel van allergeenTekst() in app/src/lib/allergenen.ts. "(rijst)noedels"
-- wordt "rijstnoedels"; een losse toelichting "(of groentebouillon)" valt weg.
create or replace function public.allergeen_tekst(naam text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(unaccent(coalesce(naam, ''))), '\(([a-z]+)\)([a-z])', '\1\2', 'g'),
      '\([^)]*\)', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

alter table recepten
  add column if not exists allergenen         text[] not null default '{}',
  add column if not exists allergenen_vast    text[] not null default '{}',
  add column if not exists allergenen_twijfel text[] not null default '{}';

-- Geen security definer (zie CLAUDE.md): wie een eigen recept opslaat, leest
-- de regels via de select-grant hierboven.
create or replace function public.recept_allergenen_bijwerken()
returns trigger
language plpgsql
as $$
begin
  with ingredient as (
    select public.allergeen_tekst(e ->> 'naam') as t
    from jsonb_array_elements(coalesce(new.ingredienten, '[]'::jsonb)) e
  ),
  treffer as (
    select i.t, r.allergeen,
           bool_or(r.zekerheid = 'bevat') as bevat,
           bool_or(r.zekerheid = 'bevat' and r.vervanger is null) as vast
    from ingredient i
    join allergeen_regel r
      on i.t ~ r.patroon and (r.uitzondering is null or i.t !~ r.uitzondering)
    group by i.t, r.allergeen
  )
  select
    coalesce(array_agg(distinct allergeen order by allergeen) filter (where bevat), '{}'),
    coalesce(array_agg(distinct allergeen order by allergeen) filter (where vast), '{}'),
    coalesce(array_agg(distinct allergeen order by allergeen) filter (where not bevat), '{}')
  into new.allergenen, new.allergenen_vast, new.allergenen_twijfel
  from treffer;

  -- Zit het er in één ingrediënt zeker in, dan is "mogelijk" elders geen nieuws.
  new.allergenen_twijfel := array(
    select a from unnest(new.allergenen_twijfel) a where not a = any(new.allergenen) order by a);
  return new;
end;
$$;

drop trigger if exists recept_allergenen on recepten;
create trigger recept_allergenen
  before insert or update of ingredienten on recepten
  for each row execute function public.recept_allergenen_bijwerken();

insert into allergeen_regel (allergeen, patroon, uitzondering, zekerheid, vervanger) values
  ('gluten', 'bloem|meel', 'bloemkool|eetbare bloem|zonnebloem|rijstebloem|rijstmeel|maismeel|amandelmeel|kokosmeel|kikkererwtenmeel|boekweit|paneermeel|havermeel|maizena|glutenvrij', 'bevat', 'glutenvrije bloem'),
  ('gluten', 'paneermeel|panko|broodkruim', 'glutenvrij', 'bevat', 'glutenvrij paneermeel'),
  ('gluten', 'lasagne', 'pompoen lasagne|glutenvrij', 'bevat', 'glutenvrije lasagnebladen'),
  ('gluten', 'gnocchi', 'glutenvrij', 'bevat', 'glutenvrije gnocchi'),
  ('gluten', 'pasta|spaghetti|penne|tagliatelle|lasagne|macaroni|fusilli|farfalle|orzo|risoni|linguine|pappardelle|rigatoni|mafaldine|orecchiette|orechiette|conchigli|casarecce|vermicelli|gnocchi', 'currypasta|kruidenpasta|misopasta|tamarindepasta|ansjovispasta|pistachepasta|vanillepasta|tomatenpasta|sesampasta|knoflookpasta|gemberpasta|chilipasta|courgette spaghetti|rijstvermicelli|vermicellirijst|lasagne|gnocchi|glutenvrij', 'bevat', 'glutenvrije pasta'),
  ('gluten', 'tortellini|ravioli|cannelloni', 'glutenvrij', 'bevat', null),
  ('gluten', 'brood|ciabatta|focaccia|toast|boterham|brioche|croissant|crouton|(^| )pita|(^| )naan|flatbread|platbro|lahmacun', 'eekhoorntjesbrood|glutenvrij|croissantdeeg', 'bevat', 'glutenvrij brood'),
  ('gluten', 'wrap|tortilla|taco', 'mais|tortillachips|glutenvrij', 'bevat', 'glutenvrije wraps'),
  ('gluten', 'deeg|pasteibakje|gyoza|wonton|dumpling|bao', 'glutenvrij', 'bevat', null),
  ('gluten', 'couscous|bulgur|freekeh|parelgort|gerst|spelt|seitan|tarwe', 'glutenvrij|tarwewrap|tarwe tortilla|tarwebloem', 'bevat', null),
  ('gluten', '(^| )mie( |,|$)|mie-nest|noedel|ramen|udon|soba|bami', 'rijstnoedel|glasnoedel|soup base|soep basis|noedelsoep|glutenvrij', 'bevat', 'rijstnoedels'),
  ('gluten', 'sojasaus|shoyu', 'glutenvrij', 'bevat', 'tamari'),
  ('gluten', 'ketjap', 'glutenvrij', 'bevat', 'glutenvrije ketjap'),
  ('gluten', '(^| )(bok)?bier( |,|$)|donker bier', 'glutenvrij', 'bevat', 'glutenvrij bier'),
  ('gluten', 'havermout|havervlokken|havermeel', 'glutenvrij', 'bevat', 'glutenvrije havermout'),
  ('gluten', 'koek|kruidnoten|cracker|beschuit|cantuccini|oreo|tempura', 'glutenvrij', 'bevat', null),
  ('gluten', 'bouillon|(^| )fond|(^| )jus( |,|$)|soup base|soep basis|hoisin|oestersaus|teriyaki|worcester|hamburger( |,|$)|soup base|soep poeder', 'glutenvrij|hamburgerbro|voor de jus', 'mogelijk', null),
  ('koemelk', 'boter|ghee', 'plantaardig|pindaboter|notenboter|kokosboter|cacaoboter|boterham|boterbo|vegan', 'bevat', 'plantaardige boter'),
  ('koemelk', 'melk', 'kokosmelk|amandelmelk|sojamelk|havermelk|rijstmelk|plantaardig|melasse|melk naar keuze|melkchocolade|gecondenseerde', 'bevat', 'havermelk'),
  ('koemelk', 'gecondenseerde melk|melkchocolade|witte chocolade|chocolademousse', null, 'bevat', null),
  ('koemelk', 'pure chocolade', null, 'mogelijk', null),
  ('koemelk', 'zure room|creme fraiche', 'plantaardig', 'bevat', 'plantaardige creme fraiche'),
  ('koemelk', 'slagroom|kookroom|(^| )room( |,|$)', 'plantaardig|kokos|zure room', 'bevat', 'plantaardige kookroom'),
  ('koemelk', 'roomkaas|monchou|boursin|philadelphia', 'plantaardig', 'bevat', 'plantaardige roomkaas'),
  ('koemelk', 'yoghurt|kwark|skyr|labneh', 'plantaardig|kokosyoghurt|soja|haver', 'bevat', 'plantaardige yoghurt'),
  ('koemelk', 'parmezaan|parmigiano|grana padano', 'plantaardig', 'bevat', 'plantaardige parmezaan'),
  ('koemelk', 'feta', 'plantaardig', 'bevat', 'plantaardige feta'),
  ('koemelk', 'mozzarella', 'plantaardig', 'bevat', 'plantaardige mozzarella'),
  ('koemelk', 'kaas|cheddar|gouda|emmental|gruyere|comte|pecorino|manchego|gorgonzola|brie( |,|$)|camembert|reblochon|raclette|tete de moine|stilton|roquefort|appenzeller|kaltbach', 'pindakaas|plantaardig|vegan|roomkaas|cottage|feta|mozzarella|parmezaan|geitenkaas|kaascrouton', 'bevat', 'plantaardige geraspte kaas'),
  ('koemelk', 'geitenkaas|cottage cheese|halloumi|burrata|stracciatella|ricotta|mascarpone|(^| )paneer( |,|$)|kaascrouton|tortellini|ravioli|brioche|croissantdeeg|chocolademelk', 'plantaardig', 'bevat', null),
  ('koemelk', 'pesto|bladerdeeg|(^| )naan', 'plantaardig|vegan', 'mogelijk', null),
  ('ei', '(^| )(ei|eieren|eidooiers?|eigeel|eiwitten?)( |,|$)|eiernoedel|mayo|aioli|kewpie|brioche|meringue|hollandaise', 'vegan', 'bevat', null),
  ('ei', 'tagliatelle|pappardelle|tortellini|ravioli|verse lasagne|verse pasta|(^| )mie( |,|$)|mie-nest|brede mie', 'eivrij|vegan', 'bevat', null),
  ('ei', 'lasagne|noedel|ramen', 'rijstnoedel|glasnoedel|udon|soba|pompoen lasagne|eivrij', 'mogelijk', null),
  ('noten', 'amandel|cashew|walno|pecan|pistache|hazelno|macadamia|kemirino|(^| )noten|notenbrood|dukkah|marsepein|spijs|praline|nougat|frangipane', 'nootmuskaat', 'bevat', null),
  ('noten', 'pesto', null, 'mogelijk', null),
  ('pinda', 'pinda|arachide|satesaus|(^| )sate(h)?( |,|$)|gado', null, 'bevat', null),
  ('vis', '(^| )vis|witvis|zalm|tonijn|kabeljauw|ansjovis|sardine|sardien|makreel|forel|pangasius|tilapia|koolvis|(^| )heek|(^| )schol|zeebaars|dorade|haring|paling|kaviaar|viskuit|bonito|katsuobushi|dashi|surimi|bacalao|stokvis|zeeduivel|snoekbaars|wijting|bokking|worcester', null, 'bevat', null),
  ('vis', 'currypasta|curry kruidenpasta|curry pasta', 'balti|butter chicken|tikka|korma|madras', 'mogelijk', null),
  ('schaaldieren', 'garnal|gamba|kreeft|krabvlees|(^| )krab( |,|$)|langoust|scampi|trassi|terasi|kroepoek|shrimp', null, 'bevat', null),
  ('schaaldieren', 'currypasta|curry kruidenpasta|curry pasta', 'balti|butter chicken|tikka|korma|madras', 'mogelijk', null),
  ('soja', 'soja|ketjap|miso|tofu|tempeh|(^| )tempe( |,|$)|edamame|tamari|teriyaki|shoyu|kikkoman|natto|hoisin', 'tamarinde|sojascheut', 'bevat', null),
  ('sesam', 'sesam|tahin|furikake|dukkah|za.?atar|hummus|gomasio|halva', null, 'bevat', null);

-- Bestaande recepten vullen.
update recepten set ingredienten = ingredienten;

alter table gebruiker_voorkeuren
  add column if not exists allergieen text[] not null default '{}'
    check (allergieen <@ array[
      'gluten', 'koemelk', 'ei', 'noten', 'pinda', 'vis', 'schaaldieren', 'soja', 'sesam']::text[]);

create or replace function public.genereer_weekmenu(
  p_user_id text,
  p_week_start date default public.week_start(),
  p_aantal integer default 10
)
returns integer
language plpgsql
as $$
declare
  v_vega_minimum       integer;
  v_max_bereidingstijd integer;
  v_favoriete_keukens  text[];
  v_winkel             text;
  v_zelf_halen         boolean;
  v_allergieen         text[];
  v_peil               date;
  v_vega_aantal        integer;
  v_geplaatst          integer;
begin
  if exists (
    select 1 from weekmenu_getoond
    where user_id = p_user_id and week_start_datum = p_week_start
  ) then
    return 0;
  end if;

  select vega_minimum, max_bereidingstijd, favoriete_keukens, voorkeurswinkel, zelf_halen, allergieen
    into v_vega_minimum, v_max_bereidingstijd, v_favoriete_keukens, v_winkel, v_zelf_halen, v_allergieen
  from gebruiker_voorkeuren where user_id = p_user_id;

  if not found then
    v_vega_minimum := 6; v_favoriete_keukens := '{}'; v_winkel := 'ah'; v_zelf_halen := false;
    v_allergieen := '{}';
  end if;

  -- Zelf halen: de bonus van vandaag. Anders de eerste bezorgdag: morgen, en
  -- valt morgen op zondag, dan maandag.
  v_peil := case
    when v_zelf_halen then current_date
    else current_date + case when extract(dow from current_date + 1) = 0 then 2 else 1 end
  end;
  v_peil := greatest(v_peil, p_week_start);

  v_vega_aantal := least(v_vega_minimum, p_aantal);

  with beschikbaar as (
    select r.id, r.tags, r.keuken,
           exists (select 1 from favoriet f where f.user_id = p_user_id and f.recept_id = r.id) as is_favoriet,
           exists (select 1 from recept_bonus b
                   where b.recept_id = r.id and b.winkel = v_winkel
                     and v_peil between b.geldig_van and b.geldig_tot) as in_bonus
    from recepten r
    where
      (r.user_id is null or r.user_id = p_user_id or r.deel_status = 'goedgekeurd')
      -- Een allergeen zonder vervanger: niet in je weekmenu.
      and not (r.allergenen_vast && v_allergieen)
      and (v_max_bereidingstijd is null
           or r.bereidingstijd_minuten is null
           or r.bereidingstijd_minuten <= v_max_bereidingstijd)
      and not exists (
        select 1 from weekmenu_gekozen g
        where g.user_id = p_user_id and g.recept_id = r.id
          and g.week_start_datum > p_week_start - interval '26 weeks'
      )
      and not exists (
        select 1 from weekmenu_getoond t
        where t.user_id = p_user_id and t.recept_id = r.id
          and t.week_start_datum > p_week_start - interval '4 weeks'
      )
  ),
  gewogen as (
    select
      id,
      ('vegetarisch' = any(tags)) as vega,
      power(
        random(),
        1.0 / (
          case when keuken = any(v_favoriete_keukens) then 3.0::double precision else 1.0 end
          * case when is_favoriet then 3.0::double precision else 1.0 end
          * case when in_bonus then 2.0::double precision else 1.0 end
        )
      ) as score
    from beschikbaar
  ),
  gekozen_vega as (
    select id, score from gewogen where vega order by score desc limit v_vega_aantal
  ),
  gekozen_vrij as (
    select id, score from gewogen
    where id not in (select id from gekozen_vega)
    order by score desc
    limit p_aantal - (select count(*) from gekozen_vega)
  ),
  alles as (
    select id, score from gekozen_vega
    union all
    select id, score from gekozen_vrij
  ),
  invoer as (
    insert into weekmenu_getoond (user_id, week_start_datum, recept_id, positie, is_vegetarisch)
    select
      p_user_id, p_week_start, a.id,
      row_number() over (order by a.score desc),
      'vegetarisch' = any(r.tags)
    from alles a join recepten r on r.id = a.id
    returning 1
  )
  select count(*) into v_geplaatst from invoer;

  return v_geplaatst;
end;
$$;

grant execute on function public.genereer_weekmenu(text, date, integer) to authenticated;
