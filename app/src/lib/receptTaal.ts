/**
 * Welke tekst van een recept de gebruiker ziet. Alleen weergave: de lijst, de
 * AH-mapping en de allergieregels blijven op de Nederlandse naam werken. Is er
 * nog geen Engelse versie (titel_en is null), dan blijft het Nederlands.
 */
import { taal } from './taal'
import type { Ingredient, Recept } from './database.types'

type MetTitel = { titel: string; titel_nl: string | null; titel_en?: string | null }

export function receptTitel(r: MetTitel): string {
  if (taal() === 'en' && r.titel_en) return r.titel_en
  return r.titel_nl ?? r.titel
}

export function receptBereiding(r: Pick<Recept, 'bereiding_nl' | 'bereiding_en'>): string[] {
  if (taal() === 'en' && r.bereiding_en && r.bereiding_en.length === r.bereiding_nl.length) return r.bereiding_en
  return r.bereiding_nl
}

/** De Engelse naam van ingrediënt `i` (zelfde plek als in `ingredienten`), of de gewone naam. */
export function ingredientNaam(r: Pick<Recept, 'ingredienten' | 'ingredienten_en'>, i: number): string {
  const en = taal() === 'en' && r.ingredienten_en?.length === r.ingredienten.length ? r.ingredienten_en[i] : null
  return en?.naam ?? r.ingredienten[i]?.naam ?? ''
}

/** De Engelse eenheid van ingrediënt `i`, of de gewone. */
export function ingredientEenheid(r: Pick<Recept, 'ingredienten' | 'ingredienten_en'>, i: number): string | null {
  const en = taal() === 'en' && r.ingredienten_en?.length === r.ingredienten.length ? r.ingredienten_en[i] : null
  return en ? en.eenheid : r.ingredienten[i]?.eenheid ?? null
}

export type { Ingredient }

/** "2 el" → "2 tbsp": de weergave van een geschaald ingrediënt met de Engelse eenheid. */
export function ingredientWeergave(
  r: Pick<Recept, 'ingredienten' | 'ingredienten_en'>, i: number, weergave: string,
): string {
  const nl = (r.ingredienten[i]?.eenheid ?? '').trim()
  const en = (ingredientEenheid(r, i) ?? '').trim()
  if (!nl || nl === en) return weergave
  if (weergave === nl) return en
  return weergave.endsWith(` ${nl}`) ? `${weergave.slice(0, -nl.length)}${en}` : weergave
}
