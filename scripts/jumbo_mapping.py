#!/usr/bin/env python3
"""Bouwt de ingrediënt → Jumbo-SKU-mapping op (plan §4, fase 3).

Anders dan ah.nl geeft jumbo.com gewoon antwoord op een kaal HTTP-verzoek, dus
dit script werkt vanaf je Mac zonder browser. Het neemt de sleutels uit
data/ah_mapping.json — dat zijn de ingrediënten die er in de praktijk toe doen —
en zoekt ze één voor één op jumbo.com.

    python3 scripts/jumbo_mapping.py              # schrijft data/jumbo_mapping.json
    python3 scripts/jumbo_mapping.py --alleen ui,knoflook   # een paar nakijken

Het resultaat komt in data/jumbo_mapping.json. Kijk dat na, en maak er dan een
migratie van — die zet de mapping na de merge vanzelf in de database:

    python3 scripts/jumbo_mapping.py --migratie

Bij twijfel: geen mapping (zie CLAUDE.md). Een product telt alleen als elk
woord van het ingrediënt als heel woord in de productnaam staat. De eerste
treffer is vaak een gesponsorde of een samengesteld product ("paprika" →
paprikachips), dus we rangschikken zelf: huismerk eerst, dan de kortste naam.
"""

from __future__ import annotations

import argparse
import html
import unicodedata
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
BRON = WORTEL / "data" / "ah_mapping.json"
DOEL = WORTEL / "data" / "jumbo_mapping.json"
MIGRATIES = WORTEL / "db" / "migrations"
ZOEK_URL = "https://www.jumbo.com/producten/?searchType=keyword&searchTerms={}"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140 Safari/537.36")

# Een productkaart: data-product-id="641085STK" en verderop de titel-link.
KAART = re.compile(r'data-product-id="([0-9A-Z]+)"')
TITEL = re.compile(r'class="title-link"[^>]*>(?:<!--\[-->)?\s*([^<]+)')

BIO = re.compile(r"\b(bio|biologisch|biologische)\b")

# Woorden in een productnaam die verraden dat het een ander product is dan het
# kale ingrediënt: "tomaat" → tomatensoep, "kip" → kipnuggets. Staat een van
# deze in de naam en niet in het ingrediënt, dan slaan we het product over.
ANDER_PRODUCT = {
    "soep", "saus", "chips", "snack", "snacks", "salade", "maaltijd", "pizza", "taart",
    "koek", "koeken", "koekjes", "drink", "drank", "sap", "smoothie", "yoghurt", "kwark",
    "ijs", "reep", "repen", "spread", "dip", "mix", "kruidenmix", "wraps", "toast",
    "crackers", "burger", "nuggets", "schnitzel", "kroket", "kroketten", "bitterballen",
    "salami", "chocolade", "hagelslag", "pasta", "noedels", "rijst", "baby", "kinder",
    "hond", "kat", "shampoo", "zeep", "thee", "limonade", "siroop", "bier", "wijn",
    "diepvries", "kant", "klaar", "maaltijdsalade", "maaltijdpakket", "verspakket",
    "kroketjes", "friet", "frietjes", "partjes", "wedges", "rosti", "tagliatelle",
    "spaghetti", "gepeld", "gepelde", "gedroogd", "gedroogde", "gerookt", "gerookte",
    "gemarineerd", "gemarineerde", "gegrild", "gegrilde", "gebakken", "gefrituurd",
    "poeder", "puree", "sticks", "knijpfruit", "fruithapje", "hapje", "hapjes", "smaak",
    "aroma", "geur", "kaars", "olie", "azijn", "pasta", "tapenade", "pesto", "blokjes",
    "reepjes", "plakjes", "schijfjes", "geraspt", "geraspte", "gesneden", "roerbak",
    "wokgroente", "groentemix", "soepgroente",
    # Varianten die je niet wilt als je gewoon "crème fraîche" of "kaas" koopt.
    "light", "minder", "zero", "lactosevrij", "vegan", "vegetarisch", "vegetarische",
    "plantaardig", "plantaardige", "glutenvrij", "suikervrij", "vervanger", "beleg",
}

# "Tagliatelle met ei", "Rijst met groenten": een verbindingswoord dat niet in het
# ingrediënt staat betekent bijna altijd een samengesteld product.
VERBINDERS = {"met", "en", "in", "op", "uit", "voor", "a", "la"}


# Handmatige nacontrole van de run van 29-09-2026. De regels hierboven vangen
# veel, maar niet alles: "nectarine" → wasverzachter, "zoete aardappel" →
# hondenpaté. Die sleutels krijgen bewust géén mapping (dan een zoeklink).
AFGEKEURD = {
    "edamame", "geroosterde paprika", "komijn", "nectarine", "piment", "ricotta",
    "rode appel", "rode paprika", "sinaasappel", "sojabonen", "witte druiven",
    "witte kool", "zeezout", "zoete aardappel", "mais", "kersen", "suiker", "tabasco",
    "tahin", "ramen", "tikka masala", "zalm", "honing", "kruidenmix", "wraps", "mango",
    "spek",
}

# En waar de eerste keuze net naast zat: (sku, naam) voor de standaardvariant.
CORRECTIES = {
    # 120 g scharrelkipfilet is broodbeleg; recepten bedoelen rauwe filet.
    "kipfilet": ("515106KGR", "Jumbo Kipfilet ca. 600g"),
    # Jumbo verkoopt verse gember alleen biologisch; gehakt uit een potje is iets anders.
    "gember": ("485371BAK", "Jumbo Biologische Verse Gember"),
}


def normaliseer(tekst: str) -> list[str]:
    # Accenten eraf, zoals ingredient_key dat ook doet (crème fraîche → creme fraiche).
    tekst = unicodedata.normalize("NFD", tekst.lower())
    tekst = "".join(c for c in tekst if unicodedata.category(c) != "Mn")
    tekst = re.sub(r"'s\b", "", tekst)
    return re.findall(r"[a-z]+", tekst)


def woordvorm_past(ingredientwoord: str, productwoord: str) -> bool:
    """Heel woord, eventueel met een meervoudsuitgang (paprika → paprika's, ui → uien).

    Bewust geen voorvoegsel-match: "melk" mag niet op "melkchocolade" passen en
    "kip" niet op "kipkerrie".
    """
    if productwoord == ingredientwoord:
        return True
    for uitgang in ("s", "en", "n", "e", "es"):
        if productwoord == ingredientwoord + uitgang:
            return True
    # Verdubbelde medeklinker (ui → uien, tomaat → tomaten, ei → eieren)
    if ingredientwoord.endswith("aat") and productwoord == ingredientwoord[:-3] + "aten":
        return True
    if productwoord in (ingredientwoord + ingredientwoord[-1] + "en",
                        ingredientwoord + "eren"):
        return True
    return False


def zoek_producten(term: str) -> list[tuple[str, str]]:
    """Haalt (sku, titel) uit de zoekpagina van jumbo.com, in paginavolgorde."""
    verzoek = urllib.request.Request(
        ZOEK_URL.format(urllib.parse.quote(term)),
        headers={"User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9"},
    )
    try:
        pagina = urllib.request.urlopen(verzoek, timeout=30).read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError) as fout:
        print(f"    ! {term}: {fout}", file=sys.stderr)
        return []

    gevonden: list[tuple[str, str]] = []
    gezien: set[str] = set()
    posities = [(m.start(), m.group(1)) for m in KAART.finditer(pagina)]
    for i, (start, sku) in enumerate(posities):
        if sku in gezien:
            continue
        eind = posities[i + 1][0] if i + 1 < len(posities) else len(pagina)
        titel = TITEL.search(pagina, start, eind)
        if not titel:
            continue
        gezien.add(sku)
        gevonden.append((sku, html.unescape(titel.group(1)).strip()))
    return gevonden


def past(sleutel: str, titel: str) -> bool:
    ingredient = normaliseer(sleutel)
    product = normaliseer(titel)
    if not ingredient:
        return False
    for woord in ingredient:
        if not any(woordvorm_past(woord, p) for p in product):
            return False
    extra = set(product) - set(ingredient)
    if extra & (ANDER_PRODUCT | VERBINDERS):
        return False
    return True


# Maat- en verpakkingswoorden tellen niet als "extra": "500 g", "2 stuks", "ca".
NEUTRAAL = {"jumbo", "g", "gr", "gram", "kg", "ml", "l", "cl", "stuks", "stuk", "ca",
            "st", "bio", "biologisch", "biologische", "per", "zak", "bak", "pak", "x"}


def extra_woorden(sleutel: str, titel: str) -> list[str]:
    ingredient = normaliseer(sleutel)
    return [w for w in normaliseer(titel)
            if w not in NEUTRAAL and not any(woordvorm_past(i, w) for i in ingredient)]


def score(sleutel: str, titel: str, ah_naam: str, positie: int) -> tuple[int, int, int, int]:
    """Lager is beter: huismerk eerst, dan wat de AH-keuze ook had, dan zo kaal mogelijk.

    De AH-productnaam is met de hand nagelopen; zegt die "iets kruimige
    aardappelen", dan wint "Kruimige Aardappelen" het van een willekeurige zak.
    """
    woorden = normaliseer(titel)
    huismerk = 0 if woorden[:1] == ["jumbo"] else 1
    extra = extra_woorden(sleutel, titel)
    ah_woorden = set(normaliseer(ah_naam)) - {"ah", "biologisch"}
    gedeeld = len([w for w in extra if w in ah_woorden])
    return (huismerk, len(extra) - gedeeld, -gedeeld, positie)


def kies(sleutel: str, producten: list[tuple[str, str]], ah_naam: str = "") -> dict | None:
    passend = [(i, sku, titel) for i, (sku, titel) in enumerate(producten) if past(sleutel, titel)]
    # Een A-merk met een rij extra woorden is meestal iets anders dan het kale
    # ingrediënt. Huismerk mag iets ruimer; daar staat vaak een soort bij.
    passend = [(i, sku, titel) for i, sku, titel in passend
               if len(extra_woorden(sleutel, titel)) <= (3 if normaliseer(titel)[:1] == ["jumbo"] else 2)]
    if not passend:
        return None

    gewoon = [p for p in passend if not BIO.search(p[2].lower())]
    bio = [p for p in passend if BIO.search(p[2].lower())]
    if not gewoon:
        return None

    standaard = min(gewoon, key=lambda p: score(sleutel, p[2], ah_naam, p[0]))[1:]
    biologisch = min(bio, key=lambda p: score(sleutel, p[2], ah_naam, p[0]))[1:] if bio else None
    return {
        "key": sleutel,
        "naam": standaard[1],
        "standaard": standaard[0],
        "bio": biologisch[0] if biologisch else None,
        "bio_naam": biologisch[1] if biologisch else None,
    }


def sql_tekst(waarde: str | None) -> str:
    return "null" if waarde is None else "'" + waarde.replace("'", "''") + "'"


def schrijf_migratie() -> Path:
    """Zet data/jumbo_mapping.json om in een idempotente migratie (upsert).

    Een nieuwe ronde mapping = een nieuwe migratie; bestaande pas je nooit aan.
    """
    mapping = json.loads(DOEL.read_text(encoding="utf-8"))
    stempel = time.strftime("%Y%m%d%H%M%S")
    pad = MIGRATIES / f"{stempel}_jumbo_mapping.sql"
    rijen = ",\n".join(
        f"  ({sql_tekst(m['key'])}, {sql_tekst(m['naam'])}, {sql_tekst(m['standaard'])}, {sql_tekst(m['bio'])})"
        for m in mapping
    )
    pad.write_text(
        "-- Gegenereerd door scripts/jumbo_mapping.py --migratie — niet met de hand aanpassen.\n"
        "--\n"
        "-- Ingrediënt → Jumbo-SKU, opgezocht op jumbo.com. Twijfelgevallen zijn\n"
        "-- weggelaten: dan toont de app een zoeklink, en dat is beter dan een fout\n"
        "-- artikel in je mandje.\n\n"
        "insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)\n"
        f"values\n{rijen}\n"
        "on conflict (ingredient_key) do update set\n"
        "  weergavenaam = excluded.weergavenaam,\n"
        "  standaard_sku = excluded.standaard_sku,\n"
        "  bio_sku = excluded.bio_sku,\n"
        "  laatst_geverifieerd = now();\n",
        encoding="utf-8",
    )
    return pad


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--alleen", help="komma-gescheiden sleutels; schrijft niets weg")
    parser.add_argument("--pauze", type=float, default=0.6, help="seconden tussen verzoeken")
    parser.add_argument("--migratie", action="store_true",
                        help="niet zoeken: maak een migratie van data/jumbo_mapping.json")
    argumenten = parser.parse_args()

    if argumenten.migratie:
        pad = schrijf_migratie()
        print(f"Migratie geschreven: {pad.relative_to(WORTEL)}")
        return

    ah = {m["key"]: m["naam"] for m in json.loads(BRON.read_text(encoding="utf-8"))}
    sleutels = list(ah)
    if argumenten.alleen:
        sleutels = [s.strip() for s in argumenten.alleen.split(",")]

    resultaat: list[dict] = []
    for i, sleutel in enumerate(sleutels, 1):
        if sleutel in AFGEKEURD:
            print(f"-- [{i}/{len(sleutels)}] {sleutel} (afgekeurd bij nacontrole)")
            continue
        keuze = kies(sleutel, zoek_producten(sleutel), ah.get(sleutel, ""))
        if keuze and sleutel in CORRECTIES:
            keuze["standaard"], keuze["naam"] = CORRECTIES[sleutel]
        if keuze:
            resultaat.append(keuze)
            bio = f"  / bio {keuze['bio_naam']}" if keuze["bio"] else ""
            print(f"ok [{i}/{len(sleutels)}] {sleutel} → {keuze['naam']} ({keuze['standaard']}){bio}")
        else:
            print(f"-- [{i}/{len(sleutels)}] {sleutel}")
        time.sleep(argumenten.pauze)

    print(f"\n{len(resultaat)} van de {len(sleutels)} ingrediënten gemapt "
          f"({len(resultaat) / max(len(sleutels), 1):.0%}).")
    if not argumenten.alleen:
        DOEL.write_text(json.dumps(resultaat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"Weggeschreven naar {DOEL.relative_to(WORTEL)} — kijk 'm na voordat je een migratie maakt.")


if __name__ == "__main__":
    main()
