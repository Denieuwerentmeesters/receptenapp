import { GEHAKT_PRODUCT } from './synoniemen'
import type { BoodschapItem } from './database.types'
import { t } from './taal'

/**
 * Vlees met een goede vega-versie gaat standaard vega naar het mandje: gehakt,
 * rookworst, spekjes en kipfilet. Per regel kun je terug naar wat het recept vraagt. En
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

export const VEGAGEHAKT: Variant = { key: 'vegagehakt', naam: 'vegagehakt', get label() { return t('Vegagehakt') } }
export const VEGA_ROOKWORST: Variant = { key: 'vega rookworst', naam: 'vega rookworst', get label() { return t('Vega rookworst') } }
export const VEGA_KIP: Variant = { key: 'vega kipstukjes', naam: 'vega kipstukjes', get label() { return t('Vega kip') } }
export const VEGA_SPEKJES: Variant = { key: 'vega spekjes', naam: 'vega spekjes', get label() { return t('Vega spekjes') } }

const RUNDERGEHAKT: Variant = { key: 'rundergehakt', naam: 'rundergehakt', get label() { return t('Rundergehakt') } }
const KIPGEHAKT: Variant = { key: 'kipgehakt', naam: 'kipgehakt', get label() { return t('Kipgehakt') } }
const ROOKWORST: Variant = { key: 'rookworst', naam: 'rookworst', get label() { return t('Rookworst') } }
const SPEKBLOKJES: Variant = { key: 'spekblokje', naam: 'spekblokjes', get label() { return t('Spekblokjes') } }
const KIPFILET: Variant = { key: 'kipfilet', naam: 'kipfilet', get label() { return t('Kipfilet') } }
const KIPSCHNITZEL: Variant = { key: 'kipschnitzel', naam: 'kipschnitzel', get label() { return t('Kipschnitzel') } }

/**
 * Vlees-gehakt uit een recept: "gehakt", "rundergehakt", "mager kipgehakt",
 * "half om halfgehakt". Niet "knoflook, gehakt" of "knoflook fijngehakt" —
 * daar is gehakt een bereiding, geen product (GEHAKT_PRODUCT).
 *
 * "half om half" zonder gehakt: zo maakte ingredientKey de sleutel tot
 * 11 oktober 2026 (gehakt stond bij de bereidingswoorden); oude lijstregels
 * dragen die nog.
 */
export function isGehakt(key: string): boolean {
  return key === 'half om half' || GEHAKT_PRODUCT.test(key)
}

/** Rookworst en rundrookworst, niet een rookworst die al vega is. */
function isRookworst(key: string): boolean {
  const laatste = key.split(' ').pop() ?? ''
  return /^(rund)?rookworst$/.test(laatste)
}

/** Kipfilet, ook dij- of borstfilet; niet gerookt of kipfilethaasjes: daar is vega geen vervanging voor. */
function isKipfilet(key: string): boolean {
  if (/gerookt/.test(key)) return false
  const laatste = key.split(' ').pop() ?? ''
  return /^kip(?:pen)?(?:dij|borst)?filets?$/.test(laatste)
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
  if (isKipfilet(key)) return VEGA_KIP
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
  if (/^kip(?:stukjes?|filet)$/.test(rest)) return [KIPFILET]
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
