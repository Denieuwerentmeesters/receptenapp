#!/usr/bin/env python3
"""Haalt de actuele Jumbo-prijs op van elk product in de mapping.

Voor "Bespaard!": wat kost je mandje, vergeleken met een maaltijdbox. We rekenen
met Jumbo-prijzen, ook als je bij AH bestelt — jumbo.com geeft antwoord op een
kaal HTTP-verzoek, ah.nl niet (zie CLAUDE.md). De prijzen liggen dicht genoeg
bij elkaar voor een besparingsteller.

    python3 scripts/jumbo_prijzen.py              # schrijft data/jumbo_prijzen.json
    python3 scripts/jumbo_prijzen.py --alleen 380106ZK,515106KGR
    python3 scripts/jumbo_prijzen.py --migratie   # maakt er een migratie van

Zoeken op de SKU zelf geeft precies dat product als treffer. We nemen de
gewone prijs, niet de aanbiedingsprijs: aanbiedingen wisselen per week en een
te lage mandjeprijs zou de besparing mooier maken dan hij is.

Prijzen veranderen. Draai dit een paar keer per jaar opnieuw en maak een nieuwe
migratie; een bestaande pas je nooit aan.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
MAPPING = WORTEL / "data" / "jumbo_mapping.json"
DOEL = WORTEL / "data" / "jumbo_prijzen.json"
MIGRATIES = WORTEL / "db" / "migrations"
ZOEK_URL = "https://www.jumbo.com/producten/?searchType=keyword&searchTerms={}"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140 Safari/537.36")

KAART = re.compile(r'data-product-id="([0-9A-Z]+)"')
# In de productkaart staat voor schermlezers "Prijs: € 1,09". Bij een aanbieding
# staat er ook een tweede, lagere prijs; de hoogste is de gewone.
PRIJS = re.compile(r"Prijs:\s*€\s*(\d+),(\d{2})")


def haal_prijs(sku: str) -> float | None:
    verzoek = urllib.request.Request(
        ZOEK_URL.format(urllib.parse.quote(sku)),
        headers={"User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9"},
    )
    try:
        pagina = urllib.request.urlopen(verzoek, timeout=30).read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError) as fout:
        print(f"    ! {sku}: {fout}", file=sys.stderr)
        return None

    begin = pagina.find(f'data-product-id="{sku}"')
    if begin < 0:
        return None
    volgende = KAART.search(pagina, begin + 20)
    kaart = pagina[begin:volgende.start() if volgende else begin + 20000]
    prijzen = [int(e) + int(c) / 100 for e, c in PRIJS.findall(kaart)]
    return max(prijzen) if prijzen else None


def skus_uit_mapping() -> list[str]:
    mapping = json.loads(MAPPING.read_text(encoding="utf-8"))
    return sorted({s for m in mapping for s in (m["standaard"], m["bio"], m.get("huismerk")) if s})


def sql_tekst(waarde: str) -> str:
    return "'" + waarde.replace("'", "''") + "'"


def schrijf_migratie() -> Path:
    prijzen = json.loads(DOEL.read_text(encoding="utf-8"))
    stempel = time.strftime("%Y%m%d%H%M%S")
    pad = MIGRATIES / f"{stempel}_jumbo_prijzen.sql"
    rijen = ",\n".join(
        f"  ({sql_tekst(p['sku'])}, {p['prijs']:.2f}, {sql_tekst(p['peildatum'])})"
        for p in prijzen
    )
    pad.write_text(
        "-- Gegenereerd door scripts/jumbo_prijzen.py --migratie — niet met de hand aanpassen.\n"
        "--\n"
        "-- Gewone prijs (geen aanbieding) per Jumbo-SKU, opgehaald van jumbo.com.\n"
        "-- Voor de besparingsteller in \"Bespaard!\".\n\n"
        "insert into jumbo_prijs (sku, prijs, peildatum)\n"
        f"values\n{rijen}\n"
        "on conflict (sku) do update set\n"
        "  prijs = excluded.prijs,\n"
        "  peildatum = excluded.peildatum;\n",
        encoding="utf-8",
    )
    return pad


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--alleen", help="komma-gescheiden SKU's; schrijft niets weg")
    parser.add_argument("--pauze", type=float, default=0.6, help="seconden tussen verzoeken")
    parser.add_argument("--migratie", action="store_true",
                        help="niet ophalen: maak een migratie van data/jumbo_prijzen.json")
    argumenten = parser.parse_args()

    if argumenten.migratie:
        print(f"Geschreven: {schrijf_migratie().relative_to(WORTEL)}")
        return

    skus = argumenten.alleen.split(",") if argumenten.alleen else skus_uit_mapping()
    vandaag = time.strftime("%Y-%m-%d")
    resultaat = []
    for i, sku in enumerate(skus, 1):
        prijs = haal_prijs(sku)
        print(f"  {i:>3}/{len(skus)}  {sku:<12} {'—' if prijs is None else f'€ {prijs:.2f}'}")
        if prijs is not None:
            resultaat.append({"sku": sku, "prijs": round(prijs, 2), "peildatum": vandaag})
        time.sleep(argumenten.pauze)

    if argumenten.alleen:
        return
    DOEL.write_text(json.dumps(resultaat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"\n{len(resultaat)} van {len(skus)} prijzen → {DOEL.relative_to(WORTEL)}")


if __name__ == "__main__":
    main()
