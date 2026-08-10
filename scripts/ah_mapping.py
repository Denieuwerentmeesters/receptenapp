#!/usr/bin/env python3
"""Bouwt de ingrediënt → AH-productID-mapping op (plan §4.2, tech-stack §5).

Draait op je Mac, niet in de app: het gebruikt de directe Postgres-connectie en
zoekt per ingrediënt op ah.nl. Begin met de meest voorkomende ingrediënten uit
je 581 recepten — die dekken het gros van je boodschappenlijsten.

    export DATABASE_URL='postgres://...@ep-xxx.neon.tech/receptenapp?sslmode=require'
    python3 scripts/ah_mapping.py --top 150

Zonder --schrijf doet het script niets aan de database; het toont alleen wat het
zou vinden. Zo kun je de match eerst nakijken.
"""

from __future__ import annotations

import argparse
import unicodedata
import collections
import os
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
BRON = WORTEL / "data" / "recepten.json"
ZOEK_URL = "https://www.ah.nl/zoeken?query={}"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Receptenapp-mapping/1.0"

BEREIDINGSWOORDEN = re.compile(
    r"\b(verse?|vers|gedroogde?|gemalen|geraspte?|fijngesneden|grofgesneden|gesneden|gehakte?"
    r"|geschilde|biologische?|bio|kleine?|grote?|halve|hele|extra|vergine|zonder vel"
    r"|naar smaak|om te frituren|optioneel)\b"
)


def ingredient_key(naam: str) -> str:
    """Spiegel van public.ingredient_key en van ingredientKey() in de app.

    Alle drie moeten dezelfde sleutel opleveren, anders matcht de mapping niet.
    """
    # Accenten eraf, net als unaccent() in SQL en NFD in de app — anders rekent
    # het script "crème fraîche" uit waar de app "creme fraiche" zoekt.
    tekst = unicodedata.normalize("NFD", naam.lower())
    tekst = "".join(c for c in tekst if unicodedata.category(c) != "Mn")
    tekst = re.sub(r"'s\b", " ", tekst)
    tekst = re.sub(r"\([^)]*\)", " ", tekst)
    tekst = BEREIDINGSWOORDEN.sub(" ", tekst)
    tekst = re.sub(r"[^a-z ]", " ", tekst)
    tekst = re.sub(r"\b\w\b", " ", tekst)          # losse letters
    tekst = re.sub(r"\s+", " ", tekst).strip()
    # Meervouds-s alleen weghalen waar het Nederlands 'm ook echt plakt:
    # achter -el, -er, -em, -en, -ie, -je of -e (aardappels, bosuitjes, wortels).
    # Niet achter een gewone klinker of medeklinker, want dan hoort de s bij het
    # woord: citroengras, ansjovis, kaas, saus, chips.
    if len(tekst) >= 5 and tekst.endswith("s"):
        stam = tekst[:-1]
        if re.search(r"(el|er|em|en|ie|je|e)$", stam):
            return stam
    return tekst


def veelgebruikte_ingredienten(hoeveel: int) -> list[tuple[str, str, int]]:
    """De meest voorkomende sleutels, met een leesbare naam erbij."""
    recepten = json.loads(BRON.read_text(encoding="utf-8"))
    teller: collections.Counter[str] = collections.Counter()
    namen: dict[str, str] = {}

    for recept in recepten:
        for ingredient in recept.get("ingredienten") or []:
            sleutel = ingredient_key(ingredient.get("naam") or "")
            if not sleutel or len(sleutel) < 3:
                continue
            teller[sleutel] += 1
            namen.setdefault(sleutel, sleutel)

    return [(sleutel, namen[sleutel], aantal) for sleutel, aantal in teller.most_common(hoeveel)]


def zoek_producten(term: str) -> list[tuple[int, str]]:
    """Haalt (productID, titel) uit de zoekpagina van ah.nl.

    De product-ID's staan in de href van elke productkaart:
    /producten/product/wi123456/... — dat nummer is wat add-multiple wil.
    Geen officiële API, dus dit kan zonder aankondiging veranderen. Levert het
    niets op, dan valt de app in de UI gewoon terug op een zoeklink.
    """
    verzoek = urllib.request.Request(
        ZOEK_URL.format(urllib.parse.quote(term)),
        headers={"User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9"},
    )
    try:
        html = urllib.request.urlopen(verzoek, timeout=20).read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError) as fout:
        print(f"    ! {term}: {fout}", file=sys.stderr)
        return []

    gevonden: list[tuple[int, str]] = []
    gezien: set[int] = set()
    for match in re.finditer(r'/producten/product/wi(\d+)/([a-z0-9-]+)', html):
        product_id = int(match.group(1))
        if product_id in gezien:
            continue
        gezien.add(product_id)
        gevonden.append((product_id, match.group(2).replace("-", " ")))
    return gevonden


def kies(producten: list[tuple[int, str]]) -> tuple[int | None, int | None]:
    """Eerste treffer is de standaardvariant; de eerste met 'biologisch' de bio-variant.

    Niet elk ingrediënt heeft een bio-variant — dan blijft die None en valt de
    app terug op standaard (plan §4.3).
    """
    if not producten:
        return None, None
    standaard = next((pid for pid, titel in producten if "biologisch" not in titel), producten[0][0])
    bio = next((pid for pid, titel in producten if "biologisch" in titel), None)
    return standaard, bio


def schrijf(rijen: list[tuple[str, str, int | None, int | None]]) -> None:
    import psycopg  # alleen nodig als je daadwerkelijk schrijft

    with psycopg.connect(os.environ["DATABASE_URL"]) as verbinding:
        with verbinding.cursor() as cursor:
            cursor.executemany(
                """
                insert into ah_product_cache
                  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
                values (%s, %s, %s, %s, now())
                on conflict (ingredient_key) do update set
                  weergavenaam = excluded.weergavenaam,
                  standaard_product_id = excluded.standaard_product_id,
                  bio_product_id = excluded.bio_product_id,
                  laatst_geverifieerd = now()
                """,
                rijen,
            )
        verbinding.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", type=int, default=150, help="hoeveel ingrediënten (default 150)")
    parser.add_argument("--schrijf", action="store_true", help="wegschrijven naar de database")
    parser.add_argument("--pauze", type=float, default=1.5, help="seconden tussen verzoeken")
    argumenten = parser.parse_args()

    if argumenten.schrijf and not os.environ.get("DATABASE_URL"):
        sys.exit("Zet DATABASE_URL in je omgeving om te kunnen schrijven.")

    rijen: list[tuple[str, str, int | None, int | None]] = []
    doel = veelgebruikte_ingredienten(argumenten.top)

    for i, (sleutel, naam, aantal) in enumerate(doel, 1):
        standaard, bio = kies(zoek_producten(naam))
        merk = "ok " if standaard else "-- "
        print(f"{merk}[{i}/{len(doel)}] {sleutel} ({aantal}x) → {standaard}"
              + (f" / bio {bio}" if bio else ""))
        if standaard:
            rijen.append((sleutel, naam, standaard, bio))
        time.sleep(argumenten.pauze)

    gevonden = len(rijen)
    print(f"\n{gevonden} van de {len(doel)} ingrediënten gemapt ({gevonden / len(doel):.0%}).")

    if argumenten.schrijf:
        schrijf(rijen)
        print("Weggeschreven naar ah_product_cache.")
    else:
        print("Niets weggeschreven — draai opnieuw met --schrijf als dit klopt.")


if __name__ == "__main__":
    main()
