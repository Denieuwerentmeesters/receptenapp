#!/usr/bin/env python3
"""Inhoud per AH-verpakking, opgevraagd per productnummer.

ah.nl blokkeert kale verzoeken, maar de API van de AH-app geeft wel antwoord:
per productnummer de naam, de inhoud ("375 g", "ca. 530 g", "6 stuks",
"per stuk"), de prijs (vóór bonus) en of het nog te koop is. Dit script vraagt alle
productnummers op die in de AH-mapping staan (data/ah_mapping.json plus wat
latere migraties aan ah_product_cache toevoegden) en schrijft
data/ah_producten.json.

    python3 scripts/ah_verpakkingen.py              # haalt op, schrijft de json
    python3 scripts/ah_verpakkingen.py --migratie   # maakt er een migratie van

Zelfde afspraken als bij Jumbo (scripts/jumbo_verpakkingen.py): drie
basiseenheden (g, ml, stuks), en bij twijfel geen inhoud. Dan telt de app
gewoon één verpakking.

De API is die van de app en niet officieel: hij kan veranderen of dichtgaan.
Daarom alleen dit script, af en toe met de hand gedraaid, en niets in de app
zelf. Valt hij weg, dan blijft de laatst opgehaalde inhoud werken.

De json noemt ook wat niet meer te koop is (`leverbaar`): zo'n product valt
stilletjes uit het mandje, dus dat is een reden om de mapping bij te werken.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from jumbo_verpakkingen import inhoud_uit_naam

WORTEL = Path(__file__).resolve().parent.parent
BRON = WORTEL / "data" / "ah_mapping.json"
DOEL = WORTEL / "data" / "ah_producten.json"
MIGRATIES = WORTEL / "db" / "migrations"

API = "https://api.ah.nl"
# Potjes kruiden en concentraten: de inhoud zegt niets over hoeveel je nodig
# hebt (0,05 g saffraan, een bouillontablet voor een liter). Smaller dan bij
# Jumbo, waar de hele naam meetelt: hier zou "blokje" ook pancettablokjes en
# tomatenblokjes overslaan.
GEEN_INHOUD = re.compile(r"verstegen|euroma|gemalen|kruidenmix|seasoning|spice|tablet|\bfond\b|\bthee\b|oploskoffie", re.IGNORECASE)

KOPPEN = {"User-Agent": "Appie/8.22.3", "x-application": "AHWEBSHOP", "Content-Type": "application/json"}


def productnummers() -> list[int]:
    """Alle nummers uit de json en uit de migraties die ah_product_cache vullen."""
    nummers: set[int] = set()
    for rij in json.loads(BRON.read_text()):
        nummers.update(rij[v] for v in ("standaard", "bio", "huismerk") if rij.get(v))
    for pad in sorted(MIGRATIES.glob("*.sql")):
        sql = re.sub(r"--[^\n]*", "", pad.read_text())
        # Eerst de teksten eruit: daarin staan puntkomma's en getallen (Jumbo-SKU's, recepten).
        sql = re.sub(r"'(?:[^']|'')*'", "''", sql)
        for opdracht in sql.split(";"):
            if re.match(r"\s*(insert\s+into|update)\s+ah_product_cache\b", opdracht, re.IGNORECASE):
                nummers.update(int(n) for n in re.findall(r"(?<![\w.])\d{2,7}(?![\w.])", opdracht))
    return sorted(nummers)


def vraag(url: str, token: str | None = None, data: bytes | None = None) -> dict:
    koppen = dict(KOPPEN)
    if token:
        koppen["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=koppen), timeout=20) as antwoord:
        return json.load(antwoord)


def haal_product(nummer: int, token: str) -> dict:
    for _ in range(3):
        try:
            kaart = vraag(f"{API}/mobile-services/product/detail/v4/fir/{nummer}", token)
            kaart = kaart.get("productCard", kaart)
            return {
                "product_id": nummer,
                "titel": kaart.get("title"),
                "inhoud_tekst": kaart.get("salesUnitSize"),
                "prijs": kaart.get("priceBeforeBonus"),
                "leverbaar": kaart.get("orderAvailabilityStatus") == "IN_ASSORTMENT",
            }
        except urllib.error.HTTPError as fout:
            if fout.code == 404:
                break
            time.sleep(2)
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2)
    return {"product_id": nummer, "titel": None, "inhoud_tekst": None, "prijs": None, "leverbaar": False}


def inhoud_van(titel: str | None, tekst: str | None) -> tuple[float, str] | None:
    """De inhoud in g, ml of stuks, of None als die niets zegt over hoeveel je nodig hebt."""
    if not titel or not tekst or GEEN_INHOUD.search(titel):
        return None
    tekst = tekst.strip().lower()
    if tekst == "per stuk":
        return (1, "stuks")
    # "los per 100 g" is een prijs per gewicht, geen verpakking; een bos heeft geen maat.
    if tekst.startswith(("los", "per ")):
        return None
    inhoud = inhoud_uit_naam(tekst)
    # Bouillon in gram of stuks zijn blokjes of poeder, geen vloeibare bouillon.
    if inhoud and re.search(r"bouillon", titel, re.IGNORECASE) and inhoud[1] != "ml":
        return None
    return inhoud


def verzamel() -> list[dict]:
    token = vraag(f"{API}/mobile-auth/v1/auth/token/anonymous", data=b'{"clientId":"appie"}')["access_token"]
    nummers = productnummers()
    with ThreadPoolExecutor(4) as werkers:
        producten = list(werkers.map(lambda n: haal_product(n, token), nummers))
    vandaag = datetime.now().strftime("%Y-%m-%d")
    for product in producten:
        product["peildatum"] = vandaag
        inhoud = inhoud_van(product["titel"], product["inhoud_tekst"])
        product["inhoud"], product["eenheid"] = inhoud if inhoud else (None, None)
    return producten


def schrijf_migratie(producten: list[dict]) -> Path:
    """Inhoud (ah_verpakking) en gewone prijs (ah_prijs) in één migratie."""
    stempel = datetime.now().strftime("%Y%m%d%H%M%S")
    pad = MIGRATIES / f"{stempel}_ah_verpakkingen_en_prijzen.sql"
    inhouden = [r for r in producten if r.get("inhoud")]
    # Alleen wat nu te koop is: een weggevallen product heeft geen prijs om mee te rekenen.
    prijzen = [r for r in producten if r.get("prijs") and r.get("leverbaar")]
    waarden = ",\n".join(f"  ({r['product_id']}, {r['inhoud']:g}, '{r['eenheid']}')" for r in inhouden)
    prijs_waarden = ",\n".join(
        f"  ({r['product_id']}, {r['prijs']:.2f}, '{r.get('peildatum') or datetime.now().strftime('%Y-%m-%d')}')" for r in prijzen
    )
    pad.write_text(
        "-- Gegenereerd door scripts/ah_verpakkingen.py --migratie — niet met de hand aanpassen.\n"
        "-- Inhoud en gewone prijs (vóór bonus) per AH-productnummer, opgevraagd bij AH.\n"
        "-- Zie de uitleg in het script.\n\n"
        "insert into ah_verpakking (product_id, inhoud, eenheid)\nvalues\n"
        f"{waarden}\n"
        "on conflict (product_id) do update set\n"
        "  inhoud = excluded.inhoud,\n"
        "  eenheid = excluded.eenheid;\n\n"
        "insert into ah_prijs (product_id, prijs, peildatum)\nvalues\n"
        f"{prijs_waarden}\n"
        "on conflict (product_id) do update set\n"
        "  prijs = excluded.prijs,\n"
        "  peildatum = excluded.peildatum;\n"
    )
    return pad


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--migratie", action="store_true", help="maak een migratie van data/ah_producten.json")
    args = parser.parse_args()

    if args.migratie:
        producten = json.loads(DOEL.read_text())
        print(f"Migratie geschreven: {schrijf_migratie(producten).relative_to(WORTEL)} ({len(producten)} producten)")
        return

    producten = verzamel()
    DOEL.write_text(json.dumps(producten, ensure_ascii=False, indent=2) + "\n")
    met = sum(1 for p in producten if p["inhoud"])
    weg = [p for p in producten if not p["leverbaar"]]
    print(f"{len(producten)} producten, {met} met inhoud → {DOEL.relative_to(WORTEL)}")
    print(f"{len(weg)} niet (meer) te koop: " + ", ".join(str(p["titel"] or p["product_id"]) for p in weg))


if __name__ == "__main__":
    main()
