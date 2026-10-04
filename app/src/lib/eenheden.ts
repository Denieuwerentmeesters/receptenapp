import { enkelvoudVormen } from './ah'

/**
 * Hoeveelheden uit een recept omrekenen naar de eenheid van een verpakking,
 * zodat we kunnen tellen hoeveel pakken er nodig zijn (aantalVerpakkingen in
 * lib/lijst.ts). Drie basiseenheden, dezelfde als in jumbo_verpakking: g, ml
 * en stuks.
 *
 * Bewust grof. Een eetlepel of theelepel rekenen we niet om: dat is nooit
 * meer dan één verpakking, en een potje saffraan van 0,05 g zou anders
 * honderd potjes worden. Gram en milliliter behandelen we als gelijk; voor
 * sauzen, zuivel en bouillon klopt dat ongeveer, en afwijken kan alleen bij
 * de grens van een verpakking.
 */

export type Basis = 'g' | 'ml' | 'stuks'

export interface Verpakking {
  inhoud: number
  eenheid: Basis
}

const MAAT: Record<string, [Basis, number]> = {
  g: ['g', 1], gr: ['g', 1], gram: ['g', 1], kg: ['g', 1000], kilo: ['g', 1000],
  ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000], ltr: ['ml', 1000], liter: ['ml', 1000],
  '': ['stuks', 1], st: ['stuks', 1], 'st.': ['stuks', 1], stuk: ['stuks', 1], stuks: ['stuks', 1],
}

/**
 * Wat één stuk ongeveer weegt, voor "3 uien" tegenover een net van 1 kg.
 * Alleen gangbare dingen; staat iets er niet in, dan tellen stuks niet mee.
 */
const STUKGEWICHT: Record<string, number> = {
  ui: 150, 'rode ui': 150, sjalot: 30, paprika: 150, 'rode paprika': 150, tomaat: 100,
  aardappel: 150, wortel: 80, winterpeen: 250, citroen: 120, limoen: 70, appel: 180,
  courgette: 300, aubergine: 300, prei: 250, komkommer: 400,
  pompoen: 1000, flespompoen: 1000, bloemkool: 800, knolselderij: 700, venkel: 250, venkelknol: 250,
  'chinese kool': 800, avocado: 170, mango: 350,
}

/** Ook voor de andere kant op: 2,5 kg pompoen is drie pompoenen (aantalVerpakkingen). */
export function stukgewicht(key: string): number | undefined {
  for (const vorm of [key, ...enkelvoudVormen(key)]) {
    if (STUKGEWICHT[vorm]) return STUKGEWICHT[vorm]
  }
  return undefined
}

/**
 * Een hoeveelheid uit het recept in de basiseenheid `doel`, of null als dat
 * niet kan of niet verstandig is (el, tl, snufje, bosje).
 */
export function naarEenheid(
  hoeveelheid: number | null, eenheid: string | null, key: string, doel: Basis,
): number | null {
  if (hoeveelheid === null || hoeveelheid <= 0) return null
  const maat = MAAT[(eenheid ?? '').trim().toLowerCase()]
  if (!maat) return null
  const [basis, factor] = maat
  const waarde = hoeveelheid * factor
  if (basis === doel) return waarde
  if (basis !== 'stuks' && doel !== 'stuks') return waarde // g ↔ ml, één op één
  if (basis === 'stuks') {
    const gewicht = stukgewicht(key)
    return gewicht ? waarde * gewicht : null
  }
  return null // gram naar stuks raden we niet
}

/** "500 g", "1 kg", "1,5 l", "10 stuks": voor onder een regel op de lijst. */
export function inhoudTekst(v: Verpakking): string {
  const getal = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
  if (v.eenheid === 'g') return v.inhoud >= 1000 ? `${getal(v.inhoud / 1000)} kg` : `${getal(v.inhoud)} g`
  if (v.eenheid === 'ml') return v.inhoud >= 1000 ? `${getal(v.inhoud / 1000)} l` : `${getal(v.inhoud)} ml`
  return `${getal(v.inhoud)} ${v.inhoud === 1 ? 'stuk' : 'stuks'}`
}
