import { enkelvoudVormen } from './ah'

/**
 * Staat dit ingrediënt in je voorraadkast?
 *
 * Bij het op de lijst zetten van een recept filteren we al op de voorraadkast,
 * maar zet je iets pas daarna op "in huis", dan staat het al op je lijst. Die
 * regels blijven staan (dan zie je dat een recept ze vraagt) maar gaan niet
 * mee naar het mandje.
 *
 * Naast een exacte match ook het enkelvoud ("preien" → "prei") en een
 * voorraadnaam als laatste woord(en): "grove mosterd" is mosterd. Niet als
 * eerste woord: "rijst azijn" is geen rijst.
 */
export function inVoorraad(key: string, voorraad: ReadonlySet<string>): boolean {
  if (voorraad.has(key)) return true
  if (enkelvoudVormen(key).some((vorm) => voorraad.has(vorm))) return true
  for (const v of voorraad) {
    if (key.endsWith(' ' + v)) return true
  }
  return false
}
