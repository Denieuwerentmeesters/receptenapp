# Receptenapp

Receptenapp voor Reinoud. Kernflow: **weekmenu → recept → boodschappenlijst → AH-mandje.**
Elke week 10 recepten uit een pool van 475 hoofdgerechten, jij kiest wat je kookt,
de ingrediënten stromen samengevoegd door naar je Albert Heijn-mandje.

Nederlands is de voertaal — in de UI, in de code (variabelen, functienamen) en in
commentaar. Houd dat aan.

## Waar wat staat

```
api/extraheer.ts     Serverless functie (Vercel) die recepten uitleest met Claude
api/afbeeldingen.ts  Nachtelijke cron (Vercel) die nieuwe recepten een afbeelding geeft
lib/afbeeldingen/    Prompt-opbouw en generatie van receptafbeeldingen (gedeeld door
                     api/afbeeldingen.ts en scripts/genereer_afbeeldingen.ts)
app/                 React 19 + Vite + TypeScript + Capacitor 8 (iOS)
  src/ds/            Design system uit Claude Design: tokens + componenten
  src/screens/       Weekmenu, Recept, Boodschappen, Instellingen, Inloggen
  src/lib/           auth, db, queries, schaal, ah, week, config, fouten
db/migrations/       SQL, op volgorde, gedraaid via scripts/migrate.py
scripts/             migrate, import_recepten, ah_mapping, laad_ah_mapping,
                     jumbo_mapping, jumbo_prijzen, jumbo_verpakkingen,
                     genereer_afbeeldingen (TypeScript, via `npm run afbeeldingen`)
data/recepten.json   581 gescrapete recepten (archief na import)
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

**Mandjelinks gaan via `/doorsturen.html`.** Een ah.nl-link geeft iOS aan de
AH-app (Universal Link); die gaat open maar voegt niets toe, want
`add-multiple` werkt alleen op de website. Het tussenstation op ons eigen
domein stuurt na 400 ms door, en dan blijft iOS in Safari. Het AH-mandje hoort
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
de mapping via de browser is opgebouwd.

## AH-mapping — hoe het hoort te werken

De mapping (`ah_product_cache`) koppelt een genormaliseerde `ingredient_key` aan
een AH-productnummer, plus optioneel een biologische variant. Zonder mapping valt
de app terug op een zoeklink; dat is de bedoelde terugval, niet een storing.

**Bij twijfel: geen mapping.** Een verkeerd productnummer legt stilletjes het
verkeerde artikel in het mandje en dat merk je pas bij de kassa. Een zoeklink is
altijd beter dan een foute gok. De eerste zoektreffer op ah.nl is vaak níét het
juiste product ("citroen" → Spa Fruit Citron, "pesto" → een diepvriespizza), dus
rangschik op woordovereenkomst en huismerk, en gooi weg wat niet standhoudt.

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
  `python3 scripts/jumbo_verpakkingen.py` en dan `--migratie`. Daarmee telt
  `aantalVerpakkingen` (`src/lib/lijst.ts`) hoeveel pakken er nodig zijn. Voor
  AH is er geen inhoud; daar blijft het één verpakking per ingrediënt, behalve
  blikken/pakken uit het recept en groente per stuk.
- **Niet getest op een iPhone:** of de Jumbo-app de link als Universal Link
  opvangt en de `add`-parameter dan ook verwerkt, is nog onbekend. In Safari
  werkt het.

## Recepten toevoegen en de adminrol

Twee routes (plan §7): een foto van een kookboekpagina, of je eigen recept in
vrije tekst. Beide gaan door `api/extraheer.ts` en komen uit op een
conceptscherm waar de gebruiker corrigeert voordat er iets wordt opgeslagen.

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

De adminrol (`gebruiker.is_admin`) zet je met de hand in de database; er is
bewust geen UI voor, en een trigger houdt tegen dat de app 'm zet. Een admin
ziet `/beoordelen` met de aangemelde recepten van anderen.

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
van de app schuift het totaal even bovenin (`components/BespaardMelding.tsx`);
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
