#!/usr/bin/env python3
"""
Diagnose-scriptje: kijkt wat er op een overzichtspagina staat, scrollt een
paar keer naar beneden (voor lazy-loaded content), en schrijft een rapport
weg zodat we de linkherkenning in recept_scraper.py kunnen finetunen.

Gebruik:
    python3 debug_links.py "https://uitpaulineskeuken.nl/hoofdgerechten"
"""
import sys
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "https://uitpaulineskeuken.nl/hoofdgerechten"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(
        user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
    )
    print(f"Openen: {url}")
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)

    # Scroll een paar keer naar beneden voor lazy-loaded content / "laad meer" content.
    for i in range(6):
        page.mouse.wheel(0, 3000)
        page.wait_for_timeout(800)

    html = page.content()
    with open("debug_page.html", "w", encoding="utf-8") as f:
        f.write(html)

    soup = BeautifulSoup(html, "html.parser")
    domain = urlparse(url).netloc
    all_links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(url, a["href"])
        if urlparse(href).netloc == domain:
            all_links.append(href.split("#")[0].split("?")[0])

    unique_links = sorted(set(all_links))

    print(f"\nTotaal <a>-tags met href op de pagina: {len(soup.find_all('a', href=True))}")
    print(f"Daarvan zelfde-domein links: {len(all_links)}")
    print(f"Unieke zelfde-domein links: {len(unique_links)}")
    print(f"\nPagina-titel: {soup.title.string if soup.title else '(geen titel)'}")
    print(f"HTML-lengte: {len(html)} tekens")

    print("\n--- Eerste 40 unieke links ---")
    for link in unique_links[:40]:
        print(" ", link)

    browser.close()

print("\nVolledige HTML weggeschreven naar debug_page.html")
print("Stuur me de terminal-output hierboven, of het bestand debug_page.html.")
