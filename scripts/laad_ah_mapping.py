#!/usr/bin/env python3
"""Laadt data/ah_mapping.json in de tabel ah_product_cache.

    export DATABASE_URL='postgres://...@ep-xxx.neon.tech/neondb?sslmode=require'
    python3 scripts/laad_ah_mapping.py

De mapping is opgebouwd door per ingrediënt op ah.nl te zoeken en de treffers te
rangschikken (zie scripts/ah_mapping.py). Alleen matches waarvan de productnaam
het ingrediënt daadwerkelijk bevat zijn overgenomen; twijfelgevallen zijn
weggelaten, omdat een verkeerd productnummer stilletjes het verkeerde artikel in
je mandje legt. Zonder mapping valt de app netjes terug op een zoeklink.

Idempotent: bestaande rijen worden bijgewerkt.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

BRON = Path(__file__).resolve().parent.parent / "data" / "ah_mapping.json"

INVOEGEN = """
insert into ah_product_cache
  (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, huismerk_product_id, laatst_geverifieerd)
values (%s, %s, %s, %s, %s, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  huismerk_product_id = excluded.huismerk_product_id,
  laatst_geverifieerd = now()
"""


def main() -> None:
    import psycopg

    verbinding_url = os.environ.get("DATABASE_URL")
    if not verbinding_url:
        sys.exit("Zet DATABASE_URL in je omgeving voordat je dit script draait.")

    mapping = json.loads(BRON.read_text(encoding="utf-8"))
    rijen = [(m["key"], m["naam"], m["standaard"], m["bio"], m.get("huismerk")) for m in mapping]

    with psycopg.connect(verbinding_url) as verbinding:
        with verbinding.cursor() as cursor:
            cursor.execute("select count(*) from ah_product_cache")
            (aantal_voor,) = cursor.fetchone()

            cursor.executemany(INVOEGEN, rijen)
        verbinding.commit()

        with verbinding.cursor() as cursor:
            cursor.execute("select count(*) from ah_product_cache")
            (aantal_na,) = cursor.fetchone()

    met_bio = sum(1 for m in mapping if m["bio"])
    print(f"Klaar — {len(rijen)} ingrediënten in data/ah_mapping.json, waarvan {met_bio} met biologische variant.")
    print(f"Database ging van {aantal_voor} naar {aantal_na} gemapte ingrediënten.")

    # Dit is precies hoe de vorige ronde stil bleef steken: de database had 140
    # rijen terwijl het bestand er 508 bevatte, omdat dit script na eerdere
    # aanvullingen op de mapping niet opnieuw gedraaid was. Reken dus altijd
    # even na of het bestand groter is dan wat er al in de database stond.
    if aantal_voor > 0 and aantal_na == aantal_voor and len(rijen) > aantal_voor:
        print(
            "Let op: er stonden al rijen in de database, maar het aantal is niet "
            "gestegen ondanks een groter bestand — controleer of dit de juiste database is."
        )


if __name__ == "__main__":
    main()
