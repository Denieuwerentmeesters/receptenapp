#!/usr/bin/env python3
"""Draait de SQL-migraties uit db/migrations op volgorde.

    pip install 'psycopg[binary]'
    export DATABASE_URL='postgres://...@ep-xxx.neon.tech/receptenapp?sslmode=require'
    python3 scripts/migrate.py

Houdt bij wat al gedraaid is in de tabel `schema_migraties`, dus opnieuw draaien
is veilig. Elke migratie draait in zijn eigen transactie: mislukt er één, dan
staat de database niet half bij.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

MAP = Path(__file__).resolve().parent.parent / "db" / "migrations"


def main() -> None:
    import psycopg

    verbinding_url = os.environ.get("DATABASE_URL")
    if not verbinding_url:
        sys.exit("Zet DATABASE_URL in je omgeving voordat je dit script draait.")

    bestanden = sorted(MAP.glob("*.sql"))
    if not bestanden:
        sys.exit(f"Geen migraties gevonden in {MAP}")

    with psycopg.connect(verbinding_url, autocommit=True) as verbinding:
        verbinding.execute(
            "create table if not exists schema_migraties ("
            "  naam text primary key,"
            "  gedraaid_op timestamptz not null default now())"
        )
        gedraaid = {rij[0] for rij in verbinding.execute("select naam from schema_migraties")}

        for bestand in bestanden:
            if bestand.name in gedraaid:
                print(f"  overslaan  {bestand.name}")
                continue

            print(f"  draaien    {bestand.name}")
            try:
                with verbinding.transaction():
                    verbinding.execute(bestand.read_text(encoding="utf-8"))
                    verbinding.execute(
                        "insert into schema_migraties (naam) values (%s)", (bestand.name,)
                    )
            except Exception as fout:  # noqa: BLE001 — we willen de naam erbij zien
                sys.exit(f"\n{bestand.name} mislukt:\n{fout}")

        # De Neon Data API (PostgREST) cachet het schema en merkt nieuwe tabellen
        # niet vanzelf op: de app krijgt dan PGRST205 ("Could not find the table
        # ... in the schema cache"). Altijd verversen, ook als er niets nieuws
        # draaide — het kost niets en zo herstelt een handmatige run het ook.
        verbinding.execute("notify pgrst, 'reload schema'")
        print("  schema-cache van de Data API ververst")

    print("\nKlaar.")


if __name__ == "__main__":
    main()
