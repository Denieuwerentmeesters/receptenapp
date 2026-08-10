# Implementatieplan: wekelijks weekmenu + bestellen bij Albert Heijn / Jumbo

Dit plan beschrijft hoe je bovenop de bestaande receptendataset (`recepten.json`, 581 recepten uit Jamie Oliver, Miljuschka en Uit Paulines Keuken) een app bouwt die:

1. Elke week 10 recepten voorstelt, gefilterd op jouw voorkeuren, waaruit jij zelf kiest wat je daadwerkelijk gaat koken.
2. Een "bestel bij AH/Jumbo"-knop biedt die de ingrediënten van je gekozen recepten met zo min mogelijk klikken in je boodschappenlijst zet — desgewenst automatisch in de biologische variant.
3. Ook een simpele afvinkbare boodschappenlijst biedt voor als je zelf een winkel in loopt.
4. Zelf illustratieve afbeeldingen genereert bij recepten.
5. Recepten uit je eigen kookboeken (via foto, altijd privé) én eigen bedachte recepten (via foto of vrije tekst, optioneel te delen na admin-goedkeuring) laat toevoegen, met AI-extractie van ingrediënten/personen/bereiding.
6. Je wekelijks een pushbericht stuurt met de nieuwe recepten, op een tijdstip dat jij kiest.

## 0. Uitgangssituatie van de data

- 581 recepten, elk met `titel`, `bron`, `url` (link naar origineel), `keuken`, `tags`, gestructureerde `ingredienten` (hoeveelheid/eenheid/naam) en zelf herschreven `bereiding_nl`.
- 221 van de 581 (38%) zijn gecontroleerd op echte vegetarische status op basis van de ingrediëntenlijst (niet alleen een keyword in de titel) en getagd `vegetarisch`.
- Bij 10 getoonde recepten per week gebruik je een grotere pool dan bij het oude plan van 3 recepten — met 581 recepten in de dataset (straks meer, dankzij de kookboek-toevoegingen in sectie 7) kun je nog steeds lang draaien zonder herhaling, zeker met de cooldown-logica uit 1.3.

## 1. Weekmenu-generator (10 recepten, zelf kiezen)

### 1.1 Regel

Elke week toont de app **10 recepten** uit de pool, gefilterd/gewogen volgens je personalisatie-instellingen (sectie 2). Jij bekijkt de 10 en kiest zelf hoeveel en welke je die week daadwerkelijk gaat koken — geen vaste "3 per week"-verplichting meer, de app schotelt voor, jij beslist.

Als startpunt voor de samenstelling van de 10 gebruiken we dezelfde vegetarische verhouding als voorheen (ruwweg 2/3): **minimaal 6 van de 10 vegetarisch**, de rest vrij. Dit is een instelbare parameter (zie `vega_minimum` in sectie 2), geen harde regel — als je liever een andere verhouding wil, pas je 'm aan.

### 1.2 Data die je nodig hebt

Twee dingen om bij te houden:

```
weekmenu_getoond (week_start_datum, recept_url, positie, is_vegetarisch)
weekmenu_gekozen (week_start_datum, recept_url, gekozen_op)   -- welke van de 10 je daadwerkelijk hebt aangevinkt om te koken
```

Het onderscheid tussen "getoond" en "gekozen" is belangrijk voor de cooldown-logica: een recept dat je zag maar niet koos, mag sneller terugkomen dan een recept dat je daadwerkelijk hebt gemaakt.

### 1.3 Algoritme (pseudocode)

```
def genereer_weekmenu(alle_recepten, geschiedenis, voorkeuren, week_start, aantal=10):
    # Cooldown: alleen daadwerkelijk gekookte recepten tellen zwaar mee
    recent_gekookt = recepten_gekookt_in_laatste_n_weken(geschiedenis, n=26)
    recent_getoond_niet_gekookt = recepten_getoond_in_laatste_n_weken(geschiedenis, n=4)  # kortere cooldown

    beschikbaar = [r for r in alle_recepten
                   if r.url not in recent_gekookt
                   and r.url not in recent_getoond_niet_gekookt]

    # Harde filters (sectie 2): dieetwens, uitsluitingen, max bereidingstijd
    beschikbaar = pas_harde_filters_toe(beschikbaar, voorkeuren)

    # Zachte filters: geef recepten uit favoriete keukens een hoger gewicht,
    # zonder andere keukens volledig uit te sluiten
    gewichten = bereken_gewichten(beschikbaar, voorkeuren.favoriete_keukens)

    vega_pool = [r for r in beschikbaar if 'vegetarisch' in r.tags]
    vrij_pool = [r for r in beschikbaar if r not in vega_pool]

    vega_aantal = voorkeuren.vega_minimum  # default 6 van de 10
    gekozen_vega = gewogen_sample(vega_pool, gewichten, k=vega_aantal)
    gekozen_vrij = gewogen_sample(vrij_pool, gewichten, k=aantal - vega_aantal)

    return gekozen_vega + gekozen_vrij
```

Extra verfijningen die de moeite waard zijn zodra de basis werkt:
- Weeg de selectie ook licht naar variatie in `keuken` binnen de 10 (niet 8x Italiaans in dezelfde week, ook al is dat je favoriete keuken).
- Weeg naar `bereidingstijd_minuten` (bijv. een paar van de 10 onder de 30 minuten, voor doordeweekse avonden).
- Laat je een los recept uit de 10 "shuffelen" (vervangen door een nieuwe uit dezelfde pool) als er eentje niet aanspreekt, zonder de hele week te herstarten.

### 1.4 Wanneer genereren

Een wekelijkse cron/scheduled job die de 10 recepten voor de komende week vastzet en opslaat — niet dynamisch bij elk bezoek opnieuw berekenen, anders verandert de lijst elke keer dat je de app opent. Dit moment ligt vóór het pushbericht-tijdstip dat je instelt (sectie 8), zodat de app al klaarstaat op het moment dat de melding binnenkomt.

## 2. Personalisatie & filters

### 2.1 Wat je wil kunnen instellen

- **Favoriete keukens** — bijv. Italiaans, Aziatisch, Mexicaans. Recepten uit deze keukens krijgen een hoger gewicht bij het samenstellen van de 10 (zacht filter: verhoogt de kans, sluit andere keukens niet uit).
- **Vega-minimum** — hoeveel van de 10 minimaal vegetarisch moeten zijn (default 6, zie 1.1).
- **Max bereidingstijd** — optioneel hard filter, bijv. "toon nooit recepten boven de 60 minuten" doordeweeks.
- **Biologisch-voorkeur** — aan/uit; bepaalt welke productvariant er straks bij AH/Jumbo geselecteerd wordt (zie sectie 4.3).
- **Aantal personen** — voor hoeveel mensen je kookt; schaalt de ingrediëntenhoeveelheden automatisch (zie 2.4).
- **Pushbericht-moment** — dag + tijdstip waarop je de wekelijkse melding wil ontvangen (zie sectie 8).

### 2.2 Datamodel

```
gebruiker_voorkeuren (
  gebruiker_id,
  favoriete_keukens,       -- lijst, bv. ['italiaans', 'aziatisch']
  vega_minimum,            -- default 6 (van de 10)
  max_bereidingstijd,      -- nullable
  biologisch_voorkeur,     -- boolean, default false
  voorkeurswinkel,         -- 'ah' | 'jumbo'
  aantal_personen,         -- default 4 (of wat je zelf standaard instelt)
  pushbericht_dag,         -- bv. 'zondag'
  pushbericht_tijd         -- bv. '17:00'
)
```

Eén rij is genoeg zolang de app alleen voor jezelf is; zodra je 'm ooit met iemand anders deelt, wordt dit een tabel met één rij per gebruiker.

### 2.3 Hard vs. zacht filteren

Onderscheid dit bewust: harde filters (dieetwens, max bereidingstijd) *sluiten* recepten uit de pool. Zachte filters (favoriete keuken) *verhogen alleen de kans* dat een recept gekozen wordt. Dat voorkomt dat je pool te klein wordt als je bijvoorbeeld maar 2 favoriete keukens instelt — je krijgt dan vooral, maar niet uitsluitend, die keukens te zien.

### 2.4 Portiegrootte aanpassen (aantal personen)

Elk recept in de dataset heeft al een basis-`personen`-veld (bijv. "4 personen", zoals op de bronsite vermeld). Als jij instelt dat je voor 5 in plaats van 4 personen kookt, moeten alle hoeveelheden in de ingrediëntenlijst evenredig mee omhoog (of omlaag) — in dit voorbeeld dus 25% meer van elk ingrediënt.

**Rekenregel:**

```
schaal_factor = gewenst_aantal_personen / recept.personen

voor elk ingrediënt in recept.ingredienten:
    nieuwe_hoeveelheid = ingredient.hoeveelheid * schaal_factor
```

Praktische kanttekeningen bij het toepassen hiervan:
- Dit gebeurt **on the fly** bij het tonen van het recept en bij het samenstellen van de boodschappenlijst (secties 4 en 5) — je slaat geen herschaalde hoeveelheden op, alleen de basis-hoeveelheid uit het recept plus de gewenste `aantal_personen` uit je voorkeuren. Zo blijft de brondata onaangetast en werkt schalen ook met terugwerkende kracht op recepten die je al eerder toevoegde.
- Rond verstandig af voor weergave (bijv. "1,3 ui" oogt raar) — gebruik hele of halve stuks bij telbare items ("stuks", "teentjes") en gewone decimalen bij gewicht/volume ("gr", "ml").
- Sommige ingrediënten schalen niet netjes lineair (bijv. "1 snufje zout" of "1 laurierblad" blijft vaak gewoon 1, ongeacht het aantal personen). Voor de eerste versie is lineair schalen van alles een prima startpunt; je kunt later een lijstje "schaalt niet mee"-eenheden toevoegen (zoals `snufje`, `blaadje`) als dat in de praktijk vreemd uitpakt.
- De boodschappenlijst (sectie 5) en de AH/Jumbo-aantallen (sectie 4) gebruiken beide de al-geschaalde hoeveelheid, zodat je nooit zelf handmatig hoeft om te rekenen.

## 3. Technische opzet

Gezien je al met Next.js en Supabase werkt (zoals in je andere projecten), is de meest voor de hand liggende stack:

- **Next.js** app (of een pagina binnen een bestaand project) voor de UI.
- **Supabase (Postgres)** voor:
  - `recepten` — een import van `recepten.json` (of blijf het JSON-bestand gebruiken als de dataset klein blijft).
  - `weekmenu_getoond` / `weekmenu_gekozen` — sectie 1.2.
  - `gebruiker_voorkeuren` — sectie 2.2.
  - `ah_product_cache` — zie sectie 4, nu met een kolom voor de biologische variant.
  - `recepten` zelf krijgt de uitbreiding uit sectie 7.4 (`toegevoegd_door_gebruiker_id`, `bron_type`, `deel_status`) — geen aparte tabel nodig, zelf toegevoegde recepten leven gewoon tussen de rest.
- **Supabase Storage** (of S3) voor de gegenereerde receptafbeeldingen (sectie 6) en de geüploade kookboekfoto's (sectie 7).
- Een **scheduled function** (Supabase Edge Function met cron, of een Vercel cron job) die wekelijks het menu genereert (sectie 1.4).
- Een **tweede scheduled function**, uurlijks, die per gebruiker checkt of dit het uur is waarop hun pushbericht verstuurd moet worden (sectie 8 — cron-granulariteit is meestal per uur, niet per exacte minuut, dus dit vangt dat netjes op).
- Een **image-generatie-API** (bijv. via een externe beeldgeneratie-dienst) voor sectie 6.
- Een **vision/OCR-API** (een model dat foto's kan lezen) voor het uitlezen van kookboekfoto's in sectie 7.

## 4. Koppeling met Albert Heijn / Jumbo — bevestigd werkend mechanisme

**Update:** mijn eerdere voorzichtige inschatting ("waarschijnlijk verouderd, test het zelf even") is achterhaald door een concrete waarneming. Op de receptpagina's van Uit Paulines Keuken staat een knop "Direct in je mandje bij AH/Jumbo", en toen de AH-variant van die knop werd gebruikt vuurde 'm daadwerkelijk deze URL af:

```
https://www.ah.nl/mijnlijst/add-multiple?p=561331:1&p=449311:1&p=4088:1&p=169797:2&p=490280:1&p=198416:1&p=414995:1&p=234856:1&p=579885:1&p=602497:1&p=212539:1&p=231211:2&utm_order=019fdb60-77e1-7291-b2e5-d272611850be&clickref=1110l4hLWeqd&utm_medium=affiliate&utm_source=fiu_uitpaulieskeuken&utm_content=0&utm_campaign=koopknop
```

Dit landde op AH.nl op een pagina getiteld "Je winkelmandje" — het mechanisme werkt dus **vandaag nog écht**, live getest, geen aanname. Het Jumbo-equivalent van deze knop hebben we nog niet zelf afgevangen (we weten dat de knop bestaat, niet welke URL hij afvuurt) — dat is nog te onderzoeken op dezelfde manier: de knop op een receptpagina gebruiken terwijl je het netwerkverkeer meekijkt.

### 4.1 Wat de AH-URL betekent

| Parameter | Betekenis |
|---|---|
| `p=PRODUCTID:AANTAL` (herhaald per artikel) | Eén AH-webshopproduct + gewenst aantal. Dit is de kern van het mechanisme — elke `p=` voegt één regel toe aan je AH-boodschappenlijst. |
| `utm_order` | Een UUID, waarschijnlijk een sessie/order-referentie die de widget zelf genereert. |
| `clickref` | Een affiliate-trackingcode (herkenbaar formaat van het Awin-affiliatenetwerk) — hiermee krijgt de verwijzende partij commissie. |
| `utm_source=fiu_uitpaulineskeuken` | Herkent welke site de verwijzing stuurde. Het `fiu_`-voorvoegsel wijst erop dat dit een gedeeld widget-platform is dat door meerdere Nederlandse receptensites gebruikt wordt. |
| `utm_campaign=koopknop` | Simpelweg een campagnelabel ("koopknop" = buy button). |

### 4.2 Wat dit betekent voor jouw app

Voor persoonlijk gebruik heb je geen affiliate-account of goedkeuring nodig — je bent geen verwijzende partij die commissie claimt, je bouwt gewoon je eigen boodschappenlijst. De kern van de URL is simpelweg:

```
https://www.ah.nl/mijnlijst/add-multiple?p=PRODUCTID1:AANTAL1&p=PRODUCTID2:AANTAL2&...
```

De `utm_*`- en `clickref`-parameters zijn hoogstwaarschijnlijk optioneel (puur tracking, geen verplicht beveiligingskenmerk).

**Enige overgebleven puzzelstuk: productID's vinden per ingrediënt.** Dat nummer (bv. `561331`) is AH's eigen webshop-product-ID, niet iets wat in jouw receptendata staat. Praktische aanpak:
1. Zoek een ingrediënt op ah.nl, open het productdetailscherm, en lees het ID uit de URL van die productpagina.
2. Bouw een kleine mapping-tabel (`ingredient_naam → ah_product_id`) — begin met je meest gebruikte basisingrediënten, die dekken een groot deel van je recepten meteen.
3. Voor ingrediënten die nog niet gemapt zijn: val terug op een simpele zoeklink (`ah.nl/zoeken?query=...`) zodat de app nooit vastloopt.

### 4.3 Biologische variant selecteren

Je wil dat de app, als je dat instelt (sectie 2.1), automatisch de biologische versie van een product kiest in plaats van de standaardversie. Dat vraagt om een kleine uitbreiding van de mapping-tabel:

```
ah_product_cache (
  ingredient_naam,
  standaard_product_id,
  bio_product_id,        -- nullable: niet elk ingrediënt heeft een bio-variant
  laatst_geverifieerd
)
```

Bij het opbouwen van de mapping (stap 1 hierboven) zoek je dan meteen ook even of er een "Biologisch"-productlijn-variant bestaat voor hetzelfde ingrediënt, en sla je beide ID's op. Bij het genereren van de `add-multiple`-link kijkt de app dan naar `gebruiker_voorkeuren.biologisch_voorkeur`:
- Staat 'ie aan én is er een `bio_product_id`: gebruik die.
- Staat 'ie aan maar is er geen bio-variant (bijv. bij sommige specerijen of merkproducten): val terug op `standaard_product_id` — beter een niet-biologisch artikel op de lijst dan een ontbrekend artikel.
- Staat 'ie uit: gebruik altijd `standaard_product_id`.

Dezelfde structuur kan later hergebruikt worden voor een `jumbo_product_cache`, zodra sectie 4's Jumbo-mechanisme is uitgezocht en `voorkeurswinkel` in de praktijk gebruikt wordt.

### 4.4 Werkt dit ook vanuit de AH-app, of alleen op de website?

Waarschijnlijk ook vanuit de app, zonder dat wij daar iets speciaals voor hoeven te bouwen. De link is gewoon een `ah.nl`-URL, en grote apps registreren zich doorgaans als handler voor hun eigen websitelinks (Universal Links op iOS, App Links op Android) — als iemand de AH-app heeft geïnstalleerd, onderschept het besturingssysteem zo'n link en opent 'm rechtstreeks in de app, met dezelfde login die je daar al hebt. Onze app hoeft dus geen onderscheid te maken tussen "app" en "website": het is exact dezelfde `add-multiple`-link, en wat ermee gebeurt bepaalt de telefoon (in combinatie met AH's eigen linkregistratie), niet onze code.

Twee dingen om in het achterhoofd te houden:
- We hebben tot nu toe alleen bevestigd dat de link werkt als gewone browser-navigatie (landt op "Je winkelmandje" op ah.nl); of 'm automatisch naar de AH-app springt op een telefoon met de app geïnstalleerd is aannemelijk maar niet apart getest.
- Als onze eigen app ooit een "echte" native app wordt (i.p.v. de PWA uit sectie 3), moet de link geopend worden via de systeem-linkopener, niet vanuit een ingebouwd webviewtje in onze eigen app — dat laatste onderschept deep links vaak niet, waardoor je dan alsnog op de kale mobiele website belandt in plaats van in de AH-app.

### 4.5 Aanpak in fases

**Fase 1 — bouw dit eerst, werkt gegarandeerd**
Een samengevoegde, gededupliceerde boodschappenlijst van je gekozen recepten, met voor elk artikel dat al een productID heeft de `add-multiple`-link, en voor de rest een zoeklink als terugval.

**Fase 2 — de 1-klik-knop, incl. biologische variant**
Zodra je een redelijke ingrediënt→productID-mapping hebt opgebouwd (incl. bio-ID's waar beschikbaar, zie 4.3), bouw je één knop die alle ingrediënten in één `add-multiple`-aanroep in je AH-lijst zet, met automatische bio-selectie als je die voorkeur aan hebt staan.

**Fase 3 — Jumbo erbij**
Zodra het Jumbo-mechanisme is uitgezocht (zie boven), voeg je `voorkeurswinkel` toe als schakelaar en herhaal je fase 1–2 voor Jumbo.

**Fase 4 — optioneel, hoger risico**
Automatisch productID's opzoeken via een onofficiële zoek-API in plaats van handmatig mappen. Sneller, maar afhankelijk van een niet-officieel ondersteund endpoint dat zonder aankondiging kan wijzigen. Alleen de moeite waard als de handmatige mapping je te veel onderhoud kost.

## 5. Boodschappenlijst-modus: zelf lopen (Lidl, of gewoon niet AH/Jumbo)

Naast de winkelkoppeling wil je ook een simpele, afvinkbare boodschappenlijst voor wanneer je zelf naar een winkel loopt (bijv. de Lidl). Dit is een apart, eenvoudiger stuk functionaliteit dat volledig los staat van de productID's uit sectie 4 — je hebt er dus niks van sectie 4 voor nodig.

### 5.1 Wat het moet doen

- Alle ingrediënten van je gekozen recepten samengevoegd tot één lijst (zelfde samenvoeg-/dedupliceerlogica als de boodschappenlijst uit Fase 1).
- Elk item is aan te vinken; aangevinkte items krijgen een doorstreping (net als een to-do-lijstje).
- Je kan zelf vrije, extra items toevoegen die niets met de recepten te maken hebben (bv. "afwasmiddel", "koffie") — die verschijnen gewoon onderaan dezelfde lijst en zijn ook aan te vinken.
- De lijst en de aangevinkte status blijven bewaard zolang de week loopt, zodat je halverwege de winkel de app kan sluiten en later verder kan gaan waar je gebleven was.
- Optioneel: als `biologisch_voorkeur` aanstaat, toon een klein "bio"-label naast items waarvoor dat relevant is — puur informatief, want hier is geen productID nodig.

### 5.2 Datamodel

Eén simpele tabel is genoeg:

```
boodschappenlijst_item (
  id,
  week_start_datum,
  naam,
  hoeveelheid,          -- nullable, alleen relevant voor receptitems
  eenheid,              -- nullable
  bron_type,            -- 'recept' | 'extra'
  bron_recept_url,       -- nullable, welk recept dit item opleverde (null bij 'extra')
  is_afgevinkt           -- boolean, default false
)
```

Bij het genereren van het weekmenu (sectie 1.4) vul je deze tabel automatisch met de samengevoegde receptingrediënten van de recepten die je *koos* (`bron_type = 'recept'`). Handmatig toegevoegde items krijgen `bron_type = 'extra'`. Afvinken is simpelweg `is_afgevinkt` togglen — geen aparte tabel nodig.

### 5.3 UI

- Eén lijstweergave met checkboxes, gegroepeerd of niet (optioneel: groeperen per recept dat het item veroorzaakte, met een aparte sectie "overig" voor de losse extra's).
- Aangevinkte items: doorstreept en (optioneel) onderaan de lijst verplaatst zodat je bovenaan altijd ziet wat je nog moet halen.
- Een invoerveld onderaan om snel een los item toe te voegen ("+ item toevoegen"), dat direct in dezelfde lijst verschijnt.
- Deze modus en de AH/Jumbo-1-klik-knop (sectie 4) staan naast elkaar — je kiest per week (of per boodschappenmoment) welke je gebruikt, ze gebruiken dezelfde onderliggende ingrediëntenlijst als bron.

## 6. Receptafbeeldingen genereren

Veel recepten in de dataset hebben nog geen eigen afbeelding, of verwijzen (hotlinken) naar een foto op de bronsite — dat laatste is prima voor persoonlijk gebruik, maar niet iets om op te bouwen als je de app later breder wil gebruiken (zie ook de kanttekening in sectie 11). Je wil daarom voor de recepten die je toevoegt zelf een illustratieve afbeelding laten genereren.

### 6.1 Aanpak

- Voor elk recept dat nog geen eigen (gegenereerde) afbeelding heeft: genereer er een via een beeldgeneratie-API, met een prompt opgebouwd uit `titel` + de belangrijkste ingrediënten (bv. "een appetijtelijke foto van [titel], met [hoofdingrediënten], op een bord, food photography stijl").
- Dit is een **batchjob**, geen live aanroep bij elk paginabezoek — je genereert één keer per recept en slaat het resultaat op, zowel voor kostenbeheersing als snelheid.
- Sla de gegenereerde afbeelding op in Supabase Storage (of S3) en zet `afbeelding_url` op die eigen locatie, niet op de bron-URL.

### 6.2 Datamodel-uitbreiding

Voeg een `afbeelding_bron`-veld toe aan elk receptobject:

```
afbeelding_url    -- nu wijzend naar je eigen storage
afbeelding_bron   -- 'gegenereerd' | 'origineel_bron' (hotlink) | 'kookboek_foto' | 'eigen_foto' (sectie 7)
```

Zo weet je later altijd of een plaatje zelf gegenereerd is, van de bronsite komt, van je eigen kookboek is, of een foto die je zelf bij een eigen recept toevoegde.

### 6.3 Welke dienst?

Er zijn meerdere beeldgeneratie-API's geschikt hiervoor (bijv. via OpenAI's image-API, Google's Gemini image-generatie, of Stable Diffusion-achtige diensten). Dit is vooral een kostenafweging (prijs per afbeelding × ~580 recepten) en een smaakkwestie (welke stijl je het prettigst vindt) — de technische integratie is in alle gevallen vergelijkbaar: prompt in, afbeeldings-URL of -bestand terug, opslaan in je eigen storage.

## 7. Recepten zelf toevoegen (kookboek-foto's én eigen recepten)

Je wil recepten kunnen toevoegen op twee manieren: (a) een foto van een pagina uit een fysiek kookboek, en (b) een eigen recept — iets wat je zelf hebt bedacht of altijd "op gevoel" maakt — waarbij AI uitleest wat de ingrediënten zijn, voor hoeveel personen het is, en hoe je het maakt. Beide routes zijn een backend/invoerfunctie, geen scraper, en landen in hetzelfde schema als de rest van de dataset. Nieuw hierbij: je wil zo'n zelf toegevoegd recept ook kunnen delen met de algemene database (zichtbaar voor iedereen die de app gebruikt), of 'm liever voor jezelf houden.

### 7.1 Twee invoermethodes

- **Kookboek-foto**: je maakt een of meer foto's van een kookboekpagina (titel + ingrediënten + bereiding, eventueel over meerdere foto's als een recept over twee pagina's loopt) en uploadt ze in de app.
- **Eigen recept**: je typt (of spreekt/dicteert, als je dat later wil toevoegen) in vrije tekst hoe je het gerecht maakt — "ik doe ui, knoflook en gehakt in de pan, dan tomatenblokjes erbij, 20 minuten laten sudderen, voor 4 personen" — eventueel aangevuld met een foto van het eindresultaat. Geen vaste structuur nodig; dat is precies waar de AI-extractie voor is.

Beide routes komen in dezelfde vervolgstap terecht.

### 7.2 AI-extractie en controle

1. Een AI-model (vision-model bij een foto, taalmodel bij vrije tekst) leest de invoer en zet 'm om in gestructureerde velden: `titel`, `ingredienten` (hoeveelheid/eenheid/naam), `personen`, `bereidingstijd_minuten` (indien af te leiden of expliciet vermeld), en `bereiding_nl` als stappenlijst.
2. De app toont dit als een **concept-scherm** waarin jij de uitgelezen/geïnterpreteerde tekst controleert en corrigeert voordat het opgeslagen wordt — bij een foto omdat OCR niet feilloos is, bij vrije tekst omdat de AI soms een verkeerde aanname doet over een hoeveelheid of stap.
3. Pas na jouw akkoord wordt het recept daadwerkelijk opgeslagen.

### 7.3 Privé of delen met iedereen — met een belangrijk onderscheid tussen de twee invoermethodes

Dit ligt niet voor beide invoermethodes hetzelfde:

- **Kookboek-foto: mag nooit gedeeld worden, altijd privé.** Een recept uit een boek is niet van jou om te delen — dat blijft onherroepelijk in je eigen, persoonlijke deel van de database. Er is voor dit type geen "delen"-keuze in de UI; die optie wordt niet eens getoond. In plaats daarvan toont het concept-scherm (7.2) bij een kookboek-foto altijd een duidelijke, niet te missen melding: *"Dit recept komt uit een kookboek en mag niet gedeeld worden — het blijft alleen voor jou zichtbaar."* Dit is geen instelling die de gebruiker kan omzeilen; de app dwingt het af op basis van `bron_type = 'kookboek_foto'`.
- **Eigen recept (je eigen creatie): mag wél gedeeld worden, maar pas na goedkeuring.** Bij het opslaan kies je **privé** (default) of **aanmelden voor delen**. Kies je het laatste, dan komt het recept niet meteen live in de gedeelde pool — het gaat eerst in een goedkeuringswachtrij. Pas als de admin (dat ben jij, in de eerste versie) het recept goedkeurt, wordt het zichtbaar voor iedereen.

### 7.4 Datamodel

Dit voegt een lichte multi-user-laag toe aan wat tot nu toe een eenpersoons-datamodel was: een recept heeft voortaan een eigenaar en een deel-status.

```
recept (
  ...bestaande velden...,
  toegevoegd_door_gebruiker_id,   -- nullable; null = onderdeel van de oorspronkelijke gescrapete dataset
  bron_type,                      -- 'scraper' | 'kookboek_foto' | 'eigen_input'
  deel_status                     -- 'privé' | 'aangevraagd' | 'goedgekeurd' | 'afgewezen', default 'privé'
)
```

De regel zit 'm in hoe de app `deel_status` behandelt afhankelijk van `bron_type`:
- `bron_type = 'kookboek_foto'` → `deel_status` staat vast op `'privé'` en kan nooit iets anders worden. Geen UI-optie om dit te wijzigen.
- `bron_type = 'eigen_input'` → `deel_status` mag van `'privé'` naar `'aangevraagd'` (gebruiker vraagt aan om te delen), en alleen een admin-actie mag dat omzetten naar `'goedgekeurd'` (nu pas zichtbaar voor iedereen) of `'afgewezen'` (blijft voor de uploader zelf gewoon bruikbaar, alleen niet gedeeld).
- Alleen recepten met `deel_status = 'goedgekeurd'` verschijnen in de gedeelde pool waar andere gebruikers uit kunnen putten (sectie 1's weekmenu-generator).

Praktisch voor de eerste versie (jij bent de enige gebruiker): dit hele mechanisme bestaat al wel in het datamodel en de UI, maar heeft nog geen praktisch effect totdat er een tweede gebruiker is. Op dat moment is de enige echte vervolgstap een simpel gebruikersaccount-systeem (Supabase Auth leent zich hier goed voor, aangezien je al Supabase gebruikt) zodat `toegevoegd_door_gebruiker_id` iets betekenisvols wordt.

### 7.5 Bron en herkomst

- Bij een kookboek-foto: `bron` = de titel van het kookboek (en auteur, indien je die invult) in plaats van een sitenaam; `url` = leeg/`null`, de ene bewuste uitzondering op de regel "elk recept heeft een link naar de bron", simpelweg omdat een fysiek boek geen URL heeft.
- Bij een eigen recept: `bron` = "Eigen recept" (of jouw naam, zodra er meerdere gebruikers zijn); `url` = ook leeg/`null`.
- `afbeelding_bron` = `'kookboek_foto'` of `'eigen_foto'` als je zelf een foto meegeeft, anders val je terug op sectie 6's gegenereerde afbeelding.

### 7.6 Auteursrecht en goedkeuring

Voor kookboek-recepten speelt copyright juist de hoofdrol in waarom delen hier niet mag: het overtypen/overnemen van een recept uit een boek dat je zelf bezit, voor puur persoonlijk gebruik, valt onder persoonlijk gebruik — maar zodra je zoiets met anderen zou delen, overschrijd je die grens (het boek is niet van jou om te herpubliceren, ook niet herschreven). Daarom is dit in 7.3 hard dichtgezet, niet als suggestie maar als afdwingbare regel.

Voor eigen recepten speelt auteursrecht niet: het is jouw eigen creatie, dus geen bronvermeldingsplicht richting derden. Wél is er nu een **goedkeuringsstap**: elk verzoek om te delen (`deel_status = 'aangevraagd'`) belandt in een wachtrij die de admin (jij) beoordeelt voordat het live gaat. Dat is een bewuste, menselijke controle — geen automatische publicatie. Een lichte geautomatiseerde voorcheck (hetzelfde AI-model dat de extractie doet, stap 7.2, kort laten checken op overduidelijk ongepaste content) kan de wachtrij verkleinen voordat een mens 'm bekijkt, maar vervangt de admin-goedkeuring niet — die blijft de uiteindelijke poort.

### 7.7 Admin-goedkeuringsscherm

Een simpel overzicht (alleen zichtbaar voor de admin-rol) met alle recepten waarvan `deel_status = 'aangevraagd'`: titel, ingrediënten, bereiding en wie het aanmeldde, met twee knoppen — goedkeuren of afwijzen. Voor de eerste versie (jij als enige gebruiker én enige admin) is dit een kort lijstje dat je af en toe bekijkt; het datamodel en de UI staan er wel al klaar voor zodra er meerdere mensen recepten gaan aanmelden.

### 7.8 Technisch

Hergebruikt dezelfde vision/taal-API die je eventueel ook voor sectie 6 aanhoudt. De uitvoer moet in hetzelfde JSON-schema landen als de rest van `recepten.json` (met de uitbreidingen uit 7.4), zodat de weekmenu-generator (sectie 1) geen onderscheid hoeft te maken tussen gescrapete, kookboek- en eigen recepten — alleen `deel_status` (en de harde `bron_type`-regel uit 7.3) bepaalt straks nog of een recept in de gedeelde pool zit.

## 8. Pushberichten

Je wil elke week een pushbericht met de nieuwe (10) recepten, op een zelf ingesteld moment.

### 8.1 Wat het moet doen

- Eén pushbericht per week, verstuurd op het `pushbericht_dag` + `pushbericht_tijd` uit je voorkeuren (sectie 2.2).
- Inhoud: korte samenvatting ("Je weekmenu staat klaar — 10 nieuwe recepten, waarvan 6 vegetarisch") met een link die direct naar het weekmenu-overzicht in de app gaat.
- Instelbaar in de app zelf (instellingenscherm, sectie 9), niet iets waar je in code voor moet duiken als je het wil aanpassen.

### 8.2 Technisch

Twee praktische routes, afhankelijk van hoe de app draait:
- **Als PWA (Progressive Web App)**: de Web Push API + een service worker. Werkt op de meeste platforms zonder appstore-gedoe, wel wat opzetwerk (VAPID-keys, subscription opslaan per device).
- **Als je een losse mobiele app overweegt**: APNs (iOS) / FCM (Android), of eenvoudiger, een kant-en-klare dienst zoals OneSignal die beide platforms + web abstraheert achter één simpele API — dat scheelt vooral opstarttijd t.o.v. zelf de rauwe push-infrastructuur bouwen.

Voor een persoonlijk project is de OneSignal-achtige route (of gewoon web push als het toch een PWA wordt) het snelst werkend te krijgen.

### 8.3 Planning van het versturen

Omdat elke gebruiker een eigen `pushbericht_dag`/`pushbericht_tijd` kan instellen, is de scheduled function (sectie 3) een **uurlijkse** cron die controleert: "voor welke gebruikers is dit precies het ingestelde uur op de ingestelde dag?" en alleen aan hen verstuurt. Voor jou als enige gebruiker is dit in de praktijk gewoon één check per uur die 51 van de 52 weken niks doet en op het juiste moment één bericht stuurt — maar de opzet is meteen klaar voor meerdere gebruikers met verschillende voorkeuren.

## 9. UI-flow (minimale versie)

1. **Startscherm**: 10 kaarten voor de recepten van deze week (foto, titel, keuken, bereidingstijd, vegetarisch-badge), met een simpele manier om aan te vinken welke je gaat koken.
2. **Recept-detail**: ingrediëntenlijst, herschreven bereiding, link "bekijk origineel op [bron]" (verplicht voor webrecepten, staat al in de data; bij kookboek- of eigen recepten staat hier de boektitel of "eigen recept" i.p.v. een link, zie 7.5), plus een badge als het een goedgekeurd, gedeeld recept van iemand anders is.
3. **Boodschappenlijst-scherm**: alle ingrediënten van je gekozen recepten samengevoegd, met twee acties naast elkaar: de AH/Jumbo-bestelknop (sectie 4) én de afvinkbare lijst met vrije extra items (sectie 5).
4. **Instellingenscherm**: favoriete keukens, vega-minimum, max bereidingstijd, biologisch-voorkeur, voorkeurswinkel, aantal personen, pushbericht-dag en -tijd (secties 2 en 8).
5. **Recept toevoegen**-scherm: kies kookboek-foto of eigen recept (foto/tekst), concept controleren/corrigeren, opslaan — bij kookboek-foto altijd privé (met de verplichte melding), bij eigen recept een keuze tussen privé en aanmelden voor delen (sectie 7).
6. **Admin-goedkeuringsscherm** (alleen voor de admin-rol): overzicht van aangemelde eigen recepten, goedkeuren of afwijzen (sectie 7.7).
7. **"Volgende week"**-knop (of automatisch elke maandag) om het nieuwe menu te tonen; oude weken blijven inzichtelijk in een geschiedenis, met zichtbaar welke je toen daadwerkelijk kookte.

## 10. Bouwvolgorde (aanbevolen)

1. **Datamodel + weekmenu-generator** (sectie 1) met de 10-recepten-en-zelf-kiezen-logica — werkt volledig los van AH/Jumbo, dus dit kan meteen.
2. **Personalisatie-instellingen** (sectie 2) — de generator uit stap 1 heeft dit al nodig voor de keuken-weging en het vega-minimum, dus dit hoort er vroeg bij.
3. **UI**: weekmenu-overzicht (10 kaarten + kiezen), receptdetail, instellingenscherm (sectie 9.1, 9.2, 9.4).
4. **Boodschappenlijst-samenvoeging + afvinkbare lijst met eigen extra's** (sectie 5) — werkt zonder enige winkelkoppeling en levert meteen praktische waarde.
5. **AH Fase 1 en 2** (zoeklink als terugval, daarna de bevestigde `add-multiple`-knop incl. biologische variant, sectie 4.3 en 4.5) zodra je een startmapping van productID's hebt.
6. **Pushberichten** (sectie 8) — relatief op zichzelf staand, kan zodra de kernflow (stap 1–4) staat.
7. **Receptafbeeldingen genereren** (sectie 6) — een batchjob die je los op de bestaande dataset kan loslaten, onafhankelijk van de rest van de bouwvolgorde.
8. **Recepten zelf toevoegen** (sectie 7) — kookboek-foto's (altijd privé, met de verplichte melding) en eigen recepten (privé of aanmelden voor delen) met AI-extractie, plus het admin-goedkeuringsscherm (7.7); technisch onafhankelijk van de rest, bouw dit wanneer het je uitkomt, het voegt alleen nieuwe recepten toe aan dezelfde pool. Het `deel_status`-veld kan meteen mee, ook al is er nog maar één gebruiker (en dus ook maar één admin: jij).
9. **Jumbo erbij + Fase 4 (automatische productID-lookup)** — pas overwegen als de rest een tijdje in gebruik is en bevalt.
10. **Echt multi-user maken** (gebruikersaccounts via Supabase Auth) — pas de moeite waard zodra je daadwerkelijk met iemand anders de gedeelde receptenpool wil gebruiken; tot die tijd doet stap 8's `deel_status`-veld voor eigen recepten nog niets zichtbaars (en kookboek-recepten blijven sowieso altijd privé), maar staat de app er al klaar voor.

## 11. Fase 2 (later — niet nu bouwen): sociale features

Een idee voor later: de app echt interactief/sociaal maken. Als jij een eigen recept deelt en het wordt door de admin goedgekeurd (sectie 7.3/7.7), en iemand anders gebruikt het, krijg jij daar als uploader "kudo's" voor terug. Dit geldt uiteraard alleen voor eigen recepten die goedgekeurd en dus gedeeld zijn — kookboek-recepten kunnen sowieso nooit gedeeld worden (sectie 7.3), dus daar is ook nooit een kudo op te krijgen. Dit staat hier bewust apart van de bouwvolgorde in sectie 10 — **dit is fase 2, niet iets om nu al te bouwen**, maar wel vastgelegd zodat het niet kwijtraakt.

### 11.1 Wat het zou moeten doen

- Wanneer iemand een gedeeld recept van een ander toevoegt aan zijn weekmenu, kookt, of expliciet waardeert, krijgt de oorspronkelijke uploader daar een kudo voor.
- De uploader ziet ergens (bijv. een profielscherm) hoeveel kudo's zijn/haar recepten in totaal hebben opgeleverd, en misschien welk recept het populairst is.
- Optioneel: een pushbericht ("je recept [titel] kreeg een kudo van [naam]") als leuke, niet-opdringerige melding — dit zou hergebruiken wat sectie 8 al aan push-infrastructuur opzet.
- Optioneel, verder weg: iets als een simpel leaderboard ("meest gewaardeerde recepten deze maand") als extra motivatie om te delen.

### 11.2 Twee manieren om een kudo te laten ontstaan

- **Expliciet**: een duidelijke "kudo geven"-knop op een receptdetailpagina (vergelijkbaar met een like/ster) — simpel te bouwen, en de betekenis is voor iedereen duidelijk.
- **Impliciet/automatisch**: een kudo (of losse teller) die vanzelf ontstaat zodra iemand het recept daadwerkelijk aan zijn `weekmenu_gekozen` (sectie 1.2) toevoegt — meet echt gebruik in plaats van alleen waardering, maar voelt minder "sociaal" aan dan een bewuste like.

Beide kunnen naast elkaar: een automatische "X keer gekookt door anderen"-teller als eerlijke gebruiksstatistiek, plús een losse, bewuste kudo-knop voor de sociale waardering. Welke van de twee (of allebei) het wordt, is een latere beslissing — voor nu is het genoeg om te weten dat het datamodel dit straks makkelijk moet kunnen dragen.

### 11.3 Waar dit op voortbouwt

Dit heeft per definitie **echte gebruikersaccounts** nodig (sectie 10, stap 10 — Supabase Auth) — zonder een "wie is wie" heeft een kudo geen ontvanger. Kortom: de volgorde is eerst sectie 7 (privé/aanmelden voor delen/goedkeuring) bouwen, dan pas — zodra er meerdere gebruikers zijn — deze sociale laag erbovenop.

### 11.4 Datamodel (alvast als aantekening, niet om nu te bouwen)

```
recept_kudo (
  id,
  recept_url,
  gegeven_door_gebruiker_id,
  moment
)
```

Een simpele `count(*)`-query per `recept_url` geeft het totaal; geen aparte tellerkolom nodig die je handmatig moet bijhouden.

## 12. Kanttekeningen

- De `bereiding_nl`-teksten van webgescrapete recepten zijn herschreven, maar houd bij het publiceren (ook al is het maar voor jezelf) altijd de bronvermelding + link zichtbaar, zoals nu al in elk recept-object zit. Bij kookboek- en eigen recepten (sectie 7) is de boektitel of "eigen recept" de bronvermelding, in plaats van een link.
- Zolang `afbeelding_bron = 'origineel_bron'` is, verwijst `afbeelding_url` naar een afbeelding op de servers van de bronsite (hotlinking). Dat werkt voor persoonlijk gebruik, maar sectie 6's aanpak (zelf genereren) lost dit meteen structureel op voor nieuwe en bestaande recepten.
- Van de 581 recepten missen er nog 22 (Uit Paulines Keuken) hun definitieve bereidingstekst — die volgen zodra de laatste her-scrape is verwerkt.
- Beeldgeneratie- en vision/OCR-API's zijn niet gratis; bij ~580+ recepten (en groeiend via sectie 7) is het de moeite waard om vooraf een kostenschatting te maken per gekozen dienst voordat je de batchjob uit sectie 6 op de hele dataset loslaat.
- Het Jumbo-mechanisme achter de "Direct in je mandje"-knop is nog niet bevestigd zoals het AH-mechanisme dat wel is (sectie 4) — dat vraagt nog één keer hetzelfde soort netwerkverkeer-onderzoek dat de AH-URL opleverde.
- Niet elk ingrediënt heeft een biologische variant bij AH/Jumbo — de terugval-logica in 4.3 (gewoon de standaardversie pakken als er geen bio-ID is) voorkomt dat je boodschappenlijst daardoor onvolledig raakt.
- Kookboek-recepten (sectie 7.3) mogen nooit gedeeld worden — dit is een harde regel in de app, geen instelling die per ongeluk aan te zetten is. Eigen recepten mogen wél gedeeld worden, maar pas na expliciete admin-goedkeuring (sectie 7.6/7.7) — nooit automatisch live.
