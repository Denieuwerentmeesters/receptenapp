# Aanmelden bij de App Store — checklist

Wat Apple nodig heeft voordat Pinch door de review kan. Afvinken wat klaar is.

## In de app (code)

- [x] Account verwijderen in de app (Profiel → Account) — richtlijn 5.1.1(v)
- [x] Privacyverklaring bereikbaar in de app (Account en het inlogscherm)
- [x] Uitleg bij camera en fotobibliotheek (`Info.plist`)
- [x] Geen eigen versleuteling (`ITSAppUsesNonExemptEncryption` = nee)
- [ ] Account verwijderen getest met een wegwerpaccount op productie
- [ ] Recepten van anderen melden — richtlijn 1.2 (zie "Risico's")

## In App Store Connect (Reinoud)

- [ ] **Privacybeleid-URL:** `https://receptenapp.vercel.app/privacy.html`
- [ ] **Support-URL:** `https://receptenapp.vercel.app/support.html`
- [ ] **Demo-account** voor de reviewer (e-mail + wachtwoord) bij App Review
      Information, met een gevuld weekmenu en een paar recepten op de lijst
- [ ] **Notitie voor de reviewer:** de mandjeknop opent ah.nl of jumbo.com in
      Safari; zonder supermarktaccount zie je daar een leeg mandje. Dat is
      geen fout in de app.
- [ ] **Screenshots** 6,9" uit `docs/app-store/screenshots/`
- [ ] **Naam, ondertitel, beschrijving, trefwoorden, categorie** (Eten en drinken)
- [ ] **Leeftijdsclassificatie:** vragenlijst invullen (alles "geen")
- [ ] **App Privacy** (de "voedingslabels"), zie hieronder
- [ ] **Handelaarsstatus (DSA):** verplicht om in de EU te mogen verschijnen.
      Als handelaar komen je adres, telefoonnummer en e-mailadres openbaar
      op de App Store-pagina.
- [ ] **Prijs en beschikbaarheid:** gratis, Nederland (en eventueel België)
- [ ] Build uploaden: `npm run testflight` in `app/`

## App Privacy: wat je invult

Alles is "gekoppeld aan de gebruiker", niets wordt gebruikt om te volgen
(tracking: nee).

| Soort gegevens | Wat | Doel |
| --- | --- | --- |
| Contactgegevens → e-mailadres | het account | App-functionaliteit |
| Gezondheid en fitness → gezondheid | allergieën | App-functionaliteit |
| Gebruikerscontent → overige content | eigen recepten, lijst | App-functionaliteit |
| Aankopen → aankoopgeschiedenis | bevestigde bestellingen (Bespaard!) | App-functionaliteit |
| Identificatiemiddelen → gebruikers-ID | het account-id | App-functionaliteit |

Foto's hoef je niet op te geven: een kookboekfoto wordt uitgelezen en niet
bewaard.

## Risico's bij de review

- **Merknamen (5.2):** Albert Heijn, Jumbo, HelloFresh en Marley Spoon komen
  in de app voor. Noem ze niet in de naam, ondertitel, trefwoorden of op de
  screenshots als verkoopargument, en zet in de beschrijving dat Pinch niet
  aan hen verbonden is.
- **Herkomst van de recepten (5.2):** de pool is van andere sites gehaald.
  Apple kan vragen of je de rechten hebt. Ingrediëntenlijsten zijn niet
  beschermd, bereidingsteksten wel.
- **Gedeelde recepten (1.2):** recepten van gebruikers komen pas na
  goedkeuring door een admin in de pool. Apple vraagt bij content van
  gebruikers ook een manier om iets te melden; die is er nog niet.
- **Allergieën:** de app is een hulpmiddel, geen garantie. "Check het etiket"
  staat er al; herhaal het in de beschrijving.
- **Inloggen verplicht (5.1.1):** de reviewer moet met het demo-account alles
  kunnen zien.
