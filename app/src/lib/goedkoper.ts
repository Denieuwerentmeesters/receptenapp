import type { BoodschapItem } from './database.types'
import { aantalVerpakkingen, type LijstRegel } from './lijst'
import type { Winkel } from './winkel'
import { t } from './taal'

/**
 * Goedkoper alternatief op de lijst, voor producten waar het verschil groot is
 * en het alternatief écht hetzelfde doet (Reinoud, 5 nov 2026: parmezaan van
 * € 6,39 tegenover Grana Padano van € 3,49). Een handgemaakte lijst, geen
 * zoekmachine: bij twijfel geen alternatief, zoals bij de mapping.
 *
 * Werkt als de keuzelijst bij vega (lib/vega.ts): de keuze staat per
 * ingrediënt op dit toestel, de standaard is wat het recept vraagt, en
 * `key` is de sleutel waaronder ah_product_cache en jumbo_product_cache het
 * alternatief kennen. Zonder productnummer bij jouw winkel, of zonder
 * besparing, komt het alternatief niet in de lijst.
 */
export interface Alternatief { key: string; naam: string; label: string; uitleg: string }

const GRANA: Alternatief = {
  key: 'grana padano', naam: 'grana padano', get label() { return t('Grana Padano') },
  get uitleg() { return t('Grana Padano is bijna dezelfde harde Italiaanse kaas en smaakt in een gerecht vrijwel hetzelfde.') },
}
const PARMEZAAN_ZAKJE: Alternatief = {
  key: 'parmezaan zakje', naam: 'biologische parmigiano reggiano (zakje)', get label() { return t('Parmigiano in zakje') },
  get uitleg() { return t('Het zakje is echte parmigiano reggiano in een kleine verpakking; handig als het recept maar een beetje vraagt.') },
}

const PARMEZAAN = /^(geraspte )?(parmezaan|parmezaanse kaas|parmigiano reggiano)$/

/** De alternatieven voor dit ingrediënt, leeg als er geen zijn. */
export function alternatieven(key: string): Alternatief[] {
  if (PARMEZAAN.test(key)) return [GRANA, PARMEZAAN_ZAKJE]
  return []
}

/** De rij die naar de winkel gaat, met het gekozen alternatief ('recept' of onbekend: ongewijzigd). */
export function metGoedkoperKeuze(item: BoodschapItem, keuze: string | undefined): BoodschapItem {
  const alt = alternatieven(item.ingredient_key).find((a) => a.key === keuze)
  return alt ? { ...item, naam: alt.naam, ingredient_key: alt.key } : item
}

/** Wat deze regel kost met dit product in het mandje, of null zonder prijs of inhoud. */
function kostMet(regel: LijstRegel, item: BoodschapItem, winkel: Winkel): number | null {
  const prijs = winkel.prijsVoor(item)
  const verpakking = winkel.verpakkingVoor(item)
  if (prijs === undefined || !verpakking) return null
  const aantal = aantalVerpakkingen([{ ...regel, key: item.ingredient_key, naam: item.naam, voorbeeld: item }], verpakking)
  return prijs * aantal
}

export interface GoedkoperOptie extends Alternatief { scheelt: number }

/** Alleen de alternatieven die bij jouw winkel een product hebben en echt goedkoper zijn dan wat het recept vraagt. */
export function goedkoperOpties(regel: LijstRegel, winkel: Winkel): GoedkoperOptie[] {
  const alts = alternatieven(regel.voorbeeld.ingredient_key)
  if (alts.length === 0) return []
  const nu = kostMet(regel, regel.voorbeeld, winkel)
  if (nu === null) return []
  const uit: GoedkoperOptie[] = []
  for (const alt of alts) {
    const item = metGoedkoperKeuze(regel.voorbeeld, alt.key)
    if (!winkel.productVoor(item)) continue
    const kost = kostMet(regel, item, winkel)
    if (kost !== null && nu - kost >= 0.5) uit.push({ ...alt, scheelt: Math.round((nu - kost) * 100) / 100 })
  }
  return uit.sort((a, b) => b.scheelt - a.scheelt)
}

// Zelfde opslag als vega: de keuze geldt per ingrediënt, op dit toestel.
const OPSLAG = 'goedkoper-keuze'

export function leesGoedkoperKeuzes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OPSLAG) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function bewaarGoedkoperKeuzes(keuzes: Record<string, string>): void {
  try {
    localStorage.setItem(OPSLAG, JSON.stringify(keuzes))
  } catch {
    // Privémodus: dan geldt de keuze alleen deze sessie.
  }
}
