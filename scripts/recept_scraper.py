#!/usr/bin/env python3
"""
Recept-scraper voor je gerechten-app.

Wat dit script doet
--------------------
1. Haalt receptpagina's op met een echte browser (Playwright), zodat ook
   sites met een Cloudflare-controle (zoals uitpaulineskeuken.nl) meestal
   gewoon toegankelijk zijn -- vanaf je eigen laptop/thuisnetwerk werkt dit
   doorgaans beter dan vanaf een cloud-server.
2. Leest de gestructureerde receptdata (schema.org "Recipe" JSON-LD) die
   vrijwel elke moderne receptensite in de pagina zet. Daar staan titel,
   ingrediënten, bereidingstijd, aantal personen en de ruwe bereidingstekst
   al netjes gestructureerd in.
3. Wijst automatisch een keuken-categorie en een paar tags toe (vegetarisch,
   pasta, kip, snel, etc.) op basis van titel + ingrediënten, zodat je
   gerechten in je app kan filteren.
4. Schrijft alles weg naar een JSON-bestand.

BELANGRIJK - over auteursrecht
-------------------------------
De ingrediëntenlijst is feitelijke informatie en niet auteursrechtelijk
beschermd -- die kun je één-op-één gebruiken. De bereidingstekst die dit
script ophaalt is wél de originele, auteursrechtelijk beschermde tekst van
de bronsite (staat in `bereiding_ruw`). Gebruik die tekst dus NIET direct in
je app. Herschrijf de bereiding in eigen woorden voordat je een recept
publiceert -- bijvoorbeeld door de ruwe stappen naar een taalmodel te sturen
met de instructie "beschrijf deze kookmethode in eigen, nieuwe bewoordingen".
Toon in je app een link + bronvermelding naar het origineel; dat is zowel
juridisch verstandig als goed voor het verkeer naar de bronsite.

Installatie
-----------
    pip install playwright beautifulsoup4
    playwright install chromium

Gebruik
-------
    python recept_scraper.py "https://uitpaulineskeuken.nl/hoofdgerechten" \\
        --bron "Uit Paulines Keuken" --output paulines_keuken.json

    python recept_scraper.py "https://miljuschka.nl/categorie/hoofdgerecht/" \\
        --bron "Miljuschka" --output miljuschka.json --max 30

    Je kunt ook direct los recept-URL's meegeven in plaats van een
    overzichtspagina:
        python recept_scraper.py URL1 URL2 URL3 --bron "Jamie Oliver"
"""

import argparse
import json
import re
import sys
import time
from urllib.parse import urljoin, urlparse

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Installeer eerst Playwright: pip install playwright && playwright install chromium")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Installeer eerst BeautifulSoup: pip install beautifulsoup4")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Categorisering: eenvoudige keyword-matching op titel + ingrediënten.
# Pas deze lijsten gerust aan naar jouw eigen indeling.
# ---------------------------------------------------------------------------

KEUKEN_KEYWORDS = {
    "Italiaans": ["pasta", "lasagne", "risotto", "pesto", "parmezaan", "mozzarella",
                  "spaghetti", "gnocchi", "italiaans", "pizza", "penne", "orecchiette"],
    "Aziatisch": ["wok", "soja", "sesam", "gember", "sriracha", "teriyaki", "rijstazijn",
                  "aziatisch", "chinese", "japans", "koreaans", "vietnamees", "oestersaus"],
    "Indonesisch": ["ketjap", "sambal", "boemboe", "laos", "santen", "indonesisch",
                     "nasi", "bami", "ajam", "rendang", "saoto"],
    "Indisch": ["curry", "kerrie", "garam masala", "kurkuma", "naan", "masala",
                "indiaas", "indisch", "korma", "tikka"],
    "Thais": ["thaise", "thais", "currypasta", "kaffirlimoen", "citroengras", "pandan"],
    "Mexicaans": ["taco", "burrito", "fajita", "tortilla", "guacamole", "mexicaans", "salsa"],
    "Mediterraans": ["feta", "olijf", "za'atar", "tahin", "hummus", "mediterraan",
                       "griekse", "libanees", "sumak"],
    "Amerikaans": ["burger", "bbq", "cajun", "amerikaans", "coleslaw"],
    "Nederlands": ["stamppot", "hutspot", "stoofpot", "erwtensoep", "hachee"],
    "Frans": ["ratatouille", "quiche", "gratin", "frans", "bechamel"],
}

TAG_KEYWORDS = {
    "vegetarisch": ["vega", "vegetarisch"],
    "veganistisch": ["vegan", "veganistisch"],
    "vis": ["zalm", "vis", "garnaal", "garnalen", "tonijn", "kabeljauw", "mosselen"],
    "kip": ["kip", "kipfilet", "kippendij", "kippenbout"],
    "rundvlees": ["rund", "gehakt", "biefstuk", "runderlap", "stoofvlees"],
    "lamsvlees": ["lam", "lamsvlees"],
    "varkensvlees": ["varken", "spek", "bacon", "spare rib"],
    "pasta": ["pasta", "spaghetti", "penne", "tagliatelle", "lasagne", "fusilli"],
    "rijst": ["rijst", "risotto", "nasi"],
    "snel": ["15 minuten", "20 minuten", "snel"],
    "ovenschotel": ["ovenschotel", "traybake", "oven"],
    "glutenvrij": ["glutenvrij"],
}

NON_RECIPE_URL_HINTS = [
    "/categorie/", "/category/", "/tag/", "/pagina/", "/page/", "/auteur/",
    "/author/", "/privacy", "/contact", "/over-", "/about", "/zoeken", "/search",
]


def guess_categories(titel: str, ingredienten_tekst: str):
    tekst = f"{titel} {ingredienten_tekst}".lower()
    keuken = None
    for naam, keywords in KEUKEN_KEYWORDS.items():
        if any(kw in tekst for kw in keywords):
            keuken = naam
            break
    tags = [tag for tag, keywords in TAG_KEYWORDS.items() if any(kw in tekst for kw in keywords)]
    return keuken, tags


def parse_iso_duration(duration):
    """Zet een ISO-8601 duur zoals PT45M of PT1H30M om naar minuten."""
    if not duration:
        return None
    match = re.match(r"P(?:T)?(?:(\d+)H)?(?:(\d+)M)?", duration)
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    total = hours * 60 + minutes
    return total or None


def extract_recipe_jsonld(html: str, url: str):
    """Zoekt naar schema.org Recipe-data (JSON-LD) in de HTML."""
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
        except (json.JSONDecodeError, TypeError):
            continue

        candidates = data if isinstance(data, list) else [data]
        # @graph wordt door veel WordPress SEO-plugins gebruikt
        expanded = []
        for c in candidates:
            if isinstance(c, dict) and "@graph" in c:
                expanded.extend(c["@graph"])
            else:
                expanded.append(c)

        # Categorie-/overzichtspagina's bevatten vaak ZELF ook een losstaand
        # Recipe-blokje (bijv. een "recept van de dag"-widget), waarvan de
        # url/@id per ongeluk naar de overzichtspagina zelf verwijst in
        # plaats van naar het eigen recept. Als deze pagina een CollectionPage
        # of ItemList bevat, is het dus een overzichtspagina en NIET een
        # individuele receptpagina, ook al staat er toevallig Recipe-JSON-LD in.
        graph_types = set()
        for item in expanded:
            if isinstance(item, dict):
                t = item.get("@type")
                graph_types.update([t] if isinstance(t, str) else (t or []))
        if "CollectionPage" in graph_types or "ItemList" in graph_types:
            return None

        for item in expanded:
            if not isinstance(item, dict):
                continue
            types = item.get("@type")
            types = [types] if isinstance(types, str) else (types or [])
            if "Recipe" not in types:
                continue

            titel = item.get("name", "").strip()

            ingredienten_ruw = item.get("recipeIngredient") or item.get("ingredients") or []
            ingredienten = [{"tekst": i} for i in ingredienten_ruw]

            instructies = item.get("recipeInstructions") or []
            stappen = []

            def _voeg_stap_toe(stap):
                if isinstance(stap, str):
                    if stap.strip():
                        stappen.append(stap)
                    return
                if not isinstance(stap, dict):
                    return
                stap_types = stap.get("@type")
                stap_types = [stap_types] if isinstance(stap_types, str) else (stap_types or [])
                # HowToSection groepeert een reeks HowToStep-items onder een
                # kopje (bijv. "Zo maak je het", of "De dag van tevoren").
                # Duik door naar de losse stappen zelf i.p.v. alleen de
                # sectienaam over te nemen -- anders raak je alle echte
                # instructietekst kwijt.
                if "HowToSection" in stap_types and stap.get("itemListElement"):
                    for sub in stap["itemListElement"]:
                        _voeg_stap_toe(sub)
                    return
                tekst = stap.get("text") or stap.get("name") or ""
                if tekst.strip():
                    stappen.append(tekst)

            if isinstance(instructies, str):
                if instructies.strip():
                    stappen = [instructies]
            else:
                for stap in instructies:
                    _voeg_stap_toe(stap)

            personen_raw = item.get("recipeYield")
            personen = None
            if personen_raw:
                match = re.search(r"\d+", str(personen_raw))
                if match:
                    personen = int(match.group())

            tijd = parse_iso_duration(item.get("totalTime") or item.get("cookTime") or item.get("prepTime"))

            afbeelding = item.get("image")
            if isinstance(afbeelding, dict):
                afbeelding = afbeelding.get("url")
            elif isinstance(afbeelding, list) and afbeelding:
                afbeelding = afbeelding[0]

            ingredienten_tekst = " ".join(ingredienten_ruw)
            keuken, tags = guess_categories(titel, ingredienten_tekst)

            return {
                "titel": titel,
                "bron_url": url,
                "afbeelding_url": afbeelding,
                "personen": personen,
                "bereidingstijd_minuten": tijd,
                "keuken": keuken,
                "tags": tags,
                "ingredienten_ruw": ingredienten_ruw,
                "bereiding_ruw": stappen,
            }
    return None


def looks_like_recipe_link(href: str) -> bool:
    if not href:
        return False
    if any(hint in href for hint in NON_RECIPE_URL_HINTS):
        return False
    return True


def find_recipe_links_from_jsonld(html: str, base_url: str):
    """Haalt receptlinks op uit gestructureerde JSON-LD data (ItemList /
    significantLink / relatedLink), zoals WordPress SEO-plugins (Yoast,
    RankMath e.d.) die vaak automatisch op categoriepagina's zetten. Dit is
    veel betrouwbaarder dan het aflopen van <a>-tags, omdat categorie- en
    tag-pagina's op sommige sites niet herkenbaar zijn aan hun URL-patroon
    (bijv. uitpaulineskeuken.nl/aziatisch i.p.v. .../categorie/aziatisch)."""
    soup = BeautifulSoup(html, "html.parser")
    domain = urlparse(base_url).netloc
    links = set()

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
        except (json.JSONDecodeError, TypeError):
            continue
        candidates = data if isinstance(data, list) else [data]
        expanded = []
        for c in candidates:
            if isinstance(c, dict) and "@graph" in c:
                expanded.extend(c["@graph"])
            else:
                expanded.append(c)

        for item in expanded:
            if not isinstance(item, dict):
                continue
            for key in ("significantLink", "relatedLink"):
                for href in item.get(key) or []:
                    if isinstance(href, str):
                        links.add(href.split("#")[0].split("?")[0])

            types = item.get("@type")
            types = [types] if isinstance(types, str) else (types or [])
            if "ItemList" in types:
                for el in item.get("itemListElement") or []:
                    if not isinstance(el, dict):
                        continue
                    href = el.get("url")
                    if not href and isinstance(el.get("item"), dict):
                        href = el["item"].get("url")
                    if isinstance(href, str):
                        links.add(href.split("#")[0].split("?")[0])

    return sorted(l for l in links if urlparse(l).netloc == domain)


def find_recipe_links(html: str, base_url: str):
    """Haalt kandidaat-receptlinks van een overzichtspagina."""
    # Strategie 1: gestructureerde JSON-LD data (betrouwbaarst, indien aanwezig).
    jsonld_links = find_recipe_links_from_jsonld(html, base_url)
    if jsonld_links:
        return jsonld_links

    # Strategie 2 (terugval): <a>-tags aflopen en filteren op bekende
    # niet-recept-patronen.
    soup = BeautifulSoup(html, "html.parser")
    domain = urlparse(base_url).netloc
    links = set()
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        if urlparse(href).netloc != domain:
            continue
        if looks_like_recipe_link(href):
            links.add(href.split("#")[0].split("?")[0])
    return sorted(links)


def fetch_html(page, url: str, wait_ms: int = 2500) -> str:
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    # Geef Cloudflare-achtige checks even de tijd om vanzelf door te laten.
    page.wait_for_timeout(wait_ms)
    return page.content()


def main():
    parser = argparse.ArgumentParser(description="Scrape recepten van een receptensite.")
    parser.add_argument("urls", nargs="+", help="Eén of meer overzichts- of receptpagina-URL's")
    parser.add_argument("--bron", required=True, help="Naam van de bron, bijv. 'Uit Paulines Keuken'")
    parser.add_argument("--output", default="recepten_output.json", help="Pad naar het output-bestand")
    parser.add_argument("--max", type=int, default=25, help="Maximum aantal recepten om op te halen")
    parser.add_argument("--headless", action="store_true", default=True)
    args = parser.parse_args()

    resultaten = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        page = browser.new_page(
            user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
        )

        # Stap 1: bepaal welke URL's individuele recepten zijn.
        recept_urls = []
        for url in args.urls:
            print(f"Pagina bekijken: {url}")
            html = fetch_html(page, url)
            direct_recept = extract_recipe_jsonld(html, url)
            if direct_recept:
                recept_urls.append(url)
                continue
            # Geen recept gevonden -> waarschijnlijk een overzichtspagina.
            gevonden = find_recipe_links(html, url)
            print(f"  {len(gevonden)} mogelijke receptlinks gevonden op deze pagina.")
            recept_urls.extend(gevonden)

        # Dedupliceren, met behoud van volgorde.
        seen = set()
        unieke_urls = []
        for u in recept_urls:
            if u not in seen:
                seen.add(u)
                unieke_urls.append(u)

        print(f"\nInsgesamt {len(unieke_urls)} kandidaat-URL's, ik haal er maximaal {args.max} op.\n")

        for url in unieke_urls[: args.max]:
            try:
                html = fetch_html(page, url)
                recept = extract_recipe_jsonld(html, url)
                if not recept or not recept["titel"]:
                    print(f"  Overgeslagen (geen receptdata gevonden): {url}")
                    continue
                recept["bron"] = args.bron
                resultaten.append(recept)
                print(f"  OK: {recept['titel']}")
            except Exception as exc:
                print(f"  Fout bij {url}: {exc}")
            time.sleep(1)  # wees aardig voor de server

        browser.close()

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(resultaten, f, ensure_ascii=False, indent=2)

    print(f"\nKlaar. {len(resultaten)} recepten weggeschreven naar {args.output}")
    print("Let op: 'bereiding_ruw' bevat de originele tekst van de bron.")
    print("Herschrijf deze bereiding in eigen woorden voordat je hem in je app publiceert.")


if __name__ == "__main__":
    main()
