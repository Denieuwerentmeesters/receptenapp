# Receptenapp — projectstatus

Laatste update: 7 augustus 2026

## Mapstructuur
- `docs/` — plan- en conceptdocumenten
- `scripts/` — de Python-scraper (draait lokaal op jouw Mac, niet in de cloud-sandbox)
- `data/` — de receptendata (JSON)

## Waar staan we

### Data — klaar
- `data/recepten.json` — **de definitieve, samengevoegde dataset: 581 recepten.**
  - 12 Jamie Oliver
  - 358 Miljuschka (322 origineel + 36 nieuwe hoofdgerechten)
  - 211 Uit Paulines Keuken (herschreven in eigen woorden, ingrediënten geparsed, vegetarisch-tags gecontroleerd op basis van de ingrediëntenlijst)
  - Gecheckt: elk recept heeft een bronlink, een volledige bereiding, geen duplicaten. 221 van de 581 zijn getagd `vegetarisch`.
  - Dit bestand is de bron voor de app die we nu gaan bouwen (zie `docs/app-plan-weekmenu-en-ah.md`).

### Data — nog open
- `data/paulines_pending_redo.json` — **23 recepten die nog niet in `recepten.json` zitten.** Bij deze recepten kwam de bereiding de eerste keer niet goed mee door een scraper-bug die inmiddels gefixt is. Zodra jij de her-scrape draait, kunnen we ze alsnog toevoegen:
  ```
  cd scripts
  python3 recept_scraper.py "https://uitpaulineskeuken.nl/hoofdgerechten" --bron "Uit Paulines Keuken" --output paulines_hoofdgerechten_v2.json --max 60
  ```
  Stuur me daarna het resultaat, dan verwerk ik het (1 van de 23 — "3 x salade caprese" — mist ook ingrediënten en laten we waarschijnlijk gewoon weg).
- `data/paulines_keuken_deduped.json` — de ruwe, nog niet-herschreven brondata (234 stuks, inclusief de 23 hierboven) — alleen ter referentie, niet meer nodig voor de app zelf.
- `data/miljuschka_hoofdgerechten_nieuw.json` — de ruwe brondata van de 36 nieuwe Miljuschka-recepten vóór herschrijving — ook alleen ter referentie.

### Scraper
- `scripts/recept_scraper.py` — met twee bugfixes: (1) overzichtspagina's worden niet meer per ongeluk als los recept gezien, (2) stappen in `HowToSection`-structuren worden nu volledig meegenomen i.p.v. alleen de sectie-titel.
- `scripts/debug_links.py` — diagnose-tooltje om linkherkenning op een site te testen.

### Plan voor de app
- `docs/app-plan-weekmenu-en-ah.md` — het volledige implementatieplan, inclusief de laatste aanvullingen:
  - Weekmenu: 10 recepten per week getoond, zelf kiezen wat je kookt.
  - Personalisatie: favoriete keukens, vega-minimum, max bereidingstijd, **aantal personen (met automatische schaling van hoeveelheden)**.
  - Albert Heijn/Jumbo-koppeling (bevestigd werkend mechanisme) incl. **automatische biologische variant**.
  - Losstaande afvinkbare boodschappenlijst (voor als je zelf gaat winkelen).
  - **Receptafbeeldingen genereren** voor recepten zonder eigen foto.
  - **Recepten uit kookboeken toevoegen** via een foto (vision/OCR).
  - **Wekelijks pushbericht** op een zelf ingesteld tijdstip.

## Openstaande taken
1. Jouw herscrape van de 23 pending-redo recepten verwerken (enige databron-taak die nog open staat).
2. De app zelf bouwen: datamodel + weekmenu-generator, personalisatie-instellingen, UI, boodschappenlijst-feature, AH/Jumbo-koppeling (incl. product-ID mapping en bio-variant), receptafbeeldingen, kookboek-upload, pushberichten — bouwvolgorde staat in sectie 10 van het plan.
