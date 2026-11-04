# Aanmelden bij Google Play — checklist en teksten

Zelfde app als op iOS (`nl.reinoudtencate.receptenapp`, versie 1.5). Afvinken
wat klaar is. De merknamenregel van de App Store geldt hier ook: geen Albert
Heijn, Jumbo of maaltijdboxmerken in titel, korte beschrijving of op de
screenshots; zet in de beschrijving dat Kookmaatje niet aan hen verbonden is.

## In de repo (klaar)

- [x] Icoon (adaptief + oud) en opstartscherm: `node app/android/ontwerp/maak.mjs`
- [x] Play Store-icoon 512 × 512: `app/android/play/icoon-512.png`
- [x] Ondertekening: `~/.kookmaatje/upload.jks` + `keystore.properties`
      (buiten de repo; **maak een back-up**, zie hieronder)
- [x] Release-build: `cd app && npm run build && npx cap sync android &&
      cd android && ./gradlew bundleRelease` →
      `app/android/app/build/outputs/bundle/release/app-release.aab`
- [x] Privacyverklaring noemt RevenueCat, Apple en Google Play
- [x] Header 1024 × 500: `app/android/play/header-1024x500.png`
- [ ] Verhoog `versionCode` in `app/android/app/build.gradle` bij elke upload
      (Google weigert een nummer dat al gebruikt is); `versionName` volgt iOS

## De sleutel

De upload-sleutel hoort bij Play App Signing: Google bewaart de echte
ondertekeningssleutel, jij uploadt met deze. Raak je 'm kwijt, dan kun je via
de Play Console een nieuwe aanvragen, maar dat kost dagen. Zet toch een
kopie van `~/.kookmaatje/` in je wachtwoordmanager of op een versleutelde
schijf. Nooit in de repo of in de chat.

## In de Play Console (Reinoud)

- [ ] App maken: naam **Kookmaatje**, taal Nederlands (Nederland), app, gratis
- [ ] Declaraties: geen advertenties; geen app voor kinderen
- [ ] **Handelaarsgegevens (DSA)**: verplicht voor wie abonnementen verkoopt;
      adres, telefoon en e-mail komen openbaar op de pagina. Gebruik
      support@kookmaatje.eu waar het mag.
- [ ] **Privacybeleid-URL:** `https://kookmaatje.eu/privacy.html`
- [ ] **Account verwijderen (verplicht bij Google):** in de app staat het onder
      Profiel → Account. Google wil ook een web-adres; gebruik
      `https://kookmaatje.eu/support.html` (staat er al: "Ik wil mijn account
      verwijderen").
- [ ] **Gegevensbeveiliging** (Data safety), zie tabel hieronder
- [ ] **Inhoudsclassificatie:** vragenlijst, alles "nee" (geen geweld, geen
      gokken, wel gebruikerscontent: eigen recepten blijven privé)
- [ ] **Doelgroep:** 18+ (geen kinderen)
- [ ] **Categorie:** Eten en drinken; e-mail support@kookmaatje.eu
- [ ] Store-vermelding: teksten en screenshots hieronder
- [ ] **Abonnement:** Kookmaatje Plus, € 3 per maand (producten → abonnementen),
      daarna in RevenueCat koppelen (service-accountsleutel) en de
      `goog_…`-sleutel in `app/.env.local`
- [ ] **Interne test** eerst: upload de `.aab`, voeg jezelf en Steven toe als
      tester, installeer via de Play Store-link
- [ ] **Gesloten test** (alleen bij een persoonlijk account: 12 testers,
      14 dagen). Een organisatieaccount hoeft dat niet.
- [ ] Productie aanvragen

## Gegevensbeveiliging: wat je invult

Gegevens worden versleuteld verstuurd (https). Gebruikers kunnen verwijdering
vragen (in de app). Niets wordt verkocht. Delen met derden alleen als
dienstverlener.

| Soort gegevens | Verzameld | Gedeeld | Doel |
| --- | --- | --- | --- |
| E-mailadres | ja | nee | account, app-functionaliteit |
| Gebruikers-ID | ja | ja (RevenueCat) | account, aankopen |
| Gezondheidsinfo (allergieën) | ja | nee | app-functionaliteit |
| Recepten, boodschappenlijst (overige gebruikerscontent) | ja | ja, alleen de inhoud van wat je laat uitlezen (Anthropic) | app-functionaliteit |
| Aankoopgeschiedenis | ja | ja (RevenueCat) | app-functionaliteit |
| Productinteractie (onboardingstappen) | ja | nee | analyse |

Foto's en screenshots worden uitgelezen en niet bewaard; geef ze niet op als
"verzameld", maar noem ze wel bij "gedeeld" waar Google dat vraagt.
Locatie, contacten, apparaat-id's en advertentie-id's: niet.

## Teksten

### Nederlands

**Titel (30 tekens):** `Kookmaatje`

**Korte beschrijving (80 tekens):**
`Weekmenu, recepten en boodschappen: kies wat je kookt, de rest regelt de app.`

**Volledige beschrijving:**

```
Elke week weten wat je kookt, zonder gedoe. Kookmaatje maakt van je weekmenu
een boodschappenlijst en zet die met één tik in je mandje bij de supermarkt.

KIES WAT JE KOOKT
Elke week krijg je tien recepten uit een pool van honderden hoofdgerechten.
Jij kiest wat je kookt. Houd je van een keuken, of juist niet? Dat stel je
één keer in. Je cijfer onthoudt de app: favorieten komen vaker terug, wat je
tegenviel verdwijnt.

ÉÉN LIJST, GEEN DUBBELEN
De ingrediënten van al je recepten komen samengevoegd op één lijst. Ui, uien
en gesnipperde ui staan er één keer. Wat je al in huis hebt (de voorraadkast)
komt er niet op.

NAAR JE MANDJE
Met één knop zet je de lijst in je mandje bij Albert Heijn of Jumbo. Wat de
app niet kan koppelen zie je vooraf, zodat je bij de kassa niet voor
verrassingen staat.

RECEPTEN TOEVOEGEN
Plak een link van een website of Instagram, deel een recept vanuit je browser,
maak een screenshot of foto van een kookboekpagina, of typ je eigen recept.
Kookmaatje maakt er een nette versie van in het Nederlands, die jij nog
controleert voor je 'm bewaart.

ZELF EEN MENU LATEN MAKEN
Kies een keuken, het aantal personen en je wensen, en Claude stelt een menu
voor je samen.

HOUD REKENING MET WAT JE NIET MAG OF WILT
Stel je allergieën in en recepten met die ingrediënten verdwijnen uit je
suggesties. Het blijft een hulpmiddel: lees altijd het etiket. Filter ook op
vegetarisch, vegan, pescotarisch, koolhydraatarm of keto.

BESPAARD!
Zie wat je bespaart ten opzichte van een maaltijdbox.

KOOKMAATJE PLUS
Vijf recepten laten uitlezen of samenstellen is gratis. Wil je meer, dan kan
dat met Kookmaatje Plus voor € 3 per maand. Opzeggen kan altijd via Google
Play.

Kookmaatje is niet verbonden aan Albert Heijn, Jumbo of een maaltijdbox. De
namen worden alleen genoemd om te laten zien welke winkel je kiest.
```

### English

**Title:** `Kookmaatje`

**Short description (80):**
`Weekly menu, recipes and groceries: pick what to cook, the app does the rest.`

**Full description:**

```
Know what you're cooking every week, without the hassle. Kookmaatje turns your
weekly menu into a shopping list and puts it in your supermarket basket with
one tap.

(The app and the supermarkets it connects to are Dutch: Albert Heijn and
Jumbo. Recipes are in Dutch.)

PICK WHAT YOU COOK
Every week you get ten suggestions from a pool of hundreds of main dishes.
You choose. Prefer some cuisines over others? Set it once. The app remembers
your ratings: favourites come back, disappointments don't.

ONE LIST, NO DUPLICATES
The ingredients of all your recipes are merged into a single list. Pantry
items you already have stay off it.

ADD YOUR OWN RECIPES
Paste a link from a website or Instagram, share one from your browser,
screenshot or photograph a cookbook page, or type your own. Kookmaatje turns
it into a clean recipe that you check before saving.

LET CLAUDE PLAN A MENU
Pick a cuisine, number of people and your wishes, and get a menu.

ALLERGIES AND DIETS
Set your allergies and recipes containing them disappear from your suggestions.
It's a tool, not a guarantee: always read the label. Filter for vegetarian,
vegan, pescatarian, low-carb or keto.

KOOKMAATJE PLUS
Five recipes extracted or composed are free. For more, Kookmaatje Plus is
€ 3 per month. Cancel any time in Google Play.

Kookmaatje is not affiliated with Albert Heijn, Jumbo or any meal-box service.
```

### Screenshots

Telefoonscreenshots staan klaar in `docs/google-play/screenshots/` (1080 × 2130, van de Samsung A16, statusbalk en navigatiebalk eraf). Eisen: minstens twee, het liefst acht, zijden 320 tot 3840 px en de lange zijde hooguit twee keer de korte.
Maak ze op de Samsung of de emulator, met hetzelfde demo-account als bij
Apple: weekmenu (Mijn recepten), boodschappenlijst, recept, Ontdekken,
Bespaard!, Instellingen. De iOS-screenshots in `docs/app-store/screenshots/`
hebben een andere verhouding en zijn niet bruikbaar. Ook nodig: een
**voorbeeldafbeelding** 1024 × 500 (header) met alleen de K en "Kookmaatje".

## Nog te doen in de code

- **Plus nog niet getest** met een echte Google Play-aankoop.
