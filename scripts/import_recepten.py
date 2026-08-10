#!/usr/bin/env python3
"""Eenmalige import van data/recepten.json naar de tabel `recepten` in Neon.

De gescrapete recepten worden de gedeelde pool: user_id blijft null,
bron_type = 'scraper', deel_status = 'goedgekeurd'. Daarna is de JSON archief
(tech-stack §4).

Alleen hoofdgerechten gaan mee: desserts, gebak, drankjes, sauzen, dips,
borrelhapjes, basisrecepten, bij- en voorgerechten, snacks en ontbijt vallen af.
Dat zijn er 106 van de 581, dus er blijven er 475 over.

    pip install 'psycopg[binary]'
    export DATABASE_URL='postgres://...@ep-xxx.neon.tech/receptenapp?sslmode=require'
    python3 scripts/import_recepten.py

Draait met de directe connectiestring en omzeilt daarmee RLS — precies wat je
wil voor een import van rijen die van niemand zijn. Idempotent: matcht op url,
dus opnieuw draaien werkt bij in plaats van te dupliceren.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
BRON = WORTEL / "data" / "recepten.json"

# Tags die aangeven dat het geen avondmaaltijd is.
GEEN_HOOFDGERECHT = {
    "dessert", "cheesecake", "ijstaart", "koekjes", "bars", "gebak", "frans gebak", "cake",
    "drank", "cocktail", "mocktail", "alcoholvrij", "limoncello",
    "basisrecept", "saus", "pastasaus", "romige saus", "dip", "hummus",
    "marinade", "bouillon", "borrel", "borrelhapje", "hapje", "pannenkoeken",
    "bijgerecht", "voorgerecht", "snack", "ontbijt", "brunch",
}


def is_hoofdgerecht(recept: dict) -> bool:
    return not (set(recept.get("tags") or []) & GEEN_HOOFDGERECHT)

INVOEGEN = """
insert into recepten (
  titel, titel_nl, bron, url, personen, bereidingstijd_minuten, keuken, tags,
  ingredienten, bereiding_nl, bron_type, deel_status, user_id
) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'scraper', 'goedgekeurd', null)
on conflict (url) where url is not null do update set
  titel = excluded.titel,
  titel_nl = excluded.titel_nl,
  personen = excluded.personen,
  bereidingstijd_minuten = excluded.bereidingstijd_minuten,
  keuken = excluded.keuken,
  tags = excluded.tags,
  ingredienten = excluded.ingredienten,
  bereiding_nl = excluded.bereiding_nl
"""


def naar_rij(recept: dict) -> tuple:
    """Zet één JSON-recept om naar databasewaarden.

    De ingrediënten gaan als jsonb mee zoals ze zijn — hoeveelheid/eenheid/naam
    is al de structuur die de app gebruikt. Schalen naar aantal personen gebeurt
    on the fly bij het tonen (plan §2.4), dus we slaan niets herschaald op.
    """
    return (
        recept["titel"],
        recept.get("titel_nl"),
        recept["bron"],
        recept["url"],
        recept.get("personen") or 4,
        recept.get("bereidingstijd_minuten"),
        recept.get("keuken"),
        recept.get("tags") or [],
        json.dumps(recept.get("ingredienten") or [], ensure_ascii=False),
        recept.get("bereiding_nl") or [],
    )


def main() -> None:
    import psycopg

    verbinding_url = os.environ.get("DATABASE_URL")
    if not verbinding_url:
        sys.exit("Zet DATABASE_URL in je omgeving voordat je dit script draait.")

    alles = json.loads(BRON.read_text(encoding="utf-8"))
    recepten = [r for r in alles if is_hoofdgerecht(r)]
    rijen = [naar_rij(r) for r in recepten]
    print(f"{len(alles) - len(recepten)} niet-hoofdgerechten overgeslagen.")

    with psycopg.connect(verbinding_url) as verbinding:
        with verbinding.cursor() as cursor:
            cursor.executemany(INVOEGEN, rijen)
        verbinding.commit()

    print(f"Klaar — {len(rijen)} recepten in de gedeelde pool.")


if __name__ == "__main__":
    main()
