# Receptenapp

Receptenapp voor Reinoud. Kernflow: **weekmenu → recept → boodschappenlijst → AH-mandje.**
Elke week 10 recepten uit een pool van 475 hoofdgerechten, jij kiest wat je kookt,
de ingrediënten stromen samengevoegd door naar je Albert Heijn-mandje.

Nederlands is de voertaal — in de UI, in de code (variabelen, functienamen) en in
commentaar. Houd dat aan.

## Waar wat staat

```
api/extraheer.ts     Serverless functie (Vercel) die recepten uitleest met Claude:
                     link (website, Instagram), screenshots, kookboekfoto, tekst
lib/extractie/       Website (JSON-LD), Instagram (Apify), uitschrijven (OpenAI),
                     prompt en kostenschatting voor api/extraheer.ts
api/samenstellen.ts  Stelt met Claude een menu samen (Zelf samenstellen)
api/afbeeldingen.ts  Nachtelijke cron (Vercel) die nieuwe recepten een afbeelding geeft
lib/afbeeldingen/    Prompt-opbouw en generatie van receptafbeeldingen (gedeeld door
                     api/afbeeldingen.ts en scripts/genereer_afbeeldingen.ts)
app/                 React 19 + Vite + TypeScript + Capacitor 8 (iOS)
  src/ds/            Design system uit Claude Design: tokens + componenten
  src/screens/       Weekmenu, Recept, Boodschappen, Instellingen, Inloggen, Onboarding
  src/lib/           auth, db, queries, schaal, ah, week, config, fouten
db/migrations/       SQL, op volgorde, gedraaid via scripts/migrate.py
scripts/             migrate, import_recepten, ah_mapping, laad_ah_mapping,
                     jumbo_mapping, jumbo_prijzen, jumbo_verpakkingen, ah_verpakkingen,
                     genereer_afbeeldingen (TypeScript, via `npm run afbeeldingen`)
data/recepten.json   581 gescrapete recepten (archief na import; `titel_bron` is de
                     oorspronkelijke titel, `titel`/`titel_nl` onze eigen naam)
data/ah_mapping.json ingrediënt → AH-productnummer
docs/                app-plan, tech-stack, setup, foodfotografie-prompt
```

De root heeft een eigen `package.json` voor de serverless functies en de
TypeScript-scripts (sharp, @vercel/blob, @neondatabase/serverless). Vercel
installeert die vóór de app (`installCommand` in vercel.json).

## Stack — en waar die afwijkt van docs/tech-stack.md

Het plan ging uit van Supabase met anonieme auth. Dat is niet gelukt:

- **Database is Neon**, niet Supabase — de Supabase-org zat op de limiet van
  twee actieve gratis projecten.
- **API is de Neon Data API** (PostgREST) via `@neondatabase/postgrest-js`.
  Dezelfde `.from().select()`-vorm als supabase-js.
- **Auth is Neon Auth met e-mail + wachtwoord.** Neon's Managed Better Auth
  ondersteunt de anonymous-plugin niet, en Email OTP staat er niet bij; alleen
  Magic Link, Phone en e-mail/wachtwoord. Magic link zou op iOS Universal Links
  vragen — te veel gedoe voor de winst.
- **RLS gebruikt `auth.user_id()`**, niet `auth.uid()`.
- **De weekmenu-generator is een plpgsql-functie**, geen Edge Function, en wordt
  door de app aangeroepen. `pg_cron` zit op Neon achter een betaald plan.

## Valkuilen die al een keer gebeten hebben

**Geen `security definer` op Neon.** Binnen zo'n functie zijn de JWT-claims niet
zichtbaar en geeft `auth.user_id()` null terug. Zonder definer mag de rol
`authenticated` het `auth`-schema helemaal niet aanroepen. Conclusie: roep
`auth.user_id()` niet aan in een functiebody. In een RLS-policy werkt het wél.

**`getJWTToken()` uit `@neondatabase/auth` is stuk** (geeft `user_not_found`).
`src/lib/auth.ts` haalt het token daarom zelf op met `fetch(.../token)` en
`credentials: 'include'`. Zodra die beta-package gerepareerd is kan dat terug.

**De AH-knop moet via `AppLauncher.openUrl`.** Niet `@capacitor/browser`, niet
een gewone `<a href>`. Die blijven in een webview met een eigen cookiejar; ben je
daar niet ingelogd bij AH, dan landen je artikelen op een anonieme lijst en is je
mandje leeg — zonder foutmelding. Zie `src/lib/ah.ts`.

**Mandjelinks openen met `x-safari-https://`** in de iOS-app en in de app op
het beginscherm. Elke link die via iOS loopt gaat naar de AH-app (Universal
Link), en die voegt niets toe. `x-safari-https://` dwingt Safari af (iOS 17+,
niet officieel gedocumenteerd door Apple). Alleen een gewoon Safari-tabblad
heeft dit niet nodig. Lukt het niet, dan is de terugval hieronder.

**Terugval: `/doorsturen.html`.** Een ah.nl-link geeft iOS aan de
AH-app (Universal Link); die gaat open maar voegt niets toe, want
`add-multiple` werkt alleen op de website. Het tussenstation op ons eigen
domein stuurt na 1,1 s door (WebKit geeft een tik tot 1 s door aan timers).
Dat alleen is niet genoeg: de AH-link zelf heeft een **dubbele slash**
(`/mijnlijst//add-multiple`). AH claimt alleen `/mijnlijst/add-multiple` voor
de app, en de dubbele slash geeft direct de pagina. Een slash erachter werkt
níét: ah.nl stuurt die door, en bij een doorverwijzing opent iOS alsnog de app.
Haal die dubbele slash dus niet weg. Let op: vanaf het beginscherm hielp dit
níét (getest 30-09-2026) — daar is `x-safari-https://` de echte oplossing. Het AH-mandje hoort
bij je account, dus het staat daarna ook in de AH-app. Alleen ah.nl en
jumbo.com zijn toegestaan als doel.

**`ingredient_key` bestaat op drie plekken en moet identiek zijn:**
`db/migrations/...ingredient_key.sql`, `app/src/lib/schaal.ts` (`ingredientKey`)
en `scripts/ah_mapping.py`. Wijk je op één plek af, dan matcht de AH-mapping
stilletjes niet meer. Let op accenten (crème fraîche → creme fraiche), de
meervouds-s (sojasaus blijft sojasaus, aardappels wordt aardappel) en apostrofs
(paprika's → paprika).

**ah.nl blokkeert kale HTTP-verzoeken met 403.** Scrapen lukt alleen vanuit een
echte browser. Vandaar dat `scripts/ah_mapping.py` in de praktijk niet werkt en
de mapping via de browser is opgebouwd. De API van de AH-app (`api.ah.nl`)
antwoordt wel; zie `scripts/ah_verpakkingen.py`.

## iOS-app

Capacitor verpakt `app/dist` als app (`app/ios`, Swift Package Manager, geen
CocoaPods). Bouwen: `npm run ios` in `app/`; naar TestFlight:
`npm run testflight`. Zie docs/setup.md §4. De app heet Pinch; de bundle-id
is `nl.reinoudtencate.receptenapp` (`nl.receptenapp.app` was bezet bij Apple).

- **Inloggen loopt via `receptenapp.vercel.app/api/auth`**, net als op de
  website, met `CapacitorHttp` aan. Rechtstreeks naar Neon Auth kan niet: die
  weigert de origin `capacitor://localhost`, en de webview gooit de cookie van
  een ander domein weg. `api/auth.ts` zet voor de app de origin van de website.
  De app hangt dus aan de productie-deploy, ook een testbuild.
- **`CapacitorHttp` vangt élke `fetch` af** en stuurt 'm via iOS. Gedraagt een
  verzoek zich in de app anders dan in de browser, kijk dan daar eerst.
- **Het opstartscherm gaat niet vanzelf weg** (`launchAutoHide: false`);
  `main.tsx` haalt het weg. Valt dat weg, dan hangt de app op een rood scherm.
- **`viewport-fit=cover` in `index.html` moet blijven.** Zonder is
  `env(safe-area-inset-top)` nul en schuiven alle koppen onder de klok.
- Alleen iPhone, alleen staand. Push staat nog niet aan (geen entitlement).
- **De deelknop** (`app/ios/App/Delen`, target `Delen`, bundle-id
  `nl.reinoudtencate.receptenapp.delen`): in Instagram of Safari tik je op
  Delen en kies je Pinch. De extension pakt de link, zet 'm in de App Group
  `group.nl.reinoudtencate.receptenapp` (`App.entitlements` en
  `Delen.entitlements`, Xcode registreert de groep zelf bij automatisch
  signen) en opent de app met `pinch://toevoegen?url=…` via de responder
  chain, want een extension mag UIApplication officieel niet aanroepen.
  `GedeeldeLink` in `App.tsx` vangt het URL-schema op (`appUrlOpen`,
  `getLaunchUrl`) en kijkt bij elke activering ook in de App Group
  (`src/lib/deelknop.ts`, via `@capacitor/preferences` met `group`), voor
  als het openen niet lukte. Alleen links; geen screenshots. De target is
  met de hand in `project.pbxproj` gezet (id's beginnen met `DE1E`);
  `cap sync` raakt 'm niet aan.

## AH-mapping — hoe het hoort te werken

De mapping (`ah_product_cache`) koppelt een genormaliseerde `ingredient_key` aan
een AH-productnummer, plus optioneel een biologische variant. Zonder mapping valt
de app terug op een zoeklink; dat is de bedoelde terugval, niet een storing.

**Bij twijfel: geen mapping.** Een verkeerd productnummer legt stilletjes het
verkeerde artikel in het mandje en dat merk je pas bij de kassa. Een zoeklink is
altijd beter dan een foute gok. De eerste zoektreffer op ah.nl is vaak níét het
juiste product ("citroen" → Spa Fruit Citron, "pesto" → een diepvriespizza), dus
rangschik op woordovereenkomst en huismerk, en gooi weg wat niet standhoudt.

**Zoeken op naam is streng** (`zoekProduct` in `src/lib/zoekProduct.ts`). Staat
de naam niet letterlijk in de mapping, dan mag een deel ervan matchen, maar
alleen als wat wegvalt het product niet verandert (`ONSCHULDIG`, `BEREID`:
"in blokjes", "fijngehakt", "voor de garnering"). "Sambal badjak" wordt dus
geen sambal oelek en "gerookte paprikapoeder" geen milde: die krijgen een
zoeklink tot ze een eigen mapping-regel hebben. Krijgt een regel onterecht een
zoeklink, vul dan die lijst aan of geef het ingrediënt een eigen regel.

- **Gedroogd** (`VERS_PRODUCT`): gedroogde paddenstoelen en tomaten zoeken op
  "gedroogde …" en krijgen nooit het verse product.
- **Geraspt:** eerst "geraspte …"; anders het gewone product, behalve als dat
  plakken zijn (`weergavenaam` met "plak").
- **Uit blik of pot** is bij tomaten en paprika een ander product, bij
  kikkererwten en kokosmelk niet (`VERS_OF_BLIK`).
- **Een keuze** ("tamari of sojasaus"): de eerste die een product heeft. Ook
  tussen haakjes: "geraspte kaas (cheddar of jong belegen)" wordt geraspte
  cheddar, de bereiding ervoor gaat mee en het soortwoord valt weg. Bij
  "(of …)" is het ingrediënt zelf de eerste keuze. Staat geen van de keuzes in
  de mapping, dan telt de hele naam.
- **Geraspte kaas is jong belegen**, tenzij het recept een soort noemt. Oud,
  jong, belegen en jong belegen hebben elk een regel `geraspte <soort> kaas`;
  `zoekProduct` zoekt daarop in welke volgorde het recept het ook schrijft
  ("oude geraspte kaas", "oude kaas, geraspt"). Een nieuwe soort is dus één
  mapping-regel bij AH én Jumbo, plus de verpakking.

**Nog te bouwen: opzoeken bij gebruik.** Zodra er eigen recepten bijkomen
(plan §7) verschijnen er ingrediënten die in geen enkele batch zaten. De
duurzame oplossing is: staat een `ingredient_key` niet in `ah_product_cache`,
dan zoekt de app het één keer op en schrijft het resultaat weg, zodat elke
volgende lijst 'm kent. In de Capacitor-app kan dat via native HTTP
(`CapacitorHttp`) — dat omzeilt CORS, wat in een gewone browser niet lukt.
Zolang dat er niet is, moet elk nieuw recept handmatig gemapt worden of blijft
het bij zoeklinks.

**Huismerk-voorkeur** (`gebruiker_voorkeuren.huismerk_voorkeur`): naast bio heeft
een mapping-regel een optionele huismerkvariant (`huismerk_product_id`,
`huismerk_sku`). Die staat alleen ingevuld waar de standaard een A-merk is en
er een huismerk bestaat dat hetzelfde product is; de meeste standaardkeuzes
zíjn al huismerk. `kiesVariant` in `src/lib/ah.ts` kiest: bio gaat voor
huismerk, en ontbreekt de gewenste variant dan de standaard. Bij Jumbo staan
de handmatige keuzes in `HUISMERK` in `scripts/jumbo_mapping.py`.

## Namen op de lijst: één product, één regel

Recepten schrijven hetzelfde product op tien manieren: "ui", "uien", "ui,
gesnipperd", "rodewijnazijn", "rode wijnazijn", "kipdijfilet",
"kippendijfilets". `lijstSleutel` in `src/lib/synoniemen.ts` trekt dat gelijk,
als laag bovenop `ingredient_key` (die blijft op de drie plekken identiek en
verandert niet in opgeslagen rijen). De lijst voegt erop samen en de
voorraadkast vergelijkt ermee; het product zoeken blijft op de naam
(`zoekProduct`).

- **Achter de komma telt niet**, en een bereiding of portie eromheen ook niet
  (`BEREIDING`, `VOORAAN`). "Uit blik" blijft wél staan: dat is een ander product.
- **Enkel- en meervoud** staan in een vaste lijst (`EEN_VORM`), geen regel:
  zonder woordenboek valt niet te zeggen wat meervoud is. Andere spellingen in
  `ANDERS_GESPELD`. Zie je twee regels voor hetzelfde product, vul dan een van
  die twee aan.
- **Vers en gedroogd blijven apart** (`droogKruid`): gemalen koriander is geen
  bosje koriander en krijgt nooit het verse product.
- **Boter is roomboter, ongezouten**, tenzij het recept iets anders zegt. Let
  op bij AH: er zijn twee producten "AH Roomboter ongezouten 250 g". 127487
  is de smeerbare kuip, 193236 het pakje; de mapping hoort op het pakje.
- **Yoghurt is volle yoghurt**, tenzij het recept iets anders zegt. "Magere
  yoghurt" heeft een eigen mapping-regel; zonder zou die via het woord yoghurt
  alsnog volle worden.
- **Voorraadkast** (`inVoorraad`): "Azijn" dekt wijn- en appelazijn, niet
  rijstazijn of balsamico. Lente-ui is geen ui.

**Wat niet in het mandje komt moet je zien.** Een regel zonder productnummer
heeft op de lijst een rode regel, staat bij naam boven de mandjeknop en in de
bevestiging erna; de knop telt alleen wat echt meegaat. Verstop dat niet.

## Jumbo-koppeling

Kies je in Instellingen voor Jumbo (`gebruiker_voorkeuren.voorkeurswinkel`),
dan gaat de mandjeknop naar jumbo.com in plaats van ah.nl. `src/lib/winkel.ts`
kiest; `src/lib/jumbo.ts` bouwt de link.

- **Mechanisme:** `https://www.jumbo.com/mandje/?add=[{"sku":"641085STK","quantity":2},…]`
  (JSON, URL-gecodeerd). Afgekeken van de Jumbo-knop op Uit Paulines Keuken,
  die via tobasket.com precies deze link opent; live getest.
- **SKU's zijn tekst**, geen getallen: nummer plus verpakkingsachtervoegsel
  (`STK`, `PAK`, `ZK`). Vandaar een eigen tabel `jumbo_product_cache`.
- **Mapping bijwerken:** anders dan ah.nl geeft jumbo.com gewoon antwoord op
  kale HTTP. `python3 scripts/jumbo_mapping.py` zoekt alle sleutels uit
  `data/ah_mapping.json` op en schrijft `data/jumbo_mapping.json`; nakijken,
  dan `python3 scripts/jumbo_mapping.py --migratie` voor een nieuwe migratie.
  Zelfde regel als bij AH: bij twijfel geen mapping.
- **Verpakkingen:** de inhoud per SKU (`jumbo_verpakking`) komt uit de
  productnaam ("… 500 g"). Na het bijwerken van de mapping:
  `python3 scripts/jumbo_verpakkingen.py` en dan `--migratie`. Hoe daarmee
  geteld wordt staat hieronder bij "Verpakkingen tellen".
- **Niet getest op een iPhone:** of de Jumbo-app de link als Universal Link
  opvangt en de `add`-parameter dan ook verwerkt, is nog onbekend. In Safari
  werkt het.

## Vega of vlees

Gehakt, rookworst en spekjes gaan standaard vega naar het mandje
(`src/lib/vega.ts`); de keuzelijst staat in de regel zelf, achter de
hoeveelheid ("800 g [Vegagehakt ▾]"), zodat naam en keuze nooit uiteenlopen. Andersom ook: vraagt het recept zelf om vega
(vegagehakt, een vega kipschnitzel), dan kies je daar rundergehakt, kipgehakt
of kipschnitzel. Standaard staat altijd vega. De keuze wordt per ingrediënt
op het toestel onthouden (`localStorage`, `gehakt-keuze`). Een vleesvariant
komt alleen in de lijst als die een productnummer heeft bij AH én Jumbo
(`vleesVarianten`); een nieuwe variant is dus ook een mapping-regel.

## Verpakkingen tellen

Hoeveel er van een product in het mandje gaat rekent `aantalVerpakkingen`
(`src/lib/lijst.ts`) uit, voor AH en Jumbo gelijk: wat de recepten samen
vragen, gedeeld door de inhoud van de verpakking.

- **Een kwart speling** (`SPELING`): 500 g broccoli is één stronk van 400 g,
  pas boven de 25% extra komt er een verpakking bij. Geldt voor alles.
- **Per product, niet per regel** (`verpakkingenPerRegel`): bruine bonen en
  pintobonen uit dezelfde pot vragen samen één pot. De eerste regel draagt
  het aantal, de rest nul; de mandjelink telt per productnummer op.
- **Inhoud bij AH:** `ah_verpakking`, per productnummer. De API van de
  AH-app geeft, anders dan ah.nl, wel antwoord op kale HTTP:
  `python3 scripts/ah_verpakkingen.py` haalt naam, inhoud, prijs en
  leverbaarheid op naar `data/ah_producten.json`, daarna `--migratie`. Niet
  officieel, dus alleen dit script en niets in de app zelf. Het script meldt
  ook wat niet meer te koop is; zo'n product valt stilletjes uit het mandje.
- **Zonder inhoud** (potjes kruiden, bouillon, een bos): één verpakking,
  behalve blikken/pakken uit het recept en groente per stuk (`PER_STUK`).
  Vraagt het recept bij groente per stuk een gewicht (2,5 kg pompoen), dan
  rekent `STUKGEWICHT` in `src/lib/eenheden.ts` dat om naar stuks.
- **El, tl, takjes en tenen tellen niet mee:** dat is nooit meer dan één
  verpakking.

## Deze week en komende week

Het startscherm (`src/screens/DezeWeek.tsx`) heeft twee weken naast elkaar,
met twee chips erboven. Vegen of tikken: de baan is een scroll-snap-container,
dus de schuifanimatie is van de browser.

- **Deze week volgt je bestelling, niet de kalender.** `useActieveWeek`
  (`src/lib/queries.ts`) geeft `gebruiker_voorkeuren.actieve_week`, of de
  kalenderweek als die null is. Gebruik in een scherm nooit `weekStart()` voor
  "deze week": dan kijk je na het doorschuiven naar de verkeerde lijst. Buiten
  een component: `haalActieveWeek`.
- **Komende week is de week erna** (`volgendeWeek`). De generator draait er
  ook voor; die slaat over wat de afgelopen vier weken getoond is, dus de
  suggesties verschillen van deze week.
- **Het hartje bewaart voor komende week én als favoriet**
  (`components/Hartje.tsx`), in Ontdekken en op het receptscherm. Nog een tik
  haalt het uit komende week; favoriet blijft het (weghalen bij Favorieten).
  De eerste keer komt er uitleg (`pinch-komende-week-uitleg` in `localStorage`).
- **Er is één boodschappenlijst, over beide weken** (`lijstWeken` in
  `src/lib/queries.ts`). "Zet op je lijst" in komende week laat het recept
  daar staan, ook na het bestellen; het komt pas in deze week als de week
  doorschuift. Het receptscherm en de kookmodus werken op de week waar het
  recept in staat.
- **Besteld = `weekmenu_gekozen.besteld_op`**, gezet als je bevestigt dat het
  mandje aankwam (`useBestellingVastleggen`); dat zet ook `actieve_week` vast,
  zodat je recepten op maandag niet verdwijnen. Deze week toont dan alleen nog
  wat je koos, en de knop onder een gekocht recept wordt "Koken"
  (`useWeekRecepten` in `src/lib/weekoverzicht.ts`; de onderbalk telt hetzelfde).
- **Na het koken** vraagt de kookmodus "Gekookt? Kan deze van je lijst?". Ja
  zet `gekookt_op` en `opgeruimd_op`: het recept is weg uit Deze week, niet
  uit je geschiedenis.
- **Doorschuiven** (`src/lib/weekwissel.ts`): is alles wat besteld was
  gekookt, dan wordt komende week deze week. Wat nog op je lijst stond gaat
  mee, met de lijst zelf. Een week na het bestellen vraagt
  `components/WeekVraag.tsx` het bij het openen: "Alle recepten van deze week
  gekookt?". Bij nee wijs je aan wat je nog kookt; dat gaat mee als besteld,
  met de datum van nu, dus een week later komt de vraag terug.
- **Een week overslaan kost je hartjes:** schuif je pas door als de week erna
  ook al voorbij is, dan blijft wat daar bewaard stond achter (wel favoriet).
- **Van elke soort gerecht één suggestie per week** (`src/lib/gerechtsoort.ts`):
  de soort komt uit de titel, want er is geen kolom voor. Twee keer wraps? Vul
  die lijst aan. Wat je zelf koos blijft altijd staan.

## Recepten toevoegen en de adminrol

Vier routes (plan §7 en het importplan): een link, screenshots, een foto van
een kookboekpagina, of je eigen recept in vrije tekst. Alles gaat door
`api/extraheer.ts` en komt uit op een conceptscherm waar de gebruiker
corrigeert voordat er iets wordt opgeslagen. Link en screenshots staan
hierboven bij "Recepten importeren".

**De kookboekfoto wordt niet bewaard.** Hij gaat één keer naar de extractie en
wordt daarna weggegooid — dat scheelt opslag en de pagina uit andermans boek
hoeft nergens te blijven staan.

**Kookboekrecepten kunnen nooit gedeeld worden, ook niet door een admin.** Dat
is geen permissiekwestie maar auteursrecht (plan §7.3, §7.6): een recept uit een
boek is niet van jou om te herpubliceren, ook niet herschreven en ook niet als
je de app hebt gebouwd. De check-constraint `kookboek_altijd_prive` op de tabel
dwingt dat af voor iedereen.

Wil je een gerecht dat je uit een boek kent tóch delen: voeg het toe als
`eigen_input` met een bereiding in je eigen woorden. Een ingrediëntenlijst is
niet auteursrechtelijk beschermd, de geschreven bereidingstekst wel.

**Gescrapete recepten krijgen een eigen naam en een eigen bereidingstekst.** De
titel van de bron komt niet in de database: `titel` en `titel_nl` zijn onze
eigen omschrijving van het gerecht, zonder namen van makers of merken
(migratie `20261002100000_eigen_receptnamen.sql`). Komt er een nieuwe lading
bij, geef die dan meteen een eigen titel.

De adminrol (`gebruiker.is_admin`) zet je met de hand in de database; er is
bewust geen UI voor, en een trigger houdt tegen dat de app 'm zet. Een admin
ziet `/beoordelen` met de aangemelde recepten van anderen.

## Recepten importeren: link, Instagram, screenshots

Je plakt een link (website of Instagram-post) of kiest screenshots, en
`api/extraheer.ts` maakt er een recept van in het schema van de app:
Nederlands, metrisch, de bereiding in eigen woorden, ingrediënten op een
bestaande `ingredient_key` waar dat past. Daarna het controlescherm
(`ReceptToevoegen.tsx`), en pas bij opslaan komt er iets in `recepten`.
Ingangen: de knop Toevoegen rechtsboven op Ontdekken (vervangt de losse knop
Zelf samenstellen), de schakelaar Alle / Mijn recepten, de lege zoekuitkomst,
en `/toevoegen?route=link&url=…` (straks de deelknop van iOS).

- **Gratis in de testfase.** Het plan voorziet 5 gratis scans en daarna
  Pinch Plus; dat is bewust nog niet gebouwd (Reinoud, 7 okt 2026: eerst
  gratis maken en testen). Wel staat er een daglimiet tegen misbruik
  (`SCAN_LIMIET_PER_DAG`, standaard 30, alle pogingen). Elke poging staat in
  `scan`: soort, link, gelukt of niet, tokens en een kostenschatting in
  centen (`lib/extractie/kosten.ts`). De app leest alleen de eigen rijen;
  schrijven doet de functie. Kijk daar om te zien wat een import kost.
- **Alleen ingelogd.** De functie controleert de sessie zoals `samenstellen`
  en `account-verwijderen` (`lib/sessie.ts`, geen CORS-headers). Dat dichtte
  meteen het lek dat de functie zonder login open stond.
- **Het antwoord is een stroom** (`stroom: true`): regels JSON met de
  stappen ("Video uitschrijven") en aan het eind het recept
  (`ScanGebeurtenis` in `src/lib/importeren.ts`). Zonder `stroom` komt er
  één object terug, voor app-builds van vóór het importeren. Edge-runtime:
  zonder stroom breekt een Instagram-video na 25 seconden af.
- **Routes** (`lib/extractie/`): een Instagram-link gaat via `social.ts`
  (scraper op Apify, `haalSocialPost`); staat het recept in het onderschrift
  (`lijktRecept`), dan alleen dat; verwijst het onderschrift naar een
  website, dan die; anders bij een video de gesproken tekst
  (`transcriptie.ts`, OpenAI) plus de omslag, bij een carrousel de beelden.
  Een website gaat via `website.ts`: eerst het JSON-LD-receptblok, anders de
  zichtbare tekst. Niets van wat de server ophaalt wordt bewaard.
- **Vier frames uit een video zitten er niet in:** op de edge-runtime is geen
  ffmpeg. In plaats daarvan gaat de omslag (`displayUrl`) mee; vaak staat
  daar de titel of het recept op.
- **Uitzetten:** `INSTAGRAM_IMPORT_AAN=false` op Vercel. De app vraagt dan
  bij een Instagram-link om een screenshot. Omgevingsvariabelen verder:
  `APIFY_TOKEN`, `APIFY_INSTAGRAM_ACTOR` (standaard `apify~instagram-scraper`),
  `OPENAI_API_KEY`, `OPENAI_TRANSCRIBE_MODEL` (standaard
  `gpt-4o-mini-transcribe`), `ANTHROPIC_MODEL_EXTRAHEER` (standaard
  `claude-sonnet-5-5`). Zonder `OPENAI_API_KEY` gaat een video zonder
  transcript verder; zonder `APIFY_TOKEN` krijgt een Instagram-link een
  melding.
- **De link staat in `url`, de maker in `bron_maker`** (`@account` of de
  sitenaam). `url` is sinds migratie `20261007150001` uniek per gebruiker
  (`nulls not distinct`, de pool blijft onderling uniek); dezelfde link twee
  keer plakken opent het bestaande recept (`bestaat`). `recepten.scan_id`
  wijst naar de scan; de app zet die bij het opslaan.
- **Altijd privé** (`import_altijd_prive`): een geïmporteerd recept is van
  de maker, niet van jou om te herpubliceren. Op het receptscherm staat
  "Recept van @account · Bekijk op Instagram" (`bronVermelding`). Een
  screenshot krijgt ook geen deellink (`screenshot_geen_deellink`), zoals
  een kookboekfoto; website en Instagram wel, met de bronvermelding erbij.
  Imports staan wél in Ontdekken en in de weekmenu-generator (het zijn jouw
  recepten), en de nachtelijke ronde geeft ze een eigen foto.
- **Niet gebouwd uit het plan:** Pinch Plus (RevenueCat, Stripe, Plus-scherm,
  teller), de uitleg na de onboarding, en het herroepingsscherm. De deelknop
  van iOS staat hierboven bij "iOS-app". De privacyverklaring noemt
  Anthropic, OpenAI en Apify al.

## Een recept delen met een link

De deelknop op het receptscherm geeft een link naar de website,
`justapinch.nl/r/<naam>` (`DEELSITE` in `src/lib/config.ts`), die iedereen kan lezen, ook zonder account.

- **De naam van het gerecht staat in de link** (`src/lib/slug.ts`). Een recept
  uit de pool heeft een `slug` in de database (`/r/romige-kip-met-spinazie`),
  gezet door een trigger en daarna vast, ook als de titel verandert. Een eigen
  recept houdt het id erachter (`/r/<naam>-<id>`): dat id is wat de link
  geheim houdt, dus geef een eigen recept geen kale slug. Een oude `/r/<id>`
  blijft werken.

- **De pagina maakt de server** (`api/recept.ts`, opmaak in
  `lib/deelpagina.ts`): geen app, geen JavaScript, wel een titel en foto in de
  voorvertoning van WhatsApp. `vercel.json` stuurt `/r/<naam>` erheen; die regel
  moet vóór de vangnetregel naar `index.html` blijven staan.
- **Wat openbaar is bepaalt de query in `api/recept.ts`** (draait zonder RLS):
  de pool en goedgekeurde recepten altijd; een eigen recept (`eigen_input`,
  `samengesteld`) pas als de eigenaar een link maakte (`deellink_sinds`, na
  een vraag in de app). Dat staat los van `deel_status`.
- **Kookboekrecepten nooit**, ook niet via een link: check-constraint
  `kookboek_geen_deellink`, en de query sluit ze nog eens uit.
- **Het deelvenster moet direct uit de tik komen** (`deel` in
  `src/lib/delen.ts`); Safari weigert het na een `await`. De link van een
  eigen recept gaat daarom tegelijk aan, niet ervoor.
- **WhatsApp heeft een eigen knop** (`whatsappLink`, `wa.me/?text=…`): het
  deelmenu van Safari op een Mac heeft geen WhatsApp. In de iOS-app gaat die
  link via `AppLauncher.openUrl`.
- **Nog niet gebouwd:** een link weer intrekken (nu: `deellink_sinds` op null
  zetten of het recept verwijderen).

## Zelf samenstellen

Rechtsboven op Ontdekken: je kiest een keuken en het aantal personen, typt
eventueel wensen, en Claude maakt een menu (`/samenstellen`,
`api/samenstellen.ts`).

- **De functie stuurt regels JSON terug terwijl Claude schrijft**
  (`MenuGebeurtenis` in `src/lib/menu.ts`): kop, elk gerecht zodra het af is,
  en aan het eind het hele menu. `MenuStroom` haalt de gerechten uit het
  halve antwoord. In de iOS-app komt alles in één keer (CapacitorHttp).
- **Kost geld per aanvraag,** dus alleen voor wie ingelogd is, met een
  limiet per 24 uur (10 nieuwe menu's, 30 aanpassingen), geteld in
  `samenstelling`. Het model staat in `ANTHROPIC_MODEL_SAMENSTELLEN`
  (standaard `claude-sonnet-5-5`).
- **Eerst een plan, dan de recepten.** Claude noemt in `plan` alle gerechten
  en schrijft ze daarna uit. Mist er een (het draaiboek ging over een lasagne
  die niet in het menu stond), dan vraagt de functie dat gerecht er in een
  tweede aanroep bij en zet het op zijn plek uit het plan.
- **Geen gedwongen tool-aanroep:** Sonnet 5.5 weigert `tool_choice` met
  `tool`/`any`. Het schema gaat mee als `output_config.format`.
- **De prompt begint met de huisregels en de productlijst van de winkel**
  (`lib/samenstellen/prompt.ts`); die komen uit de cache. Zet daar niets in
  wat per aanvraag verschilt.
- **Koppelen aan producten gebeurt in de app,** met dezelfde `zoekProduct`
  als de lijst. Claude krijgt de sleutels met een productnummer mee en hoort
  die namen te gebruiken; wat er niet in staat telt het menuscherm als
  zoeklink. Zo is er geen vierde plek met `ingredient_key`.
- **Opslaan pas bij "Zet op mijn lijst" of "Bewaar alleen de recepten".**
  Ze staan daarna onder "Mijn recepten" op het vragenscherm (zoeken op
  gerecht, ingrediënt of datum), niet bij je favorieten. Ze krijgen **geen
  foto**: de nachtelijke ronde slaat ze over, dat kost te veel. `bron_type = 'samengesteld'`, altijd privé
  (check-constraint), met `samenstelling_id`. Ze staan niet in Ontdekken en
  niet in de weekmenu-generator, en tellen niet mee voor Bespaard!.
- **Porties:** een samengesteld recept gaat op de lijst en opent voor het
  aantal van het menu, niet voor je huishouden (`standaardPersonen`).
- **Eerdere menu's:** elke aanvraag staat met het antwoord in
  `samenstelling`, ook als je niets bewaarde. Het vragenscherm heeft een
  lijst "Eerdere menu's" (zoeken op datum, keuken of gerecht) om er een
  terug te halen. Het menu waar je mee bezig bent staat ook in
  `localStorage` (`pinch-samenstellen`), zodat herladen niets kost.
- **Mislukte aanvraag uitzoeken:** de melding noemt wat er terugkwam (plan,
  geschreven, waarom afgekeurd), en `samenstelling.antwoord` bewaart dan
  `{ fout, ruw }`.
- **Nog niet gebouwd:** een eigen kopje op de boodschappenlijst en
  kandidaten uit de eigen pool.

## Receptafbeeldingen

Elk recept krijgt één gegenereerde foto (plan §6), geen varianten. De prompt
volgt het sjabloon in `docs/foodfotografie-prompt.md`: een vaste kern plus
variabelen (hoek, vaatwerk, ondergrond, rekwisieten, garnering) die
`lib/afbeeldingen/prompt.ts` deterministisch uit het recept-id kiest. Geen
taalmodel ertussen; het beeldmodel (Nano Banana 2 Lite,
`gemini-3.1-flash-lite-image`) krijgt de ingrediëntenlijst rechtstreeks.

- Beeld op 1K, verkleind naar 800 px WebP, opgeslagen in Vercel Blob
  (`recepten/<id>.webp`), URL in `recepten.afbeelding_url`, prompt in
  `recepten.afbeelding_prompt`, `afbeelding_bron = 'gegenereerd'`.
- Batch: `npm run afbeeldingen -- --limit 500` vanaf Reinouds terminal met
  `DATABASE_URL`, `GEMINI_API_KEY` en `BLOB_READ_WRITE_TOKEN`. Eerst
  `--dry-run --telling` om de verdeling te zien, dat kost niets.
- Nieuwe recepten: `api/afbeeldingen.ts` draait elke nacht (Vercel Cron) en
  pakt alles zonder afbeelding op, hooguit 8 per run.
- Tegenvallend beeld: `npm run afbeeldingen -- --id <uuid> --opnieuw`.
- Eigen foto's (`eigen_foto`, `kookboek_foto`) worden nooit overschreven.
- Wijzig je de prompt-lijsten, draai dan eerst `--dry-run --telling`: het doel is
  ongeveer half top-down, half schuin, en een derde zonder rekwisieten.

## Bespaard!

Wat je bespaart ten opzichte van een maaltijdbox (HelloFresh). Bij het openen
van de app schuift het totaal even bovenin (`components/BespaardMelding.tsx`) —
de eerste keer en daarna eens per drie keer openen, geteld in `localStorage`;
de details staan in Mijn keuken → Bespaard!.

- **Een bestelling telt** als je na de mandjeknop bevestigt dat het mandje
  aankwam. Dan komt er een rij in `bestelling` met de bedragen van dat moment.
- **Mandje:** in Jumbo-prijzen, ook voor AH-gebruikers — ah.nl is niet te
  scrapen. Eén verpakking per regel, zoals de mandjelink. Zonder prijs de
  klassenschatting uit `lib/prijsschatting.ts`. Zelf toegevoegde producten
  tellen niet mee.
- **Maaltijdbox:** prijs per portie naar aantal personen plus bezorging, in
  `lib/besparing.ts` (`MAALTIJDBOX`), met bronnen en peildatum. Een recept
  telt één keer per week.
- **Prijzen bijwerken,** een paar keer per jaar: `python3 scripts/jumbo_prijzen.py`
  en dan `--migratie` voor een nieuwe migratie. De HelloFresh-tabel pas je met
  de hand aan in `lib/besparing.ts`.
- Rekent zich bewust niet rijk: gewone prijs zonder aanbieding, hele
  verpakkingen, geen premiumtoeslag aan de HelloFresh-kant.

## Bonus

De acties van AH en Jumbo komen uit PrijsProfeet (`lib/bonus/`) en staan in
`bonus_actie`; `recept_bonus` zegt welke recepten daardoor in de bonus zijn.

- **Elke nacht verversen** doet GitHub Actions (`.github/workflows/bonus.yml`,
  04:00 UTC), niet Vercel. Met de hand: `gh workflow run bonus.yml`; kijken of
  het lukte: `gh run list --workflow bonus.yml`. Mislukt een winkel, dan is de
  run rood en blijft die winkel staan zoals hij was.
- **Zie je geen bonus meer, kijk dan eerst daar.** De tabel wordt per nacht
  vervangen; draait de ronde niet, dan lopen de acties af en verdwijnt de
  bonus zonder foutmelding uit de app.
- **Een Node-functie op Vercel heeft `.js` achter elke eigen import**
  (`'../lib/afbeeldingen/genereer.js'`). De root is `"type": "module"` en
  Vercel bundelt alleen edge-functies; zonder extensie crasht de functie bij
  het laden met een 500, ook de cron. De bonus trekt de halve `app/src/lib`
  mee, vandaar dat die ronde niet op Vercel draait.

## Allergieën

Je stelt ze één keer in bij Instellingen (`gebruiker_voorkeuren.allergieen`):
gluten, koemelk, ei, noten, pinda, vis, schaaldieren, soja, sesam.

- **Regels in de database:** `allergeen_regel` heeft per allergeen een
  regex-patroon op de ingrediëntnaam, een uitzondering, `bevat`/`mogelijk` en
  een optionele vervanger. Een trigger vult per recept `allergenen`,
  `allergenen_vast` (zonder vervanger) en `allergenen_twijfel` (alleen
  "mogelijk"). De app leest dezelfde tabel (`src/lib/allergenen.ts`) voor het
  receptscherm en de lijst.
- **Patronen simpel houden:** alleen `^ $ ( | ) ? .` — dat werkt gelijk in
  Postgres en JavaScript. Géén `\b`: dat is in Postgres een backspace.
  `allergenen.test.ts` leest de regels uit de migratie en test ze.
- **Regels veranderen:** nieuwe migratie, en daarin herrekenen met
  `update recepten set ingredienten = ingredienten;`.
- **Weg uit de pool** gaat alleen wat een allergeen zonder vervanger bevat
  (weekmenu-generator, Ontdekken, Vul mijn week). "Mogelijk" blijft
  zichtbaar met "check het etiket". Gluten en koemelk hebben vervangers; die
  gaan standaard naar de lijst, per regel terug te zetten (zoals vega).
- **Ontdekken:** de filterrij is Keuken ▾, Dieet ▾, Kooktijd ▾, Budget,
  Allergieën ▾; die met ▾ openen een lijst onderin. Geen chip "Alles": niets
  aangevinkt is alles. De chip "Allergieën ▾" opent een lijst om aan te vinken, van
  vaak naar zelden (`ALLERGENEN_OP_VOORKOMEN`). Hij begint met je allergieën
  uit Instellingen; wat je daar wijzigt geldt tot een herstart — vaak heeft
  maar één iemand in huis een allergie, of eet er iemand mee.
- Vervangers hebben nog geen AH- of Jumbo-productnummer: die gaan als zoeklink.
- Bij twijfel: als allergeen tellen. Liever een recept te weinig dan een
  allergeen dat erdoor glipt.

## Dieetfilters

Ontdekken en Deze week filteren op vegetarisch, vegan, pescotarisch,
koolhydraatarm en keto (`src/lib/dieet.ts`). Vegetarisch is de tag; de andere
vier zet een trigger in `recepten.dieet`, afgeleid uit de ingrediënten.

- **Regels in de database:** `dieet_regel` heeft patronen voor vlees,
  weekdieren, honing/gelatine en koolhydraatbronnen. Zuivel, ei en vis komen
  uit `allergeen_regel` — verander je die, dan verandert vegan mee.
- **Vegan** = de tag vegetarisch, zonder zuivel, ei, honing of gelatine; ook
  "mogelijk" (pesto, bladerdeeg) telt als niet vegan.
- **Pescotarisch** = vegetarisch, of vis zonder vlees. Bouillon telt niet als
  vlees.
- **Koolhydraatarm en keto zijn een schatting** (`recepten.koolhydraten_pp`):
  gram maal koolhydraten per 100 g, per persoon; tot 25 g en tot 12 g. Er is
  geen voedingswaardetabel. Wat geen regel heeft telt als nul, en een stuk
  zonder gewicht is een gok (`gram_per_stuk`).
- **Regels veranderen:** nieuwe migratie, daarna
  `update recepten set ingredienten = ingredienten;`. Zelfde patroonafspraak
  als bij de allergieën.
- Het is alleen een filter: de weekmenu-generator kent nog geen dieetvoorkeur
  behalve het vega-minimum.

## Keukenvoorkeur

Bij Instellingen tik je uit welke keukens je minder graag eet
(`gebruiker_voorkeuren.favoriete_keukens`). Een lege lijst betekent "alles
aan" — de standaard. Het is een voorkeur, geen filter: de generator weegt de
gekozen keukens 3× zwaarder, en Ontdekken toont ze eerst (`useOntdek` haalt
in fasen op: voorkeur, dan de rest, en **wat je al kookte achteraan**:
`gekookteIds`, gekookt of in een eerdere week op je lijst gehad, hooguit
150 omdat de ids in de URL meegaan) en zet ze bovenaan in de lijst Keuken ▾.
Daar vink je een of meer keukens aan (`filters.keukens`).

## Account, privacy en de App Store

- **Account verwijderen** zit in Profiel → Account, en loopt via
  `api/account-verwijderen.ts`. Apple eist dat (5.1.1(v)). De functie draait
  met `DATABASE_URL`, dus zonder RLS: het user-id komt alleen uit de sessie
  die Neon Auth bevestigt, nooit uit het verzoek. Eén transactie wist de rij
  in `gebruiker` (de rest hangt eraan met `on delete cascade`) en het account
  in `neon_auth."user"`. Goedgekeurd gedeelde recepten blijven, met
  `user_id` null.
- **Nieuwe tabel met gebruikersgegevens?** Geef die een
  `references gebruiker (id) on delete cascade`, anders blijft er na
  verwijderen iets achter.
- **Privacybeleid, voorwaarden en support** zijn losse pagina's in
  `app/public` (`/privacy.html`, `/voorwaarden.html`, `/support.html`), elk
  in het Nederlands en Engels op één pagina (`#en`; `paginas.js` wisselt).
  De adressen staan in `src/lib/config.ts`. Bewaart de app iets nieuws of
  komt er een dienst bij, werk dan beide talen bij én de privacyvragen in
  App Store Connect. Beloof er niets wat de app niet doet.
- De rest van de aanmelding staat in `docs/app-store/checklist.md`.

## Onboarding

Een nieuwe gebruiker ziet na het aanmelden één keer een welkomscherm, zes
uitlegkaarten en zes vragen (`/welkom`, `src/screens/Onboarding.tsx`) en
staat daarna op Deze week.

- **`Poort` in `App.tsx` stuurt naar `/welkom`** zolang
  `gebruiker_voorkeuren.onboarding_klaar_op` null is. Alleen null telt:
  ontbreekt de kolom, dan mag je door. Wie er vóór de migratie al was heeft
  een datum gekregen.
- **De antwoorden gaan naar dezelfde kolommen als Instellingen.** Geen
  tweede plek om iets in te stellen. De chips voor keukens en allergieën
  staan in `src/components/voorkeuren/` en worden door beide gebruikt.
- **Het weekmenu wordt pas na de vragen gemaakt.** `genereer_weekmenu` is
  idempotent per week; draait hij eerder, dan zijn de tien suggesties op de
  standaardwaarden gemaakt. De poort moet dus vóór Deze week blijven, en de
  onboarding roept `haalDezeWeek` pas aan bij "Vul mijn week".
- **"Vul mijn week" zet direct recepten op je lijst** (`kiesWeek`, zoveel als
  `kookavonden`), zonder bevestigscherm. Vegetarisch vraag je als "2 van je
  4 avonden"; `vegaMinimumVoor` rekent dat om naar "x van de 10".
- **De voorraadvraag schrijft naar `voorraad_item`**, niet naar de
  voorkeuren: dezelfde rijen als het scherm Voorraadkast. Het moet er staan
  vóór "Vul mijn week": wat in huis is komt niet op de lijst.
- **De chips komen uit `VOORRAAD_SUGGESTIES`** (`src/lib/voorraad.ts`), van
  vaak naar zelden; het scherm Voorraadkast gebruikt dezelfde lijst. De
  vraag begint met twaalf en zet er bij elke tik de volgende bij
  (`VoorraadKeuze`). In het open veld typ je de rest; staat het in de lijst,
  dan wordt het die naam ("miso" → "Misopasta"). Een nieuw product in de
  lijst krijgt de naam die de recepten gebruiken, anders dekt `inVoorraad`
  het niet; `voorraad.test.ts` bewaakt een paar gevallen.
- **Keukens komen uit de pool** (`useKeukens`), niet uit een vaste lijst: een
  chip die bij geen recept hoort doet niets in de generator.
- **Opslaan per stap**, en waar je was staat in `localStorage`
  (`pinch-onboarding`). De winkelvraag kun je niet overslaan.
- **Meten:** zes events in `onboarding_event` (`src/lib/meten.ts`). Alleen
  welke kaart of vraag, nooit het antwoord: een allergie hoort daar niet.
  Uitlezen gaat met de hand in de database; de app kan alleen schrijven.
- **Terugkijken:** Instellingen → Over de app → "Bekijk de uitleg" (`/uitleg`),
  alleen de kaarten.
- **De uitlegkaarten zijn schermafbeeldingen van de app zelf** met één ding
  uitgelicht (`components/Uitleg.tsx`, `src/assets/uitleg/`), geen
  nagetekende schermen. Verandert Ontdekken, Deze week, de Voorraadkast of
  de Lijst zichtbaar, maak dan een nieuwe afbeelding (780 × 1688 px, een
  telefoon van 390 breed) en zet het uitgelichte vlak opnieuw.
- **Nog niet gebouwd:** wie via een uitnodiging bij een huishouden komt
  krijgt nu de hele onboarding, niet alleen de uitleg.

## Wat er nog niet is

- Prijsindicatie per recept in echte prijzen — er is alleen de klassenschatting
- Push (APNs), huisgenoten delen

## Werkwijze (verplicht)

Reinoud en Steven werken allebei aan deze repo, elk vanaf een eigen machine.
Dezelfde afspraken als bij De Nieuwe Rentmeesters — ze zijn daar niet voor niets
zo gegroeid.

- Nooit rechtstreeks op `master` werken of committen. Eén klus = één branch =
  één PR. GitHub weigert een directe push ook: `master` is beschermd.
- **Begin elke klus met een verse branch vanaf de actuele `master`** — zie het
  blok hieronder.
- Mergen kan alleen als de check "Typecheck en build" groen is; merge als
  **squash and merge**.
- **Mergen blijft een menselijke beslissing — automatiseer die niet weg.** Maar
  het initiatief ligt bij Claude, niet bij het geheugen van de mens:
  - **Claude stelt de vraag.** Zodra de checks groen zijn, meldt Claude dat
    actief en vraagt: *"Groen — mergen?"* Bij "ja" voert Claude de merge uit
    (`gh pr merge --squash --delete-branch`); niemand hoeft naar GitHub.
  - Draaien de checks nog, dan mag je ook alvast "ja, zodra groen" zeggen —
    Claude zet dan auto-merge op de PR (`gh pr merge --auto --squash`).
  - **Sessiestart-check:** Claude meldt bij de start van een werksessie welke
    open PR's groen staan en op een merge-besluit wachten.
- **Vóór elke klus: check of de ander er al mee bezig is** (`gh pr list`,
  `gh issue list`). Raakt iets jouw onderwerp, stem dan eerst af. Grotere
  klussen: eerst een issue aanmaken of aan jezelf toewijzen — dat is het
  "bezet"-bordje. Claude doet deze check zelf aan het begin van elke klus.
- Migraties: nieuw bestand in `db/migrations/`, nooit een bestaande aanpassen —
  `scripts/migrate.py` houdt bij wat gedraaid is. Benoem een migratie expliciet
  in de PR, zodat de ander meekijkt vóór de merge.
- **Migraties draaien vanzelf** na de merge: `.github/workflows/migraties.yml`
  draait `scripts/migrate.py` bij elke push naar `master` met een migratie erin.
  Met de hand (her)starten: `gh workflow run migraties.yml`; kijken of het
  lukte: `gh run list --workflow migraties.yml`. Niemand hoeft ze nog zelf te
  draaien. Een migratie moet daarom altijd achterwaarts veilig zijn (kolom
  erbij, niet weg of hernoemd): de oude app draait nog even tegen de nieuwe
  database tot Vercel klaar is.
- `DATABASE_URL` staat als repository secret in GitHub (voor de migraties) en
  bij Reinoud in zijn terminal (voor `npm run afbeeldingen`). Vraag 'm niet op en
  laat 'm nooit in de chat plakken. Secrets nooit in code, commits, logs of
  chat; environment-variabelen zet je in Vercel.
- Bouwen en typecheck: `npm run build` in `app/`. Draai dat vóór het pushen —
  CI doet exact hetzelfde en je wilt niet op een rode check wachten.

### Branches: altijd vers vanaf `master` (verplicht)

Begin **elke** klus zo, vóór de eerste wijziging:

```
git fetch origin
git checkout -b feat/<korte-omschrijving> origin/master
```

- **Eerst `fetch`, dan pas aftakken.** Een verouderde lokale `master` geeft een
  conflicterende PR. Let op het stille gevolg: bij `mergeStateStatus: DIRTY`
  draait GitHub Actions niet meer, want het `pull_request`-event kan de
  merge-commit niet bouwen. De check verdwijnt dan uit beeld in plaats van rood
  te worden.
- **Nooit doorwerken op een branch waarvan de PR al gemerged is.** Bij squash
  worden de losse commits géén ancestors van `master`; zo'n branch loopt
  "vooruit" en nieuw werk hangt eraan zonder PR. Vercel bouwt wél een preview
  per branch, ook zonder PR — het lijkt dus alsof er iets doorgevoerd is
  terwijl er in GitHub niets te mergen staat. Nieuw werk? Nieuwe branch.
- **Alleen doorwerken op een bestaande branch** als het over hetzelfde onderwerp
  gaat én de PR nog openstaat.
- **Opruimen na de merge gaat vanzelf** — GitHub verwijdert de remote branch
  automatisch. De lokale kopie ruimt Claude zelf op
  (`git checkout master && git pull && git branch -d <branch>`).

### Waar het draait

- **Hosting: Vercel, op het account van Reinoud** (`receptenapp.vercel.app`).
  Steven heeft daar een Developer-rol; production redeployen kan alleen Reinoud.
- De twee `VITE_NEON_*`-variabelen staan in de Vercel-projectinstellingen, niet
  in de repo. Lokaal komen ze uit `app/.env.local` (zie `app/.env.example`).
- Een deploy die "Blocked" heet komt niet door een bug maar doordat de
  git-auteur nog geen toegang had tot het Vercel-project; hij kan daarna gewoon
  opnieuw gedeployd worden.
