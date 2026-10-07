import type { BoodschapItem } from './database.types'

/**
 * Vlees met een goede vega-versie gaat standaard vega naar het mandje: gehakt,
 * rookworst en spekjes. Per regel kun je terug naar wat het recept vraagt. En
 * andersom: vraagt het recept zelf om vega (vegagehakt, een vega
 * kipschnitzel), dan kun je er op de lijst vlees van maken. De keuze
 * onthouden we per ingrediënt op dit toestel, zodat je 'm niet elke week
 * opnieuw hoeft te maken.
 *
 * `key` is de sleutel waaronder ah_product_cache en jumbo_product_cache het
 * product kennen; `naam` is wat er dan op de rij komt te staan.
 */
export type Variant = { key: string; naam: string; label: string }

/**
 * Wat je op de lijst koos: 'vega' is de standaard (de vega-versie, of bij een
 * vega-recept gewoon wat er staat), 'recept' is wat het recept vraagt, en
 * anders de sleutel van een vleesvariant ('rundergehakt').
 */
export type VegaKeuze = string

export const VEGAGEHAKT: Variant = { key: 'vegagehakt', naam: 'vegagehakt', label: 'Vegagehakt' }
export const VEGA_ROOKWORST: Variant = { key: 'vega rookworst', naam: 'vega rookworst', label: 'Vega rookworst' }
export const VEGA_SPEKJES: Variant = { key: 'vega spekjes', naam: 'vega spekjes', label: 'Vega spekjes' }

const RUNDERGEHAKT: Variant = { key: 'rundergehakt', naam: 'rundergehakt', label: 'Rundergehakt' }
const KIPGEHAKT: Variant = { key: 'kipgehakt', naam: 'kipgehakt', label: 'Kipgehakt' }
const ROOKWORST: Variant = { key: 'rookworst', naam: 'rookworst', label: 'Rookworst' }
const SPEKBLOKJES: Variant = { key: 'spekblokje', naam: 'spekblokjes', label: 'Spekblokjes' }
const KIPSCHNITZEL: Variant = { key: 'kipschnitzel', naam: 'kipschnitzel', label: 'Kipschnitzel' }

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
export function vegaVervanger(key: string): Variant | undefined {
  if (/\b(vega|vegan|vegetarisch\w*|plantaardig\w*)\b/.test(key)) return undefined
  if (isGehakt(key)) return VEGAGEHAKT
  if (isRookworst(key)) return VEGA_ROOKWORST
  if (isSpekjes(key)) return VEGA_SPEKJES
  return undefined
}

/**
 * Het vlees waar je een vega-regel in kunt veranderen: "vegagehakt",
 * "vegetarisch gehakt", "plantaardig rulgehakt" → runder- of kipgehakt;
 * "vegetarische kipschnitzel" → kipschnitzel. Leeg als het geen vega is of
 * er geen vleesversie met een productnummer voor is.
 */
export function vleesVarianten(key: string): Variant[] {
  const vega = key.match(/^(?:vega|vegan|vegetarische?|plantaardige?) ?(.+)$/)
  if (!vega) return []
  const rest = vega[1]
  if (/^(?:rul)?gehakt$/.test(rest)) return [RUNDERGEHAKT, KIPGEHAKT]
  if (rest === 'rookworst') return [ROOKWORST]
  if (/^spek(?:je|blokje|reepje)s?$/.test(rest)) return [SPEKBLOKJES]
  if (/^(?:kip)?schnitzels?$/.test(rest)) return [KIPSCHNITZEL]
  return []
}

/** Eén regel in de keuzelijst; zonder label is het de naam uit het recept. */
export interface VegaOptie { keuze: VegaKeuze; label?: string }

/**
 * De keuzelijst onder een regel, de standaard eerst. Vlees: eerst de
 * vega-versie, dan het recept. Vega: eerst het recept, dan het vlees. Leeg
 * als er niets te kiezen valt.
 */
export function vegaOpties(key: string): VegaOptie[] {
  const vega = vegaVervanger(key)
  if (vega) return [{ keuze: 'vega', label: vega.label }, { keuze: 'recept' }]
  const vlees = vleesVarianten(key)
  if (vlees.length === 0) return []
  return [{ keuze: 'vega' }, ...vlees.map((v) => ({ keuze: v.key, label: v.label }))]
}

/** De rij die naar de winkel gaat: met de gekozen variant, verder ongewijzigd. */
export function metVegaKeuze(item: BoodschapItem, keuze: VegaKeuze): BoodschapItem {
  const variant = keuze === 'vega'
    ? vegaVervanger(item.ingredient_key)
    : keuze === 'recept'
      ? undefined
      : vleesVarianten(item.ingredient_key).find((v) => v.key === keuze)
  if (!variant) return item
  return { ...item, naam: variant.naam, ingredient_key: variant.key }
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
