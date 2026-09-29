import type { BoodschapItem } from './database.types'

/**
 * Vlees met een goede vega-versie gaat standaard vega naar het mandje: gehakt,
 * rookworst en spekjes. Per regel kun je terug naar wat het recept vraagt; die
 * keuze onthouden we per ingrediënt op dit toestel, zodat je 'm niet elke week
 * opnieuw hoeft te maken.
 *
 * `key` is de sleutel waaronder ah_product_cache en jumbo_product_cache het
 * vega-product kennen.
 */
export type VegaVervanger = { key: string; naam: string; label: string }

export type VegaKeuze = 'vega' | 'recept'

export const VEGAGEHAKT: VegaVervanger = { key: 'vegagehakt', naam: 'vegagehakt', label: 'Vegagehakt' }
export const VEGA_ROOKWORST: VegaVervanger = { key: 'vega rookworst', naam: 'vega rookworst', label: 'Vega rookworst' }
export const VEGA_SPEKJES: VegaVervanger = { key: 'vega spekjes', naam: 'vega spekjes', label: 'Vega spekjes' }

/**
 * Vlees-gehakt uit een recept: "rundergehakt", "mager kipgehakt",
 * "half om halfgehakt". Niet "knoflook fijngehakt" — daar is gehakt een
 * bereiding, geen product.
 *
 * Een los woord "gehakt" haalt ingredientKey weg (het staat bij de
 * bereidingswoorden), dus "half om half gehakt" komt hier aan als "half om half".
 */
export function isGehakt(key: string): boolean {
  if (key === 'half om half') return true
  const laatste = key.split(' ').pop() ?? ''
  return /^(runder|rund|kip|kalfs|varkens|lams|half)?gehakt$/.test(laatste)
}

/** Rookworst en rundrookworst, niet een rookworst die al vega is. */
function isRookworst(key: string): boolean {
  const laatste = key.split(' ').pop() ?? ''
  return /^(rund)?rookworst$/.test(laatste)
}

/**
 * Spekjes in blokjes of reepjes: "spekblokjes", "gerookte spekreepjes".
 * Niet ontbijtspek, bacon of pancetta (plakken) en niet zuurkoolspek (een
 * stuk om mee te koken): daar zijn vega spekjes geen vervanging voor.
 */
function isSpekjes(key: string): boolean {
  const laatste = key.split(' ').pop() ?? ''
  return /^spek(je|blokje|reepje)$/.test(laatste)
}

/** De vega-versie van dit ingrediënt, of undefined als er geen is. */
export function vegaVervanger(key: string): VegaVervanger | undefined {
  if (/\b(vega|vegan|vegetarisch\w*|plantaardig\w*)\b/.test(key)) return undefined
  if (isGehakt(key)) return VEGAGEHAKT
  if (isRookworst(key)) return VEGA_ROOKWORST
  if (isSpekjes(key)) return VEGA_SPEKJES
  return undefined
}

/** De rij die naar de winkel gaat: bij 'vega' de vega-versie, verder ongewijzigd. */
export function metVegaKeuze(item: BoodschapItem, keuze: VegaKeuze): BoodschapItem {
  const vervanger = keuze === 'vega' ? vegaVervanger(item.ingredient_key) : undefined
  if (!vervanger) return item
  return { ...item, naam: vervanger.naam, ingredient_key: vervanger.key }
}

// Heette eerst 'gehakt-keuze'; zo blijven eerder gemaakte keuzes staan.
const OPSLAG = 'gehakt-keuze'

export function leesVegaKeuzes(): Record<string, VegaKeuze> {
  try {
    return JSON.parse(localStorage.getItem(OPSLAG) ?? '{}') as Record<string, VegaKeuze>
  } catch {
    return {}
  }
}

export function bewaarVegaKeuzes(keuzes: Record<string, VegaKeuze>): void {
  try {
    localStorage.setItem(OPSLAG, JSON.stringify(keuzes))
  } catch {
    // Privémodus of geblokkeerde opslag: dan geldt de keuze alleen deze sessie.
  }
}
