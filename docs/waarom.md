# Waarom we dit bouwen

**Status: eerste schets, augustus 2026.** Geschreven door Steven met Claude, als
voorzet. Reinoud is met het idee begonnen — dit document probeert op te schrijven
wat er in zijn hoofd zat, zodat we het erover eens kunnen zijn of juist niet.
Schiet erop. De open vragen onderaan zijn echt open.

Waarom dit bestaat: als we niet opschrijven wat we oplossen en voor wie, bouwen
we alles wat technisch leuk is. Dit document is er om dingen te kunnen
*afwijzen*.

## Het probleem

Elke week opnieuw bedenken wat je eet. Daarna bedenken wat je daarvoor moet
kopen, en in welke hoeveelheden. In een druk bestaan is dat geen kookprobleem
maar een administratieprobleem, en het komt elke week terug.

## Wat de maaltijdboxen bewezen hebben

HelloFresh en soortgenoten hebben aangetoond dat mensen hier echt geld voor over
hebben. Ze lossen vijf dingen op:

1. Je hoeft niet te bedenken wat je eet — het wordt voorgeschoteld.
2. Je hoeft niet naar de supermarkt — het wordt bezorgd.
3. Je hoeft tijdens het koken niet na te denken — het recept ligt erbij.
4. Je hoeft niet te rekenen — je vult in voor hoeveel personen.
5. Je eet af en toe iets nieuws, omdat je uit een klein aanbod kiest.

Punt 1 tot en met 4 zijn gemak. Punt 5 is ontdekken. **Gemak is de motor**,
ontdekken is de bonus.

## Waarom mensen weer weglopen

Dit is het interessantste deel, want het is de opening.

- Bijna de helft zegt binnen een maand op. Na een jaar is nog ~15% over.
  Maandelijkse churn is 8–12%, dus 65–80% per jaar. Van de eerste naar de
  tweede box komt maar 35–50%.
- **Het is duurder.** Eerlijke vergelijking: een HelloFresh-portie kostte in het
  onderzoek van The Observer €7,90 per persoon, tegenover €5,60 als je dezelfde
  ingrediënten als hele verpakkingen in de supermarkt koopt. Dat is ~30%
  duurder, niet de "vier keer" die je in koppen leest — die vergelijkt met
  afgemeten hoeveelheden (€2,47), en zo koop je niet in een supermarkt.
- **Het aanbod is smal en niet altijd lekker.** Je kiest uit een handjevol.
- **Het is star.** Verse spullen moeten binnen een paar dagen op. Onverwacht uit
  eten betekent weggooien. Vergeet je te skippen, dan komt er een box die je
  niet wilde.
- **Verpakkingsafval.**
- **Je moet nog steeds koken.** Een box lost bedenken en inkopen op, niet de
  40 minuten aan het aanrecht.
- **Je kunt je eigen favoriet nooit terugvragen.** Elke week is nieuw. Leuk in
  maand één, vermoeiend in maand vier.

Samengevat: het gemak is echt genoeg om massaal te laten proberen, en de prijs
en de starheid zijn genoeg om weer te vertrekken.

## Wat wij doen

Een maaltijdbox verkoopt twee dingen in één pakket: **informatie** (wat eet je,
wat koop je, hoeveel) en **logistiek** (die ingrediënten fysiek bij je thuis).
De premie zit in de logistiek.

Wij leveren alleen de informatie. De logistiek heb je al — je gaat toch naar de
supermarkt, en als je niet wilt lopen bezorgt Albert Heijn zelf ook. Daarmee
houd je punt 1, 3, 4 en 5 volledig, dek je punt 2 via AH's eigen bezorging, en
betaal je supermarktprijzen.

Wat je inlevert: geen afgemeten porties. Je koopt een hele bos peterselie voor
tien gram. Dat is echt een nadeel — het is precies de verspilling die een box
vermijdt.

## Het uitgangspunt: gemak. Simpel, snel.

Als er één zin overblijft, is het deze. Alle andere apps in dit domein zijn te
breed; ze geven je een zoekmachine terug waar je een beslissing wilde.

Vier ontwerpregels die daaruit volgen:

1. **Kiezen uit weinig, niet uit veel.** De beperking ís het product. Krijg je
   duizenden recepten, dan is je keuzestress terug — precies het probleem dat we
   oplosten. Tien per week, die waarschijnlijk matchen.
2. **Favorieten wegen even zwaar als ontdekken.** Het makkelijkste avondeten is
   het gerecht dat je al kent. Van de tien is een deel bekend-en-goed en een
   deel nieuw; die verhouding is wat de gebruiker instelt tussen "verras me" en
   "doe maar makkelijk". Dit is het ene ding dat een maaltijdbox niet kán.
3. **Van weekmenu naar mandje in een paar tikken.** Elke extra stap is een reden
   om het niet te doen.
4. **Geen werk dat de gebruiker niet gevraagd heeft.** Geen instellingenmarathon
   voor je je eerste weekmenu ziet.

## Wat we expliciet niet bouwen

Deze lijst is het nuttigste deel van dit document.

- **Geen zoekmachine door de hele receptenpool.** Dat is de functie die elke
  concurrent wél heeft en die het product kapot maakt.
- **Geen bezorging.** Dat is de dure helft die we juist weglaten.
- **Geen sociaal netwerk.** Staat al als "fase 2, niet nu bouwen" in het plan;
  wat ons betreft blijft dat zo.
- **Geen voedings- of dieetcoach.** Andere app, ander probleem.

## Waarom mensen dit zouden oppakken — en waarom misschien niet

Eerlijk: het domein is druk, en Albert Heijn heeft met Allerhande Weekmenu een
eigen gratis variant in een app die iedereen al heeft. Menutos, WeekKok en
FeedMyCart doen ook stukken van dezelfde flow.

Onze weddenschap is dat ze allemaal te breed zijn, en dat smal beter is. Dat is
een gok op uitvoering, niet op een gat in de markt. Wat we daarnaast hebben:

- Een pool die gecureerd is op wat wij lekker vinden, zonder commercieel belang
  om AH-producten te pushen.
- Favoriete gerechten die terugkomen (zie hierboven).
- Recepten uit je eigen kookboek toevoegen via een foto. Dat kwamen we bij geen
  van de concurrenten tegen.

Het risico in één zin: als "smal" niet als rust voelt maar als armoede, hebben
we een slechtere versie van Allerhande gebouwd.

## Wanneer we zouden stoppen

Het eerlijke antwoord op "gaan mensen dit gebruiken" is nu: dat weten we niet.
De goedkoopste test zijn we zelf. Gebruiken wij het niet vier weken achter
elkaar zonder dat het moet, dan gaan anderen dat ook niet doen, en dan is
doorbouwen zonde van de tijd.

Dat is geen ramp: dan hebben we nog steeds iets waar we zelf wat aan hebben, en
dat is een prima uitkomst.

## Wat dit betekent voor wat we bouwen

Als bovenstaande klopt, staat de bouwvolgorde in `app-plan-weekmenu-en-ah.md`
niet helemaal goed:

- **Favoriete gerechten ontbreken volledig.** In het hele plan betekent
  "favoriet" alleen *favoriete keuken* — een weging in de generator. Een gerecht
  markeren en later terugkrijgen bestaat niet. Als ontwerpregel 2 klopt, hoort
  dit vooraan, niet in de designs-la.
- **De generator moet slots reserveren**, niet alleen wegen op keuken: een deel
  bekend, een deel nieuw.
- **Receptafbeeldingen worden belangrijker dan ze klinken.** Snel kiezen uit tien
  kaarten doe je op beeld. Nu tonen kaarten een kleurvlak.

## Open vragen voor Reinoud

1. **Verdienmodel.** In de designs zit een abonnementsscherm, maar nergens staat
   wat gratis is en wat niet. Wat had je voor ogen?
2. **Voor wie precies?** "Drukke huishoudens" is nog te vaag om keuzes mee af te
   wijzen. Gezinnen met kinderen? Stellen? Mensen die nu een maaltijdbox hebben
   en 'm te duur vinden?
3. **Klopt de weddenschap op "smal"?** Dat is nu de kern van het hele verhaal.
   Als jij een andere kern in gedachten had, moet dit document om.
4. **Hoe hard is "aan de man brengen"?** Het verschil tussen een gereedschap
   voor onszelf en een product voor vreemden verandert bijna elke keuze
   hieronder — met name of we het delen-met-goedkeuring en de adminrol nodig
   hebben.

## Bronnen

- Churn-cijfers: [retentioncheck.com](https://retentioncheck.com/churn-benchmarks/meal-kit-subscriptions),
  [hashtagpaid.com](https://hashtagpaid.com/banknotes/meal-kit-world-dominance-vs-high-customer-churn)
- Opzegredenen: [nasdaq.com](https://www.nasdaq.com/articles/5-reasons-to-cancel-hellofresh-and-other-meal-kit-delivery-subscriptions)
- Prijsvergelijking (The Observer, via Joop):
  [bnnvara.nl](https://www.bnnvara.nl/joop/artikelen/maaltijdboxen-wel-vier-keer-zo-duur-als-gewone-boodschappen)
- Prijs per portie NL: [maaltijdbox.org](https://www.maaltijdbox.org/hellofresh-box/is-hellofresh-duur/)
- Concurrenten: [Allerhande Weekmenu](https://www.ah.nl/inspiratie/leefstijl/voeding/makkelijk-weekmenu),
  [Menutos](https://menutos.nl/weekmenu-planner/), [WeekKok](https://weekkok.nl/landing),
  [FeedMyCart](https://www.feedmycart.com/)
