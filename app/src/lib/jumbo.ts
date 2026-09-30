import { kiesVariant, zoekProduct, type MandjeItem, type MandjeResultaat, type Productvoorkeur } from './ah'
import type { BoodschapItem, JumboProduct } from './database.types'

const MANDJE = 'https://www.jumbo.com/mandje/'
const ZOEKEN = 'https://www.jumbo.com/producten/'

/**
 * Bouwt de mandje-link voor jumbo.com.
 *
 * Het mechanisme is afgekeken van de "Direct in je mandje bij Jumbo"-knop op
 * Uit Paulines Keuken (plan §4): die gaat via tobasket.com en eindigt op
 * `jumbo.com/mandje/?add=[{"sku":"641085STK","quantity":2},…]`. Live getest:
 * de artikelen staan daarna in je mandje. De utm-parameters van de
 * tussenpartij zijn affiliate-tracking en laten we weg.
 *
 * Anders dan bij AH is een SKU geen getal maar een code met een
 * verpakkingsachtervoegsel ("641085STK", "213102PAK") — die gaat ongewijzigd mee.
 */
export function bouwJumboLink(
  items: MandjeItem[],
  mapping: Record<string, JumboProduct>,
  voorkeur: Productvoorkeur,
): MandjeResultaat {
  const gemapt: BoodschapItem[] = []
  const ongemapt: BoodschapItem[] = []
  const aantallen = new Map<string, number>()

  for (const item of items) {
    const product = zoekProduct(item, mapping)
    const sku = product && jumboSku(product, voorkeur)

    if (!sku) {
      ongemapt.push(item)
      continue
    }
    gemapt.push(item)
    aantallen.set(sku, (aantallen.get(sku) ?? 0) + (item.aantal ?? 1))
  }

  const add = [...aantallen].map(([sku, quantity]) => ({ sku, quantity }))
  return { gemapt, ongemapt, url: `${MANDJE}?add=${encodeURIComponent(JSON.stringify(add))}` }
}

/** De SKU die bij je voorkeur past; zelfde terugval als bij AH (kiesVariant). */
export function jumboSku(product: JumboProduct, voorkeur: Productvoorkeur): string | null {
  return kiesVariant({
    standaard: product.standaard_sku, bio: product.bio_sku, huismerk: product.huismerk_sku,
  }, voorkeur)
}

/** Terugval voor een ingrediënt zonder SKU: de zoekpagina van jumbo.com. */
export function jumboZoekLink(naam: string): string {
  return `${ZOEKEN}?searchType=keyword&searchTerms=${encodeURIComponent(naam)}`
}
