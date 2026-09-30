#!/usr/bin/env python3
"""Inhoud per Jumbo-verpakking, uit de productnamen (plan gemak en bonus, §4B).

Jumbo zet de inhoud in de productnaam: "Jumbo Aardappelen Vastkokend 3 kg",
"Jumbo Kokosmelk 400 ml", "Jumbo Eieren 10 stuks", "Jumbo Yoghurt 4 x 125 g".
Dit script haalt die uit data/jumbo_mapping.json (standaard, bio en huismerk)
en schrijft data/jumbo_verpakkingen.json. Geen netwerk nodig.

    python3 scripts/jumbo_verpakkingen.py              # schrijft de json
    python3 scripts/jumbo_verpakkingen.py --migratie   # maakt er een migratie van

We rekenen om naar drie basiseenheden: g, ml en stuks. Staat er zowel een
gewicht als een aantal in de naam ("Kipfilet 2 stuks 300 g"), dan wint het
gewicht: recepten vragen vaker grammen dan stuks.

Bij twijfel: geen inhoud. Dan telt de app gewoon één verpakking (stap A).
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
BRON = WORTEL / "data" / "jumbo_mapping.json"
DOEL = WORTEL / "data" / "jumbo_verpakkingen.json"
MIGRATIES = WORTEL / "db" / "migrations"

INHOUD = re.compile(
    r"(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilo|gram|gr|g|liter|ltr|l|cl|ml|stuks|stuk|st)\b",
    re.IGNORECASE,
)
FACTOR = {
    "kg": ("g", 1000), "kilo": ("g", 1000), "gram": ("g", 1), "gr": ("g", 1), "g": ("g", 1),
    "liter": ("ml", 1000), "ltr": ("ml", 1000), "l": ("ml", 1000), "cl": ("ml", 10), "ml": ("ml", 1),
    "stuks": ("stuks", 1), "stuk": ("stuks", 1), "st": ("stuks", 1),
}


# Concentraten en gedroogde kruiden: 81,6 g bouillonblokjes maakt liters
# bouillon, en een potje gedroogde kervel is geen bakje verse. De inhoud zegt
# daar niets over hoeveel je nodig hebt, dus die slaan we over.
GEEN_INHOUD = re.compile(r"blokje|tablet|poeder|fond|concentraat|verstegen|gedroogd|kruiden\b", re.IGNORECASE)


def inhoud_uit_naam(naam: str | None) -> tuple[float, str] | None:
    if not naam or GEEN_INHOUD.search(naam):
        return None
    gevonden = []
    for m in INHOUD.finditer(naam):
        keer = int(m.group(1)) if m.group(1) else 1
        waarde = float(m.group(2).replace(",", "."))
        eenheid, factor = FACTOR[m.group(3).lower()]
        gevonden.append((round(keer * waarde * factor, 2), eenheid))
    if not gevonden:
        return None
    # Gewicht of volume gaat voor een aantal stuks.
    maat = [g for g in gevonden if g[1] != "stuks"]
    kies = (maat or gevonden)[-1]
    # Bouillon in gram of stuks zijn blokjes of poeder, geen vloeibare bouillon.
    if re.search(r"bouillon", naam, re.IGNORECASE) and kies[1] != "ml":
        return None
    return kies if kies[0] > 0 else None


def verzamel() -> list[dict]:
    mapping = json.loads(BRON.read_text())
    per_sku: dict[str, dict] = {}
    for rij in mapping:
        for sku_veld, naam_veld in (("standaard", "naam"), ("bio", "bio_naam"), ("huismerk", "huismerk_naam")):
            sku, naam = rij.get(sku_veld), rij.get(naam_veld)
            if not sku or sku in per_sku:
                continue
            inhoud = inhoud_uit_naam(naam)
            if inhoud:
                per_sku[sku] = {"sku": sku, "inhoud": inhoud[0], "eenheid": inhoud[1], "naam": naam}
    return sorted(per_sku.values(), key=lambda r: r["sku"])


def sql_tekst(waarde: str) -> str:
    return "'" + waarde.replace("'", "''") + "'"


def schrijf_migratie(rijen: list[dict]) -> Path:
    stempel = datetime.now().strftime("%Y%m%d%H%M%S")
    pad = MIGRATIES / f"{stempel}_jumbo_verpakkingen.sql"
    waarden = ",\n".join(
        f"  ({sql_tekst(r['sku'])}, {r['inhoud']:g}, {sql_tekst(r['eenheid'])})" for r in rijen
    )
    pad.write_text(
        "-- Gegenereerd door scripts/jumbo_verpakkingen.py --migratie — niet met de hand aanpassen.\n"
        "-- Inhoud per Jumbo-SKU, uit de productnaam. Zie de uitleg in het script.\n\n"
        "insert into jumbo_verpakking (sku, inhoud, eenheid)\nvalues\n"
        f"{waarden}\n"
        "on conflict (sku) do update set\n"
        "  inhoud = excluded.inhoud,\n"
        "  eenheid = excluded.eenheid;\n"
    )
    return pad


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--migratie", action="store_true", help="maak een migratie van data/jumbo_verpakkingen.json")
    args = parser.parse_args()

    if args.migratie:
        rijen = json.loads(DOEL.read_text())
        print(f"Migratie geschreven: {schrijf_migratie(rijen).relative_to(WORTEL)} ({len(rijen)} SKU's)")
        return

    rijen = verzamel()
    DOEL.write_text(json.dumps(rijen, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(rijen)} SKU's met inhoud → {DOEL.relative_to(WORTEL)}")


if __name__ == "__main__":
    main()
