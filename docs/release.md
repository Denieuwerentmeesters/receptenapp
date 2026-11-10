# Releasen naar Apple en Google (door Claude)

Doel: Reinoud zegt "release de nieuwste versie" en Claude bouwt, uploadt en dient
in, zonder dat iemand zelf in App Store Connect of de Play Console hoeft te klikken
(behalve de goedkeuring, zie "Wat Claude zelf mag").

Dit document is geschreven om ook voor een andere app (Gusty) te hergebruiken:
het deel "Overnemen voor een andere app" onderaan zegt wat je moet aanpassen.

## Wat er staat

| Onderdeel | Waar | Doet |
|---|---|---|
| TestFlight | `npm run testflight` in `app/` (`ios/testflight.sh`) | bouwt, archiveert en uploadt naar App Store Connect. Dit werkte al; het gebruikt de Xcode-login, geen API-sleutel. |
| Indienen bij Apple | `npm run release:indienen` (`fastlane/Fastfile`, lane `ios indienen`) | dient de nieuwste verwerkte build in voor review, zonder automatisch vrij te geven |
| Google Play | `npm run release:android` (lane `android uitrollen`) | zoekt het hoogste `versionCode` in Play, bouwt de `.aab` met dat nummer + 1 (`-PversionCode`) en uploadt naar een track |
| Versienummer Android | `app/android/app/build.gradle` | `versionCode` komt uit `-PversionCode`, standaard 1; `versionName` blijft met de hand, gelijk aan iOS |

Beide lanes gebruiken **fastlane** (`brew install fastlane`).

## Eenmalig instellen (Reinoud)

Alle sleutels staan in `~/.kookmaatje/` (buiten de repo, `chmod 600`, back-up in
je wachtwoordmanager). Nooit in de repo, in commits of in de chat plakken.

### Apple: App Store Connect API-sleutel

1. Ga naar <https://appstoreconnect.apple.com/access/integrations/api>
   (Gebruikers en toegang → Integraties → App Store Connect API → Teamsleutels).
2. Maak een sleutel met de rol **App Manager**. Je kunt het `.p8`-bestand maar
   één keer downloaden.
3. Zet het bestand als `~/.kookmaatje/AuthKey.p8`.
4. Maak `~/.kookmaatje/release.env` met de key-id en de issuer-id die op die
   pagina staan:

   ```
   ASC_KEY_ID=ABC123DEFG
   ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

### Google: serviceaccount voor de Play Developer API

1. Open <https://console.cloud.google.com/> en kies (of maak) een project.
2. Zet de API aan: <https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com>
   ("Google Play Android Developer API" → Inschakelen).
3. Maak een serviceaccount: <https://console.cloud.google.com/iam-admin/serviceaccounts>
   (Serviceaccount maken; rollen in Cloud hoef je niet te geven).
4. Open het account → tabblad Sleutels → Sleutel toevoegen → Nieuwe sleutel →
   JSON. Sla op als `~/.kookmaatje/play-sleutel.json`.
5. Nodig het e-mailadres van het serviceaccount (`…@….iam.gserviceaccount.com`)
   uit in de Play Console: <https://play.google.com/console/users-and-permissions>
   → Nieuwe gebruikers uitnodigen. Geef het recht om **releases te beheren**
   (voor de app Kookmaatje) en om de app-info te bekijken.
6. Het duurt soms een paar uur voordat de rechten werken.

## Zo vraagt Reinoud een release

- "Zet de nieuwste op TestFlight": `npm run testflight` (vanaf verse `origin/master`,
  met `app/.env.local` erbij; zie het geheugen `testflight-env-local-nodig`).
- "Release naar Google": `npm run release:android` met `TRACK=internal` (standaard),
  `alpha`, `beta` of `production`.
- "Dien in bij Apple": `npm run release:indienen`.

Een nieuwe App Store-versie vraagt een hoger `MARKETING_VERSION` (in
`app/ios/App/App.xcodeproj/project.pbxproj`, vier plekken) dan wat al live staat;
buildnummers hoogt Apple zelf op. Houd `versionName` in `build.gradle` gelijk.

## Wat Claude zelf mag

- Zonder te vragen: bouwen, TestFlight, Play-track `internal`.
- Eerst vragen ("Bouw X, naar productie / ter review?"): indienen bij Apple en
  Play-track `production`. Dat is niet terug te draaien en voor gebruikers zichtbaar.
- Een review die Apple of Google afkeurt, uitleggen en oplossen: ja; opnieuw
  indienen: eerst vragen.

## Status

De scripts zijn geschreven maar nog **niet met echte sleutels uitgeprobeerd**
(10 nov 2026). Draai bij de eerste keer eerst `internal` bij Google en kijk bij
Apple of de build klaarstaat vóór `release:indienen`. Lukt iets niet, dan staat
de foutmelding van fastlane er meteen en ontbrekende sleutels worden benoemd.

## Overnemen voor een andere app (Gusty)

1. Kopieer `app/fastlane/` en de twee npm-scripts. Pas `PAKKET` in de Fastfile en
   `Appfile` aan naar de bundle-id/package-naam van Gusty.
2. Zet in `build.gradle` `versionCode` op `project.findProperty('versionCode') ?: 1`.
3. Gebruik dezelfde Apple-teamsleutel (die geldt voor je hele Apple-account). Voor
   Google kan hetzelfde serviceaccount; nodig het ook uit voor de Gusty-app in de
   Play Console. Zet de sleutels in een eigen map (bijv. `~/.gusty/`) en pas
   `SLEUTELS` in de Fastfile aan als je ze gescheiden wilt houden.
4. Vervang in `testflight.sh` en `ExportOptions.plist` het team-id en de
   projectnamen, en kopieer de afspraak "Claude vraagt eerst bij productie of
   review" naar de CLAUDE.md van Gusty.
