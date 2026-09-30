import { altijdInHuis } from './altijdInHuis'
import { ingredientKey } from './schaal'
import type { Ingredient } from './database.types'

/**
 * "Vul mijn week": kiest uit de tien suggesties zoveel recepten als je
 * kookavonden hebt, zodat je niet tien kaarten langs hoeft.
 *
 * De regels, in volgorde van gewicht:
 * 1. Wat al op je lijst staat blijft staan en telt mee.
 * 2. De vega-verhouding uit je voorkeuren (vega_minimum is "van de 10").
 * 3. Niet twee keer dezelfde keuken, als het anders kan.
 * 4. Liefst een recept met het hoofdingrediënt in de bonus bij je winkel.
 * 5. Liefst recepten die ingrediënten delen met wat al gekozen is: dan
 *    blijven er minder halve zakken spinazie over.
 * 6. Daarna de volgorde van de generator (positie), die al rekening houdt
 *    met favorieten, favoriete keukens en bonus.
 *
 * Puur: geen database, zodat het te testen is. De keuze gaat daarna via de
 * gewone "zet op lijst"-flow, dus voorraadkast en basisvoorraad werken mee.
 */

export interface Kandidaat {
  id: string
  positie: number | null
  keuken: string | null
  tags: string[]
  ingredienten: Ingredient[]
  /** Hoofdingrediënt in de bonus bij je winkel (lib/bonus.ts). */
  inBonus?: boolean
}

export interface WeekVoorkeuren {
  vega_minimum: number
  kookavonden: number
}

const isVega = (r: Kandidaat) => r.tags.includes('vegetarisch')

/** Hoeveel van de kookavonden vega moeten zijn, naar verhouding van "x van de 10". */
export function vegaDoel(voorkeuren: WeekVoorkeuren): number {
  return Math.min(voorkeuren.kookavonden, Math.round((voorkeuren.vega_minimum / 10) * voorkeuren.kookavonden))
}

/** De ingrediënten die ertoe doen voor het delen: zonder zout, olie en wat je in huis hebt. */
function sleutels(r: Kandidaat, inHuis: ReadonlySet<string>): Set<string> {
  const uit = new Set<string>()
  for (const ing of r.ingredienten) {
    const key = ingredientKey(ing.naam)
    if (key && !altijdInHuis(key) && !inHuis.has(key)) uit.add(key)
  }
  return uit
}

/**
 * Kiest recepten uit `suggesties` tot er `kookavonden` op de lijst staan.
 * Geeft de ids terug in de volgorde waarin ze gekozen zijn.
 *
 * `suggesties` zijn de kandidaten: alleen wat nog niet gekozen is.
 * `alGekozen` is wat al op je lijst staat.
 */
export function kiesWeek(
  suggesties: Kandidaat[],
  voorkeuren: WeekVoorkeuren,
  alGekozen: Kandidaat[],
  inHuis: ReadonlySet<string> = new Set(),
): string[] {
  const nodig = voorkeuren.kookavonden - alGekozen.length
  if (nodig <= 0) return []

  const gekozen = [...alGekozen]
  const keukens = new Set(gekozen.map((r) => r.keuken).filter(Boolean))
  const gedeeld = new Set<string>()
  for (const r of gekozen) for (const k of sleutels(r, inHuis)) gedeeld.add(k)

  const pool = [...suggesties].sort((a, b) => (a.positie ?? 99) - (b.positie ?? 99))
  const sleutelsVan = new Map(pool.map((r) => [r.id, sleutels(r, inHuis)]))
  const uitkomst: string[] = []

  for (let plek = 0; plek < nodig && pool.length > 0; plek++) {
    const vegaNog = vegaDoel(voorkeuren) - gekozen.filter(isVega).length
    const plekkenNog = voorkeuren.kookavonden - gekozen.length
    // Moeten alle resterende plekken vega zijn om het doel te halen, dan
    // alleen vega — als die er nog zijn.
    const alleenVega = vegaNog >= plekkenNog && pool.some(isVega)
    const kandidaten = alleenVega ? pool.filter(isVega) : pool

    let beste = kandidaten[0]
    let besteScore = -Infinity
    for (const r of kandidaten) {
      const nieuweKeuken = !r.keuken || !keukens.has(r.keuken)
      let delen = 0
      for (const k of sleutelsVan.get(r.id)!) if (gedeeld.has(k)) delen++
      // Keuken weegt het zwaarst, dan bonus, dan delen (afgetopt, zodat één
      // groot recept niet alles wint), dan de volgorde van de generator.
      const score = (nieuweKeuken ? 1000 : 0) + (r.inBonus ? 40 : 0) + Math.min(delen, 3) * 10 - (r.positie ?? 99) * 0.1
      if (score > besteScore) { beste = r; besteScore = score }
    }

    uitkomst.push(beste.id)
    gekozen.push(beste)
    if (beste.keuken) keukens.add(beste.keuken)
    for (const k of sleutelsVan.get(beste.id)!) gedeeld.add(k)
    pool.splice(pool.indexOf(beste), 1)
  }

  return uitkomst
}
