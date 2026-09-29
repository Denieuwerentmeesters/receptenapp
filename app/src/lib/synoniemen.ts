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

export function canoniek(key: string): string {
  if (KNOFLOOK.test(key)) return 'knoflook'
  if (key === 'krop sla' || key === 'kropsla') return 'sla'
  return key
}
