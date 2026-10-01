-- Dieetfilters: naast vegetarisch ook vegan, pescotarisch, koolhydraatarm en
-- keto. Vegetarisch blijft de tag; de andere vier leidt een trigger af uit de
-- ingrediënten en zet ze in recepten.dieet.
--
-- vegan           de tag 'vegetarisch', en geen zuivel, ei, honing of gelatine
-- pescotarisch    vegetarisch, of vis/schaaldieren zonder vlees
-- koolhydraatarm  geschat hooguit 25 g koolhydraten per persoon
-- keto            geschat hooguit 12 g koolhydraten per persoon
--
-- Zuivel, ei en vis komen uit allergeen_regel (20260930233000): dezelfde
-- patronen, dus één plek om ze bij te houden. Voor vegan telt ook 'mogelijk'
-- (pesto, bladerdeeg): bij twijfel niet vegan. dieet_regel vult aan met vlees,
-- weekdieren, honing/gelatine en de koolhydraatbronnen.
--
-- De koolhydraten zijn een schatting, geen voedingswaardetabel: per
-- ingrediënt de eerste koolhydraatregel die matcht (laagste volgorde), gram
-- maal kh_per_100, gedeeld door het aantal personen. Wat geen regel heeft
-- telt als nul; daarom staan ook groenten en zuivel erin, anders valt keto te
-- ruim uit. Noemt een recept geen hoeveelheid ("rijst, voor erbij"), dan
-- rekenen we portie_gram per persoon.
--
-- Zelfde afspraak als bij de allergenen: patronen simpel houden (^ $ ( | ) ? .),
-- en na een wijziging herrekenen met
--   update recepten set ingredienten = ingredienten;
--
-- Achterwaarts veilig: nieuwe tabel, nieuwe kolommen met een default.

create table if not exists dieet_regel (
  id            serial primary key,
  soort         text not null check (soort in ('vlees', 'vis', 'dierlijk', 'koolhydraat')),
  -- Bij meer treffers op één ingrediënt wint de laagste: specifiek vóór algemeen.
  volgorde      integer not null default 100,
  patroon       text not null,
  uitzondering  text,
  -- Alleen bij 'koolhydraat':
  kh_per_100    numeric,  -- gram koolhydraten per 100 gram
  gram_per_stuk numeric,  -- "2 stuks" of een hoeveelheid zonder eenheid
  portie_gram   numeric   -- per persoon, als het recept geen hoeveelheid noemt
);

alter table dieet_regel enable row level security;

drop policy if exists "iedereen leest de dieetregels" on dieet_regel;
create policy "iedereen leest de dieetregels" on dieet_regel
  for select to authenticated using (true);

grant select on dieet_regel to authenticated;

alter table recepten
  add column if not exists dieet           text[] not null default '{}',
  add column if not exists koolhydraten_pp numeric(6, 1);

-- "1/2", "1 1/2", "2-3" (het midden), "50 + 20" (de som), "1,5", "¼".
-- Onleesbaar of leeg: null.
create or replace function public.hoeveelheid_getal(h text)
returns numeric
language plpgsql
immutable
as $$
declare
  t      text;
  deel   text;
  m      text[];
  totaal numeric := 0;
  iets   boolean := false;
begin
  if h is null then return null; end if;
  t := replace(replace(replace(replace(h, ',', '.'), '½', ' 1/2'), '¼', ' 1/4'), '¾', ' 3/4');
  foreach deel in array string_to_array(t, '+') loop
    deel := trim(deel);
    m := regexp_match(deel, '^([0-9]+(\.[0-9]+)?) *- *([0-9]+(\.[0-9]+)?)');
    if m is not null then
      totaal := totaal + (m[1]::numeric + m[3]::numeric) / 2; iets := true; continue;
    end if;
    m := regexp_match(deel, '^([0-9]+) +([0-9]+)/([1-9][0-9]*)');
    if m is not null then
      totaal := totaal + m[1]::numeric + m[2]::numeric / m[3]::numeric; iets := true; continue;
    end if;
    m := regexp_match(deel, '^([0-9]+)/([1-9][0-9]*)');
    if m is not null then
      totaal := totaal + m[1]::numeric / m[2]::numeric; iets := true; continue;
    end if;
    m := regexp_match(deel, '^([0-9]+(\.[0-9]+)?)');
    if m is not null then
      totaal := totaal + m[1]::numeric; iets := true;
    end if;
  end loop;
  if not iets then return null; end if;
  return totaal;
end;
$$;

-- Hoeveel gram een ingrediëntregel ongeveer is, voor het hele recept.
create or replace function public.ingredient_gram(
  h text, eenheid text, gram_per_stuk numeric, portie_gram numeric, personen integer
)
returns numeric
language plpgsql
immutable
as $$
declare
  n numeric := public.hoeveelheid_getal(h);
  e text := lower(trim(coalesce(eenheid, '')));
begin
  if n is null or n = 0 then
    return coalesce(portie_gram, 0) * personen;
  end if;
  return case
    when e in ('g', 'gr', 'gram', 'ml') then n
    when e in ('kg', 'kilo', 'l', 'ltr', 'liter') then n * 1000
    when e = 'dl' then n * 100
    when e in ('el', 'eetlepel', 'eetlepels', 'soeplepel') then n * 15
    when e in ('tl', 'theelepel', 'theelepels') then n * 5
    when e in ('snuf', 'snufje', 'mespunt', 'kneepje', 'paar druppels') then 0
    when e in ('scheutje', 'shot') then n * 20
    when e like 'blik%' then n * 400
    when e in ('pot', 'pak', 'pakje', 'pakjes', 'zak', 'zakken', 'doos', 'fles') then n * 300
    when e in ('rol', 'rollen') then n * 270
    when e = 'glas' then n * 200
    when e in ('snee', 'sneden', 'sneetjes', 'plakjes', 'plakken', 'vel', 'vellen') then n * 35
    when e in ('hand', 'handje', 'handjes', 'handvol') then n * 30
    else n * coalesce(gram_per_stuk, 0)
  end;
end;
$$;

-- Geen security definer (zie CLAUDE.md): wie een eigen recept opslaat, leest
-- de regels via de select-grants.
create or replace function public.recept_dieet_bijwerken()
returns trigger
language plpgsql
as $$
declare
  v_personen integer := greatest(coalesce(new.personen, 4), 1);
  v_vlees    boolean;
  v_vis      boolean;
  v_dierlijk boolean;
  v_vega     boolean := 'vegetarisch' = any(coalesce(new.tags, '{}'));
  v_kh       numeric;
begin
  with ingredient as (
    select ord,
           public.allergeen_tekst(e ->> 'naam') as t,
           e ->> 'hoeveelheid' as h,
           e ->> 'eenheid' as eenheid
    from jsonb_array_elements(coalesce(new.ingredienten, '[]'::jsonb)) with ordinality as x(e, ord)
  ),
  treffer as (
    select i.ord, r.soort
    from ingredient i
    join dieet_regel r
      on i.t ~ r.patroon and (r.uitzondering is null or i.t !~ r.uitzondering)
    where r.soort <> 'koolhydraat'
    union all
    -- Zuivel en ei tellen ook bij 'mogelijk'; vis alleen als het er zeker in zit.
    select i.ord,
           case when r.allergeen in ('vis', 'schaaldieren') then 'vis' else 'dierlijk' end
    from ingredient i
    join allergeen_regel r
      on i.t ~ r.patroon and (r.uitzondering is null or i.t !~ r.uitzondering)
    where r.allergeen in ('koemelk', 'ei')
       or (r.allergeen in ('vis', 'schaaldieren') and r.zekerheid = 'bevat')
  ),
  koolhydraat as (
    select distinct on (i.ord)
           public.ingredient_gram(i.h, i.eenheid, r.gram_per_stuk, r.portie_gram, v_personen)
             * r.kh_per_100 / 100 as kh
    from ingredient i
    join dieet_regel r
      on r.soort = 'koolhydraat'
     and i.t ~ r.patroon and (r.uitzondering is null or i.t !~ r.uitzondering)
    order by i.ord, r.volgorde, r.id
  )
  select
    exists (select 1 from treffer where soort = 'vlees'),
    exists (select 1 from treffer where soort = 'vis'),
    exists (select 1 from treffer where soort = 'dierlijk'),
    coalesce((select sum(kh) from koolhydraat), 0) / v_personen
  into v_vlees, v_vis, v_dierlijk, v_kh;

  -- Zonder ingrediënten valt er niets te schatten: dan ook geen label.
  if jsonb_array_length(coalesce(new.ingredienten, '[]'::jsonb)) = 0 then
    new.koolhydraten_pp := null;
    new.dieet := '{}';
    return new;
  end if;

  new.koolhydraten_pp := round(v_kh, 1);
  new.dieet := array_remove(array[
    case when v_vega and not v_vlees and not v_vis and not v_dierlijk then 'vegan' end,
    case when (v_vega and not v_vlees and not v_vis) or (v_vis and not v_vlees) then 'pescotarisch' end,
    case when v_kh <= 25 then 'koolhydraatarm' end,
    case when v_kh <= 12 then 'keto' end
  ], null);
  return new;
end;
$$;

drop trigger if exists recept_dieet on recepten;
create trigger recept_dieet
  before insert or update of ingredienten, tags, personen on recepten
  for each row execute function public.recept_dieet_bijwerken();

insert into dieet_regel (soort, volgorde, patroon, uitzondering, kh_per_100, gram_per_stuk, portie_gram) values
  -- Vlees. Telt alleen mee voor pescotarisch (een visgerecht met spekjes) en
  -- als vangnet onder de tag 'vegetarisch'.
  ('vlees', 100, 'kip|kalkoen|(^| )eend|eendenb|rund|biefstuk|entrecote|rosbief|kalfs|varken|spek|bacon|pancetta|(^| )(parma|serrano|been|achter|schouder|kook)?ham( |,|$)|hamblokjes|hamreepjes|worst|chorizo|salami|(^| )lam( |,|$)|(^| )lams|schnitzel|shoarma|gyros|kebab|burger|filet americain|carpaccio|sukade|riblap|rib-?eye|vlees|sparerib|procureur|haas( |,|$)|haasje|konijn|(^| )hert|fazant|parelhoen|kwartel|nduja|prosciutto|guanciale|mortadella|saucijs|merguez|fricandeau|rollade|kotelet|karbonade|cordon bleu|ossenstaart|(^| )pate( |,|$)|reuzel|ganzenvet|eendenvet|bresaola|coppa|(^| )steak|tartaar|gehaktbal|^gehakt( |,|$)|half.om.half|drumstick|kalf', 'bouillon|(^| )fond|eikhaas|serundeng|kruiden|vega|vegetarisch|plantaardig|vleestomat|krabvlees|kreeftenvlees|kokosvlees|vruchtvlees|groenteburger|bonenburger|visburger|zalmburger|burgersaus|tonijnsteak|zalmsteak|bloemkoolsteak|kippenei|hamburgerbro|burgerbro', null, null, null),
  -- Weekdieren staan niet bij de allergenen.
  ('vis', 100, 'inktvis|octopus|calamar|mossel|kokkel|vongole|oesters?( |,|$)|coquille|sint.?jakob|zeevruchten|fruits de mer|vissaus|oestersaus', null, null, null, null),
  ('dierlijk', 100, 'honing|gelatine', 'vegan|plantaardig', null, null, null),

  -- Koolhydraten. Eerst wat op een zetmeelbron lijkt maar het niet is.
  ('koolhydraat', 10, 'bloemkoolrijst|broccolirijst|courgetti|courgette spaghetti|konjac|shirataki|pompoen lasagne|spaghettipompoen', null, 3, 400, null),
  ('koolhydraat', 10, 'rijstazijn|rijstwijnazijn|rijstolie|appelazijn|appelciderazijn|ciderazijn|appelkappertjes|paprikapoeder|uienpoeder|knoflookpoeder|suikervrij|amandelmeel|kokosmeel|zonnebloem|eetbare bloem|pompoenpit|pijnboompit|roomboter|kokosolie|broodkruid|kipkruiden|rijstkruiden|pastakruiden|aardappelkruiden', null, 0, null, null),
  ('koolhydraat', 10, 'currypasta|kruidenpasta|misopasta|tamarindepasta|ansjovispasta|sesampasta|knoflookpasta|gemberpasta|chilipasta|harissa|sambal|boemboe|curry pasta|curry kruidenpasta', null, 10, 15, null),
  ('koolhydraat', 10, 'tomatenpuree|tomatenpasta|tomatenketchup', null, 15, 15, null),
  ('koolhydraat', 10, 'zongedroogde tomaat|zongedroogde tomaten|gedroogde tomaat|gedroogde tomaten', null, 25, 8, null),
  ('koolhydraat', 10, 'cherry|kerstomat|snoeptomat|trostomaatjes|tomaatjes', null, 4, 15, null),
  ('koolhydraat', 10, 'sperziebonen|haricot|snijbonen|boontjes|peultjes|sugarsnap|suikererwt|taug|kousenband', null, 4, 10, null),
  ('koolhydraat', 10, 'zoete aardappel|bataat', null, 20, 250, 200),
  ('koolhydraat', 10, 'maizena|zetmeel|custard|arrowroot', null, 85, null, null),
  ('koolhydraat', 10, 'gekookte rijst|voorgekookte rijst|rijst van gisteren|gekookte pasta|gekookte noedels|gekookte quinoa|gekookte linzen', null, 28, null, 180),
  ('koolhydraat', 10, 'rijstpapier|rijstvel', null, 80, 10, null),
  ('koolhydraat', 10, 'spliterwt', null, 50, null, null),
  ('koolhydraat', 10, 'gedroogde (abrikozen|vijgen|pruimen|cranberr|dadels)|dadel|rozijn|krent|cranberr', null, 65, 8, null),
  ('koolhydraat', 10, 'chocola|cacao', null, 50, null, null),
  ('koolhydraat', 10, 'tortillachips|nacho|chips|kroepoek', null, 60, 2, null),
  ('koolhydraat', 10, 'gnocchi', null, 33, null, 200),
  ('koolhydraat', 10, 'bosui|lente.?ui|bosuitjes', null, 5, 15, null),

  -- Zetmeel.
  ('koolhydraat', 20, 'noedel|(^| )mie( |,|$)|mie-nest|ramen|udon|soba|bami|mihoen|vermicelli', null, 70, 60, 75),
  ('koolhydraat', 20, 'pasta|spaghetti|fettuccine|penne|tagliatelle|lasagne|macaroni|fusilli|farfalle|orzo|risoni|linguine|pappardelle|rigatoni|mafaldine|orecchiette|orechiette|conchigli|casarecce|tortellini|ravioli|cannelloni', null, 65, 20, 80),
  ('koolhydraat', 20, 'rijst|risotto|arborio|basmati|pandan', null, 78, null, 75),
  ('koolhydraat', 20, 'couscous|bulgur|freekeh|parelgort|gerst|spelt|quinoa|polenta|griesmeel|haver|farro|boekweit|cornflakes', 'havermelk|haverroom', 65, null, 70),
  ('koolhydraat', 20, 'aardappel|kriel|friet|frites|patat|rosti', null, 17, 150, 200),
  ('koolhydraat', 20, 'wrap|tortilla|taco', null, 50, 60, 60),
  ('koolhydraat', 20, 'ciabatta|focaccia|baguette|stokbrood', null, 48, 300, 60),
  ('koolhydraat', 20, 'brood|toast|boterham|brioche|croissant|crouton|pita|(^| )naan|flatbread|platbro|paratha|chapati|bagel|bolletje|(^| )buns?( |,|$)|pistolet|(^| )roti( |,|$)|beschuit|cracker', 'eekhoorntjesbrood|deeg', 48, 60, 60),
  ('koolhydraat', 20, 'deeg|pizzabodem|gyoza|wonton|dumpling|(^| )bao|pasteibakje|loempiavel', null, 40, 45, null),
  ('koolhydraat', 20, 'bloem|meel|panko|broodkruim', 'bloemkool', 72, null, null),

  -- Suiker en zoete sauzen.
  ('koolhydraat', 30, 'suiker|honing|siroop|stroop|agave|(^| )jam( |,|$)|marmelade|chutney|gelei|maple', null, 80, null, 5),
  ('koolhydraat', 30, 'ketjap|kecap|hoisin|sweet chili|chilisaus|zoete chili|teriyaki|ketchup|bbq.?saus|barbecuesaus|oestersaus|mirin|balsamico.?(crem|glaze|stroop)|appelmoes|satesaus|pindasaus|zoetzure|zoetezure', null, 35, null, 10),

  -- Peulvruchten, maïs, fruit, noten.
  ('koolhydraat', 40, 'linzen', null, 40, null, null),
  ('koolhydraat', 40, 'kikkererwt|bonen|kidney|cannellini|borlotti', 'sojabonen|tuinbonen|bonenkruid|koffiebonen', 15, 400, null),
  ('koolhydraat', 40, 'erwt|tuinbonen|edamame|sojabonen', null, 9, null, null),
  ('koolhydraat', 40, '(^| )mais|suikermais|maiskolf', null, 17, 200, null),
  ('koolhydraat', 40, 'appel|(^| )peer( |,|$)|(^| )peren( |,|$)|mango|banaan|ananas|druiven|vijg|abrikoos|abrikozen|perzik|nectarine|mandarijn|pruim|(^| )kersen|bessen|aardbei', null, 13, 150, null),
  ('koolhydraat', 40, 'cashew|kastanje', null, 25, null, 15),
  ('koolhydraat', 40, 'pinda|amandel|walno|pecan|pistache|hazelno|(^| )noten', null, 10, null, 15),

  -- Groente en zuivel: per stuk weinig, maar samen te veel voor keto.
  ('koolhydraat', 50, '(^| )(ui|uien|uitjes|uiringen|sjalot|sjalotten|sjalotjes)( |,|$)', null, 7, 100, null),
  ('koolhydraat', 50, 'wortel|winterpeen|(^| )peen|bospeen|pastinaak|knolselderij|(^| )biet|bieten|bietjes|koolraap', null, 7, 150, null),
  ('koolhydraat', 50, 'pompoen|butternut', null, 7, 800, null),
  ('koolhydraat', 50, 'tomaat|tomaten|passata', null, 4, 100, null),
  ('koolhydraat', 50, 'paprika|puntpaprika', null, 5, 150, null),
  ('koolhydraat', 50, 'prei|courgette|aubergine|broccoli|bloemkool|champignon|paddenstoel|venkel|spitskool|witte kool|rode kool|boerenkool|paksoi|asperge|spruit', null, 3, 250, null),
  ('koolhydraat', 50, 'melk|yoghurt|kwark|(^| )room( |,|$)|kookroom|slagroom|creme fraiche|ricotta|cottage', null, 4, null, null),
  ('koolhydraat', 50, '(^| )(port|marsala|madeira|sherry)( |,|$)', null, 12, null, null);

-- Bestaande recepten vullen.
update recepten set ingredienten = ingredienten;
