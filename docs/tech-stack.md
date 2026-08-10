# Tech stack — Receptenapp

Versie 2, 8 augustus 2026. Hoort bij `docs/app-plan-weekmenu-en-ah.md`.

**Wijziging t.o.v. versie 1:** frontend gaat van Expo/React Native naar React + Capacitor, in lijn met Lijster. Toelichting in §2. Het hele Supabase-deel (§3 t/m §6) is identiek in beide varianten.

**Uitgangspunten:**
- Een **echte native app** (iOS via TestFlight/App Store), dev-account is aanwezig.
- Eerste bouwronde: **kern (weekmenu, recepten, boodschappenlijst) + de AH-knop**.
- **Geen inlogscherm**, maar wél een volwaardige gebruiker onder water — de app is vanaf dag één multi-user-klaar. Zie §3.

---

## 1. De stack in één overzicht

| Laag | Keuze | Waarom |
|---|---|---|
| App-framework | **React 19 + Vite** | Zelfde als Lijster. Je kent het, en de designs uit Claude Design zijn gewoon HTML. |
| Taal | **TypeScript** | Supabase genereert je types uit het databaseschema. |
| Styling | **Tailwind CSS 4** | De designs komen als Tailwind binnen. Hier is het écht Tailwind, geen nabootsing. Nieuw project = meteen v4, niet v3 zoals Lijster. |
| Navigatie | **React Router** | Zelfde patroon als Lijster. |
| Native verpakking | **Capacitor 8** | Verpakt de webapp als echte iOS-app. Jouw signing/build/store-pijplijn staat al. |
| Capacitor-plugins v1 | `app`, `app-launcher`, `preferences`, `push-notifications`, `status-bar`, `splash-screen`, `haptics` | Later erbij voor sectie 7: `camera`. |
| Server-state | **TanStack Query 5** + persist naar IndexedDB | Caching, refetch, en — belangrijk — je boodschappenlijst werkt in een supermarkt met slecht bereik. |
| Client-state | **Zustand** | Klein en genoeg voor voorkeuren en vinkjes. |
| Backend | **Supabase** (Postgres + Auth + Storage + Edge Functions) | Vervangt FastAPI + Railway + Neon uit de Lijster-opzet. Zie §2. |
| Auth | **Supabase Auth, anoniem gestart** | Geen inlogscherm nu, echte accounts later zonder migratie. Zie §3. |
| Cron | **`pg_cron` + `pg_net`** in Supabase | Wekelijkse weekmenu-generatie + uurlijkse push-check (plan §1.4 en §8.3). |
| Push | **APNs** via `@capacitor/push-notifications` | Zelfde route als Lijster, inclusief de .p8-sleutel. |
| Fonts | **Fontsource** | Overgenomen van Lijster: fonts in de bundle, geen afhankelijkheid van een CDN in een app die soms offline is. |
| Repo | **GitHub** — `develop` = staging, `main` = productie | Zelfde ritme als Lijster. |

---

## 2. Waarom deze mix — deels wél, deels niet zoals Lijster

**Frontend: wél zoals Lijster.** Drie redenen om Capacitor te verkiezen boven React Native:

1. De designs komen uit Claude Design als HTML met Tailwind-classes. In een webview is dat letterlijk dezelfde Tailwind. In React Native met NativeWind is het een nabootsing: het meeste werkt, een deel niet, en je ontdekt pas welk deel als je erop stuit. Bij een app die volledig op een bestaand design system leunt is dat geen detail.
2. De Capacitor-pijplijn draait al bij jou — Xcode, signing, App Store, push. Dat is precies het werk dat bij een nieuwe stack het meest tegenvalt.
3. De app is lijsten, kaarten en vinkjes. Er is geen scherm waar native rendering echt nodig is.

**Backend: níét zoals Lijster.** Lijster heeft een eigen FastAPI-backend nodig, en terecht: accounts, wachtwoorden, foto-uploads, periodieke ingest van externe bronnen, AI-fotoherkenning, een geparkeerd TensorFlow-model. Dat laatste dwingt Python af — Perch bestaat niet in JavaScript.

De Receptenapp heeft niets daarvan. De backend moet tien rijen selecteren, vinkjes onthouden en één keer per week een cron draaien. Daar FastAPI op Railway plus Alembic plus een aparte Neon-database voor optuigen betekent drie hostingpartijen en een server die je onderhoudt voor werk dat in Supabase een paar Edge Functions is. Eén dienst, geen deploy-pijplijn voor de backend, migraties via de Supabase CLI.

Als de app ooit richting sectie 11 gaat (sociale features, meerdere gebruikers, moderatie) is dat nog steeds prima met Supabase. Pas als er echt zwaar Python-werk bij komt — beeldherkenning die je zelf draait, bijvoorbeeld — wordt de Lijster-opzet weer de betere.

---

## 3. Multi-user vanaf dag één, zonder inlogscherm

Je wil nu geen login, maar wél de mogelijkheid openhouden. Het dure aan later toevoegen is niet het inlogscherm — dat is een middag. Het dure is een datamodel waarin nergens staat van wie iets is, plus code die gewend is geraakt aan alles-mag-alles lezen. Dat vermijden we zo:

### 3.1 Anonieme auth

Bij de eerste app-start:

```ts
const { data: { session } } = await supabase.auth.getSession()
if (!session) await supabase.auth.signInAnonymously()
```

Dat levert een volwaardig Supabase-account met een echte UUID op. Jij ziet nooit een invoerveld. De sessie wordt op het toestel bewaard (via `@capacitor/preferences` als storage-adapter, zodat 'ie een app-update overleeft).

### 3.2 Later omzetten naar een echt account

```ts
await supabase.auth.updateUser({ email, password })
```

Het anonieme account wordt daarmee permanent, **met behoud van dezelfde UUID**. Alle weekmenu's, gekozen recepten, eigen recepten en instellingen blijven van jou. Geen migratie, geen backfill, geen dataverlies. Vanaf dat moment kan de volgende persoon zich gewoon registreren en werkt de rest van de app al.

### 3.3 Wat we nu meteen goed zetten

Drie dingen die achteraf wél vervelend zijn:

- **De gedeelde pool bestaat nu al.** De 581 gescrapete recepten krijgen `user_id = null` (= gedeeld), jouw eigen recepten krijgen jouw id. De weekmenu-query wordt daarmee vanaf het begin *"de gedeelde pool plus wat van mij is"* in plaats van *"alle recepten"*. Dat is precies de query die je anders later door de hele app heen moet corrigeren.
- **Storage per gebruiker.** Bestanden gaan in `/{user_id}/...`, ook nu er maar één is. Achteraf verplaatsen betekent alle URL's in de database bijwerken.
- **Push-tokens in een aparte tabel**, een rij per gebruiker per toestel — niet één veld in je instellingen. Zoals Lijster het al doet.

### 3.4 RLS, meteen aan

Row Level Security staat op elke tabel aan vanaf het begin. Het patroon:

```sql
-- eigen data
create policy "eigen rijen" on weekmenu_gekozen
  for all using (user_id = auth.uid());

-- recepten: gedeelde pool + eigen recepten + goedgekeurd gedeelde van anderen
create policy "leesbare recepten" on recepten
  for select using (
    user_id is null
    or user_id = auth.uid()
    or deel_status = 'goedgekeurd'
  );
```

Die laatste policy is meteen het hele deel-mechanisme uit plan-sectie 7.3, terwijl er nog maar één gebruiker is. Kost nu niets, en is straks precies wat je nodig hebt.

### 3.5 Eén eerlijke kanttekening

Een anoniem account leeft op je toestel. Wis je de app voordat je 'm hebt omgezet naar e-mail + wachtwoord, dan ben je die gebruiker kwijt — en daarmee je weekmenu-geschiedenis en zelf toegevoegde recepten. De 581 recepten uit de gedeelde pool staan daar los van. Zodra de app blijft hangen: meteen omzetten naar een echt account.

---

## 4. Data-architectuur

**Recepten staan in Postgres, niet als JSON in de app-bundle.** 1,5 MB meebundelen werkt technisch, maar dan kun je geen recept toevoegen (plan-sectie 7) zonder nieuwe app-build.

```
recepten              -- import van recepten.json, + user_id / bron_type / deel_status
weekmenu_getoond      -- + user_id
weekmenu_gekozen      -- + user_id
gebruiker_voorkeuren  -- + user_id
boodschappenlijst_item-- + user_id
ah_product_cache      -- ingredient_key, standaard_product_id, bio_product_id, laatst_geverifieerd
push_token            -- user_id, token, platform, laatst_gezien
```

Twee toevoegingen op het oorspronkelijke plan:

1. **Een genormaliseerde `ingredient_key`.** Je AH-mapping matcht op naam, en "1 ui" / "uien" / "rode ui" moeten naar hetzelfde product kunnen wijzen. Match op een lowercase, ontdane sleutel — niet op de ruwe receptstring. Zonder dit zakt je mapping-hitrate zo naar 40%.
2. **Offline-first.** Recepten en boodschappenlijst lokaal gecached via TanStack Query persist; afvinken schrijft optimistisch weg en synchroniseert later. Je staat in de kelder van de Lidl, niet op glasvezel.

De import van `recepten.json` is een eenmalig script. Daarna is de JSON archief.

---

## 5. De AH-knop — de valkuil in een webview-app

De link moet naar de **systeembrowser**, niet naar een in-app paneel:

```ts
import { AppLauncher } from '@capacitor/app-launcher'
await AppLauncher.openUrl({ url: `https://www.ah.nl/mijnlijst/add-multiple?${params}` })  // ✅
```

**Niet** `@capacitor/browser` (`Browser.open()`) gebruiken, en ook geen gewone navigatie binnen de webview. Beide houden je in een omgeving met een **eigen cookiejar**. Ben je daar niet ingelogd bij AH, dan komen je twaalf artikelen op een *anonieme* lijst die niets met jouw account te maken heeft: je opent daarna de AH-app, je mandje is leeg, en er is geen foutmelding — technisch ging er niets mis. Vervelend om achteraf te debuggen.

`AppLauncher.openUrl` geeft de URL aan het besturingssysteem, dat 'm doorzet naar de AH-app (Universal Link) of naar Safari, waar je je normale AH-sessie hebt. In een webview-app is deze val net iets makkelijker om in te stappen dan in React Native, want een gewone `<a href>` blijft hier standaard binnen de app.

De productID-mapping bouw je op met een los script (draait op je Mac, niet in de app) dat per ingrediënt op ah.nl zoekt en het ID plus eventuele bio-variant in `ah_product_cache` zet. Begin met de ~150 meest voorkomende ingrediënten uit je 581 recepten — die dekken vermoedelijk 80% van je boodschappenlijsten.

---

## 6. Wat waar draait

| Werk | Waar |
|---|---|
| Weekmenu genereren (wekelijks) | Edge Function + `pg_cron` |
| Push-check (uurlijks) | Edge Function + `pg_cron` → APNs |
| AI-extractie kookboekfoto's (plan §7) | Edge Function → Anthropic API |
| Beeldgeneratie (plan §6) | Los batchscript op je Mac → Supabase Storage |
| Alles wat je ziet | De Capacitor-app, rechtstreeks tegen Supabase |

**Nooit een API-sleutel in de app.** Een webview-bundle is triviaal uit te pakken. Alles met een sleutel gaat via een Edge Function.

Let op bij push: APNs eist HTTP/2 en een met ES256 ondertekende JWT uit je .p8-sleutel. Dat kan prima in een Deno Edge Function via WebCrypto, maar het is net even puzzelen — de Python-implementatie in de Lijster-backend is je referentie voor wat er precies in die JWT moet.

---

## 7. Distributie

- **TestFlight is genoeg** voor een app voor jezelf: installeren op je telefoon, updates gaan er direct in, geen App Store-review. Pas als je richting plan-sectie 11 gaat krijg je met review te maken.
- Tijdens het bouwen draai je gewoon in de browser (`vite dev`) en af en toe op het toestel via Xcode.
- **Android (optioneel): $25 eenmalig** + een Firebase-project voor FCM. Alleen als je 'm ook op Android wil.

---

## 8. Concrete eerste sprint

1. Vite + React 19 + Tailwind 4 + React Router opzetten, Capacitor toevoegen, één keer op je telefoon krijgen.
2. Supabase-project, tabellen, RLS-policies, `recepten.json` importeren, types genereren.
3. Anonieme auth + sessie-persistentie via `@capacitor/preferences`.
4. Weekmenu-generator als Edge Function (de pseudocode uit plan §1.3) + `pg_cron`.
5. Scherm 1: weekmenu-overzicht, 10 kaarten, aanvinken wat je kookt.
6. Scherm 2: receptdetail met portieschaling.
7. Scherm 3: boodschappenlijst — samenvoegen, dedupliceren, afvinken, eigen items.
8. Mappingscript draaien voor de top-ingrediënten.
9. De `add-multiple`-knop, met zoeklink als terugval.
10. TestFlight-build + push aanzetten.

Stap 1 t/m 9 kun je grotendeels in de browser bouwen; het toestel heb je pas echt nodig bij 9 (de AH-sprong) en 10 (push).

---

## 9. Nog open

- **De designs en de wireframe** — nog niet ingezien. Nodig voordat de schermen gebouwd worden, vooral om te weten of het design system in Tailwind-tokens zit (directe overname) of in losse kleurwaarden.
- **Alleen iOS, of ook Android?** Bepaalt of er een Firebase-project en een tweede buildprofiel bij komt.
- **Jumbo-mechanisme** is nog niet afgevangen (plan §4) — geen blokkade voor v1.
- **De 23 pending-redo recepten** uit de README — losstaande databron-taak, kan parallel.
