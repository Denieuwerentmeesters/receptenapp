# Opzetten — Receptenapp

Deze bouwronde is de **harde kern**: weekmenu, receptdetail, boodschappenlijst,
de AH-knop en instellingen. Ontdekken, kookmodus, voorraadkast, favorieten,
huisgenoten en abonnement zitten wél in de designs maar niet in deze versie.

## Afwijkingen van `tech-stack.md`

Het plan ging uit van Supabase met anonieme auth. Twee dingen zijn anders
gelopen, allebei om een concrete reden:

| Onderdeel | Plan | Nu | Waarom |
|---|---|---|---|
| Database | Supabase Postgres | **Neon Postgres** | Supabase-org zat op de limiet van twee actieve gratis projecten |
| API | supabase-js | Neon Data API (PostgREST) | Zelfde `.from().select()`-vorm, dus de datalaag bleef intact |
| Auth | anoniem, geen inlogscherm | **Neon Auth, e-mailcode** | Neon's Managed Better Auth ondersteunt de anonymous-plugin niet |
| RLS | `auth.uid()` | `auth.user_id()` | Het `sub`-claim uit de JWT |
| Weekmenu-generator | Edge Function + `pg_cron` | plpgsql-functie, aangeroepen door de app | `pg_cron` zit op Neon achter een betaald plan |

Over het inlogscherm: het plan wilde er expliciet géén. Het alternatief was een
tweede dienst (Firebase) erbij halen puur voor het uitgeven van een token. Eén
keer per toestel een code van zes cijfers overtypen bleek goedkoper — en het
lost meteen twee dingen op die het plan zelf als risico noemde (§3.5): je raakt
je geschiedenis niet kwijt als je de app verwijdert, en je telefoon en laptop
zijn dezelfde gebruiker.

Geen magic link maar een code, omdat een magic link de app moet kunnen openen en
dat Universal Links vraagt met een configuratiebestand op een eigen domein.

## 1. Neon

1. Maak een project aan op [neon.com](https://neon.com).
2. **Connect to your branch** → tabblad **Data API** → aanzetten. Kopieer de URL
   (eindigt op `/rest/v1`).
3. Tabblad **Auth** → kopieer de **Auth URL** (niet de JWKS URL — die heb je
   alleen nodig als je een externe auth-provider koppelt, en dat doen we niet).
4. Tabblad **Postgres database** → kopieer de connection string.
5. Zet in Neon Auth de **Email OTP**-aanmeldmethode aan.
6. Draai de migraties:

```bash
cd ~/Documents/Receptenapp
pip3 install 'psycopg[binary]'
export DATABASE_URL='<connection string>'
python3 scripts/migrate.py
```

7. Importeer de 581 recepten:

```bash
python3 scripts/import_recepten.py
```

## 2. De app

```bash
cd app
cp .env.example .env.local   # vul de twee Neon-URL's in
npm install
npm run dev
```

## 3. AH-productmapping

Zonder mapping werkt de lijst gewoon, maar valt elke regel terug op een
zoeklink. Met mapping werkt de één-tik-knop:

```bash
python3 scripts/ah_mapping.py --top 150            # eerst kijken
python3 scripts/ah_mapping.py --top 150 --schrijf  # dan wegschrijven
```

## 4. Op je telefoon

```bash
cd app
npm run ios          # bouwt, synct naar ios/ en opent Xcode
```

Eén keer vooraf: Xcode → Settings → Accounts → je Apple ID toevoegen. Het
team staat al in het project (automatische signing).

- **Op je eigen telefoon:** telefoon aan de Mac, bovenin als doel kiezen, Run.
- **TestFlight:** `npm run testflight` bouwt, ondertekent en uploadt. De app
  staat in App Store Connect als "Pinch weekmenu"
  (`nl.reinoudtencate.receptenapp`); het buildnummer hoogt Apple zelf op.

Icoon en opstartscherm komen uit `app/ios/ontwerp/maak.mjs`
(`node app/ios/ontwerp/maak.mjs` vanuit de root).

## Nog te doen

- **Push** — `@capacitor/push-notifications` is geïnstalleerd, maar er is nog
  geen APNs-route. Daar heb je iets van een server voor nodig, of een dienst als
  OneSignal.
- **Wekelijkse cron** — `pg_cron` zit op Neon achter een betaald plan. Nu roept
  de app `genereer_weekmenu` zelf aan bij het openen van een week; die functie is
  idempotent, dus dat werkt, alleen niet vóórdat je de app opent.
- **Receptafbeeldingen** — alle kaarten tonen nu een kleurvlak met "foto".
  Plan §6 (batchgewijs genereren) is nog niet gebouwd.
- **De 22 Paulines-recepten** zonder definitieve bereidingstekst staan gewoon in
  de pool; hun `bereiding_nl` is leeg.
