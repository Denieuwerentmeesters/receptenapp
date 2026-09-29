import type { BoodschapItem } from './database.types'

/**
 * Gehakt gaat standaard als vegagehakt naar het mandje. Per regel kun je terug
 * naar het gehakt uit het recept; die keuze onthouden we per ingrediënt op dit
 * toestel, zodat je 'm niet elke week opnieuw hoeft te maken.
 */
export const VEGAGEHAKT = 'vegagehakt'

export type GehaktKeuze = 'vega' | 'recept'

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

/** De rij die naar de winkel gaat: bij 'vega' een vegagehakt-rij, verder ongewijzigd. */
export function metGehaktKeuze(item: BoodschapItem, keuze: GehaktKeuze): BoodschapItem {
  if (keuze !== 'vega' || !isGehakt(item.ingredient_key)) return item
  return { ...item, naam: VEGAGEHAKT, ingredient_key: VEGAGEHAKT }
}

const OPSLAG = 'gehakt-keuze'

export function leesGehaktKeuzes(): Record<string, GehaktKeuze> {
  try {
    return JSON.parse(localStorage.getItem(OPSLAG) ?? '{}') as Record<string, GehaktKeuze>
  } catch {
    return {}
  }
}

export function bewaarGehaktKeuzes(keuzes: Record<string, GehaktKeuze>): void {
  try {
    localStorage.setItem(OPSLAG, JSON.stringify(keuzes))
  } catch {
    // Privémodus of geblokkeerde opslag: dan geldt de keuze alleen deze sessie.
  }
}
