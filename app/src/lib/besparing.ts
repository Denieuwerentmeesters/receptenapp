import { zoekProduct, type Productvoorkeur } from './ah'
import { jumboSku } from './jumbo'
import { schatIngredient } from './prijsschatting'
import type { JumboProduct } from './database.types'
import { verpakkingenPerRegel, type LijstRegel } from './lijst'
import type { Verpakking } from './eenheden'

/**
 * "Bespaard!": wat je mandje kost naast wat dezelfde avondmaaltijden bij een
 * maaltijdbox zouden kosten.
 *
 * De vergelijking rekent zich bewust niet rijk:
 *  - Het mandje telt hele verpakkingen (een zak aardappelen van 3 kg), ook al
 *    eet je die niet in één week op. Een maaltijdbox levert precies af.
 *  - We nemen de gewone Jumbo-prijs, geen aanbieding (scripts/jumbo_prijzen.py).
 *  - Aan de maaltijdboxkant geen toeslag voor premiumgerechten of een
 *    avondbezorging, en de laagste portieprijs voor jouw aantal personen.
 */

/**
 * HelloFresh NL, september 2026: prijs per portie naar aantal personen, bij
 * het gangbare aantal maaltijden per week. Bronnen: foodboxen.nl (prijzen
 * gecontroleerd 16-09-2026: 1p/3 €39,99 · 2p/3 €45,99 · 4p/4 €84,99 ·
 * 6p/5 €134,99) en flyingfoodie.nl (april 2026: 3p/3 €6,44 p.p.). Vijf
 * personen ligt er tussenin. Meer dan zes bezorgt HelloFresh niet; dan geldt
 * de prijs voor zes.
 *
 * Prijzen veranderen: kijk dit een paar keer per jaar na.
 */
export const MAALTIJDBOX = {
  naam: 'HelloFresh',
  peildatum: 'september 2026',
  perPortie: { 1: 13.33, 2: 7.67, 3: 6.44, 4: 5.31, 5: 4.9, 6: 4.49 } as Record<number, number>,
  /** Eén keer per week, bij de eerste bestelling. */
  bezorging: 5.99,
}

export function prijsPerPortie(personen: number): number {
  const p = Math.min(6, Math.max(1, Math.round(personen)))
  return MAALTIJDBOX.perPortie[p]
}

export function maaltijdboxKosten(maaltijden: number, personen: number, metBezorging: boolean): number {
  if (maaltijden <= 0) return 0
  const kosten = maaltijden * personen * prijsPerPortie(personen) + (metBezorging ? MAALTIJDBOX.bezorging : 0)
  return Math.round(kosten * 100) / 100
}

export interface MandjeKosten {
  totaal: number
  /** Regels met een echte Jumbo-prijs; de rest is geschat. */
  metPrijs: number
  geschat: number
}

/**
 * Wat de regels die naar de winkel gaan kosten, in Jumbo-prijzen — ook als je
 * bij AH bestelt; die liggen dicht genoeg bij elkaar. Zoveel verpakkingen
 * als de mandjelink (verpakkingenPerRegel). Zonder Jumbo-prijs de klassenschatting uit
 * lib/prijsschatting.ts. Zelf toegevoegde producten (koffie, wc-papier) tellen
 * niet mee: die zitten ook niet in een maaltijdbox.
 */
export function mandjeKosten(
  regels: LijstRegel[],
  mapping: Record<string, JumboProduct>,
  prijzen: Record<string, number>,
  voorkeur: Productvoorkeur,
  verpakkingen: Record<string, Verpakking> = {},
): MandjeKosten {
  let totaal = 0
  let metPrijs = 0
  let geschat = 0

  const skuVan = (regel: LijstRegel) => {
    const product = zoekProduct(regel.voorbeeld, mapping)
    return (product && jumboSku(product, voorkeur)) ?? null
  }
  const uitRecepten = regels.filter((r) => r.items.some((i) => i.bron_type === 'recept'))
  const aantallen = verpakkingenPerRegel(uitRecepten, skuVan, (r) => verpakkingen[skuVan(r) ?? ''])

  for (const regel of uitRecepten) {
    const uitRecept = regel.items.filter((i) => i.bron_type === 'recept')
    const sku = skuVan(regel)
    const prijs = sku ? prijzen[sku] : undefined
    if (prijs !== undefined) {
      totaal += prijs * (aantallen.get(regel.key)?.aantal ?? 1)
      metPrijs++
      continue
    }

    let schatting = 0
    for (const item of uitRecept) {
      schatting += schatIngredient({
        naam: item.naam,
        hoeveelheid: item.hoeveelheid === null ? null : String(item.hoeveelheid),
        eenheid: item.eenheid,
      }) ?? 0
    }
    if (schatting > 0) {
      totaal += schatting
      geschat++
    }
  }

  return { totaal: Math.round(totaal * 100) / 100, metPrijs, geschat }
}

/** "€ 34": hele euro's leest als een score. Met centen voor de uitleg per bestelling. */
export function euro(bedrag: number, centen = false): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: centen ? 2 : 0,
    maximumFractionDigits: centen ? 2 : 0,
  }).format(bedrag)
}

export function bespaardMet(b: { maaltijdbox_kosten: number; mandje_kosten: number }): number {
  return b.maaltijdbox_kosten - b.mandje_kosten
}

export function totaalBespaard(bestellingen: { maaltijdbox_kosten: number; mandje_kosten: number }[]): number {
  return bestellingen.reduce((som, b) => som + bespaardMet(b), 0)
}
