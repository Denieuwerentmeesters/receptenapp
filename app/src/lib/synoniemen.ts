/**
 * Ingrediënten die in recepten anders heten maar in de winkel hetzelfde zijn.
 *
 * "knoflooktenen", "teentjes knoflook" en "knoflook, fijngehakt" zijn allemaal
 * gewoon knoflook: één regel op je lijst, en staat knoflook in je voorraadkast,
 * dan hoeft geen van drieën op de lijst.
 *
 * Dit hoort bewust niet in ingredientKey: die sleutel moet op drie plekken
 * identiek blijven (SQL, app, script) en ligt vast in opgeslagen rijen. Dit is
 * een laag erbovenop, alleen in de app.
 */
const TEEN = '(?:teen|teentje|teentjes|tenen)'
const KNOFLOOK = new RegExp(`^(?:${TEEN} )?knoflook(?:${TEEN})?(?: ${TEEN})?(?: .*)?$`)

/** Tenen en teentjes tellen op als één eenheid. */
export const TENEN = new Set(['teen', 'teentje', 'teentjes', 'tenen'])

/**
 * Een maat die in de naam is beland ("gram kurkuma", "theelepel komijn"): die
 * hoort niet bij het product.
 */
const MAAT_VOORAAN = /^(?:gram|kilo|theelepels?|eetlepels?|tl|el|snufje|mespuntje) (?=.)/

/** Kruiden die ook als "…poeder" in recepten staan maar hetzelfde potje zijn. */
const POEDER_IS_KRUID = /^(kurkuma|komijn|kaneel)poeder$/

export function canoniek(ruw: string): string {
  const key = ruw.replace(MAAT_VOORAAN, '').replace(POEDER_IS_KRUID, '$1')
  if (KNOFLOOK.test(key)) return 'knoflook'
  if (key === 'krop sla' || key === 'kropsla') return 'sla'
  return key
}
