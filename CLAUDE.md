# Receptenapp

Receptenapp voor Reinoud. Kernflow: **weekmenu → recept → boodschappenlijst → AH-mandje.**
Elke week 10 recepten uit een pool van 475 hoofdgerechten, jij kiest wat je kookt,
de ingrediënten stromen samengevoegd door naar je Albert Heijn-mandje.

Nederlands is de voertaal — in de UI, in de code (variabelen, functienamen) en in
commentaar. Houd dat aan.

## Waar wat staat

```
api/extraheer.ts     Serverless functie (Vercel) die recepten uitleest met Claude
app/                 React 19 + Vite + TypeScript + Capacitor 8 (iOS)
  src/ds/            Design system uit Claude Design: tokens + componenten
  src/screens/       Weekmenu, Recept, Boodschappen, Instellingen, Inloggen
  src/lib/           auth, db, queries, schaal, ah, week, config, fouten
db/migrations/       SQL, op volgorde, gedraaid via scripts/migrate.py
scripts/             migrate, import_recepten, ah_mapping, laad_ah_mapping
data/recepten.json   581 gescrapete recepten (archief na import)
data/ah_mapping.json ingrediënt → AH-productnummer
docs/                app-plan, tech-stack, setup
```

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

## Wat er nog niet is

- Prijsindicatie per recept — vraagt eenheidsprijzen per AH-product
- Receptafbeeldingen (plan §6); kaarten tonen nu een kleurvlak. Apart project:
  eerst een goede prompt, dan pas batchgewijs genereren.
- Push (APNs), huisgenoten delen, Jumbo (mechanisme onbekend)

## Werkwijze

- Migraties: nieuw bestand in `db/migrations/`, nooit een bestaande aanpassen —
  `scripts/migrate.py` houdt bij wat gedraaid is.
- `DATABASE_URL` staat alleen bij Reinoud in zijn terminal. Vraag 'm niet op en
  laat 'm nooit in de chat plakken.
- Bouwen en typecheck: `npm run build` in `app/`.
