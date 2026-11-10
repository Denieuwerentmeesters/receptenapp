# Release-automatisering overnemen voor Gusty

Dit is het draaiboek om Gusty net zo te laten releasen als Kookmaatje: je zegt
"release", Claude bouwt, uploadt en dient in. Het is gebaseerd op wat er voor
Kookmaatje op 10 nov 2026 is gebouwd en getest (`docs/release.md` daar). De
Google-kant is end-to-end uitgeprobeerd (upload naar de interne track lukte), de
Apple-kant (`indienen`) nog niet.

## Wat je al hebt en niet opnieuw hoeft

Alles in `~/.kookmaatje/` van Kookmaatje werkt ook voor Gusty:

- **Apple:** `AuthKey.p8` + `release.env` (Key ID en Issuer ID). De API-sleutel
  hoort bij je hele Apple-account (rol App Manager), niet bij één app.
- **Google:** `play-sleutel.json` van het serviceaccount
  `release@kookmaatje-release.iam.gserviceaccount.com`. In de Play Console is dat
  account al uitgenodigd voor zowel Kookmaatje als Gusty (rechten: app-informatie
  bekijken, releases naar testtracks, release naar productie). Het Google
  Cloud-project heet "Kookmaatje release" en de Play Developer API staat daar aan.
  Je hoeft in Google dus niets nieuws te maken, tenzij Gusty onder een ander
  Play-ontwikkelaarsaccount valt: dan opnieuw een serviceaccount maken en dat
  uitnodigen.

Wil je de sleutels gescheiden houden? Maak `~/.gusty/` en pas `SLEUTELS` in de
Fastfile aan.

## Stappen in de Gusty-repo

1. **Installeer fastlane** (eenmalig per Mac): `brew install fastlane`.
2. **Kopieer `app/fastlane/`** uit Kookmaatje naar Gusty (`Appfile` en `Fastfile`)
   en zet in de Fastfile en Appfile de bundle-id/package-naam van Gusty
   (`PAKKET`, `app_identifier`, `package_name`).
3. **Pas `build.gradle` aan** zodat het versienummer van buiten komt:
   ```
   versionCode = Integer.parseInt((project.findProperty('versionCode') ?: '1').toString())
   ```
   Let op: precies met `=` en `Integer.parseInt`. De eerste versie
   (`versionCode (…).toInteger()`) gaf "Value is null". `versionName` blijft met
   de hand, gelijk aan iOS (`MARKETING_VERSION`).
4. **Voeg de npm-scripts toe** aan `package.json` van de app:
   ```
   "release:indienen": "fastlane ios indienen",
   "release:android": "node ios/controleer-env.mjs && npm run build && cap sync android && fastlane android uitrollen"
   ```
   (`controleer-env.mjs` is de controle op ontbrekende omgevingsvariabelen; heeft
   Gusty die niet, laat die stap weg of pas hem aan.)
5. **TestFlight:** kopieer `ios/testflight.sh` en `ios/ExportOptions.plist`, en
   pas projectnaam, scheme en het team-id (`teamID`) aan.
6. **Android-ondertekening:** Gusty heeft een eigen upload-sleutel nodig
   (`keytool`, een eigen `keystore.properties`). Gebruik niet die van Kookmaatje.
7. **Eerste Play-upload van een nieuwe app** moet soms met de hand in de Play
   Console (app aanmaken, declaraties). Daarna kan de API het.
8. **CLAUDE.md van Gusty:** neem de afspraak over: TestFlight en Play `internal`
   zonder te vragen; indienen bij Apple en Play `production` eerst vragen. Zet er
   een regel bij naar `docs/release.md`.

## Een release draaien

```
npm run testflight                 # iOS naar TestFlight
TRACK=internal npm run release:android   # Google, interne track
npm run release:indienen           # Apple: indienen voor review (eerst vragen)
TRACK=production npm run release:android # Google: live (eerst vragen)
```

Zet vooraf in de shell `export LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8`, anders klaagt
fastlane over de taalinstelling.

## Valkuilen die we tegenkwamen

- **Bouw vanaf de actuele `origin/master`** en kopieer het `.env.local`-bestand
  naar een verse worktree; zonder die bestanden is de build kapot.
- **Het `.p8`-bestand van Apple kun je maar één keer downloaden.** Raak je het
  kwijt, maak dan een nieuwe sleutel.
- **Maak een eigen Google Cloud-project** (niet een bestaand zoals een privéproject).
- **Rechten van een nieuw serviceaccount in de Play Console** kunnen een paar uur
  duren voordat ze werken. Dit gaf bij ons geen probleem.
- **Google weigert een `versionCode` die al bestaat.** Het script haalt het hoogste
  nummer uit alle tracks en gebruikt dat plus 1.
- **Een nieuwe App Store-versie** vraagt een hoger `MARKETING_VERSION` dan wat
  live staat; buildnummers hoogt Apple zelf op.
- **Sleutels nooit in de repo, in commits of in de chat.** Claude verplaatst
  bestanden zonder ze te lezen.
