import { enkelvoudVormen } from './ah'
import { BEREIDING, canoniek } from './synoniemen'

/**
 * Soorten die in je voorraadkast onder één naam staan. "Azijn" is de gewone
 * fles: witte of rode wijnazijn, appelazijn. Rijstazijn en balsamico niet —
 * die staan er apart in of heeft niet iedereen. "Boter" is ook roomboter.
 */
const BIJZONDERE_AZIJN = /rijst|sushi|balsamico|japanse|sherry|champagne|cranberry|citroen/

function algemeen(key: string): string {
  if (/azijn$/.test(key) && !BIJZONDERE_AZIJN.test(key)) return 'azijn'
  if (/balsamico azijn$/.test(key)) return key.replace(/balsamico azijn$/, 'balsamicoazijn')
  return key.replace(/\broomboter$/, 'boter')
}

/** Lente-ui en ingelegde ui zijn geen uien, ook al eindigen ze erop. */
const ANDER_PRODUCT = /(?:^| )(?:lente|bos|ingelegde|zoetzure) /

/**
 * Staat dit ingrediënt in je voorraadkast?
 *
 * Bij het op de lijst zetten van een recept filteren we al op de voorraadkast,
 * maar zet je iets pas daarna op "in huis", dan staat het al op je lijst. Die
 * regels blijven staan (dan zie je dat een recept ze vraagt) maar gaan niet
 * mee naar het mandje.
 *
 * Naast een exacte match ook enkel- en meervoud, in beide richtingen ("preien"
 * → "prei", en "ui" in het recept is "Uien" in de kast) en een voorraadnaam
 * als laatste woord(en): "grove mosterd" is mosterd, "rode ui" is ui. Niet als
 * eerste woord: "rijst azijn" is geen rijst — behalve als er alleen een
 * bereiding achter staat. En synoniemen: knoflooktenen zijn knoflook.
 */
export function inVoorraad(key: string, voorraad: ReadonlySet<string>): boolean {
  if (voorraad.size === 0) return false
  // Het potje is niet het bosje: gemalen koriander staat alleen in de kast als het er zelf staat.
  if (/^(gemalen|gedroogde) /.test(key)) return voorraad.has(key)
  // De kast in alle vormen: "uien" telt ook als "ui".
  const kast = new Set<string>()
  for (const v of voorraad) {
    kast.add(v)
    for (const vorm of enkelvoudVormen(v)) kast.add(vorm)
  }

  const kaal = algemeen(canoniek(key).replace(BEREIDING, ''))
  const namen = [key, canoniek(key), kaal]
  for (const vorm of [...namen, ...enkelvoudVormen(key), ...enkelvoudVormen(kaal)]) {
    if (kast.has(vorm)) return true
  }
  // Als laatste woord(en). Niet met de enkelvouden van het recept: "eetbare
  // bloemen" is geen bloem. En niet voor "lente ui" of "sushi azijn".
  if (ANDER_PRODUCT.test(kaal)) return false
  const andereAzijn = /azijn$/.test(kaal) && BIJZONDERE_AZIJN.test(kaal)
  for (const naam of namen) {
    for (const v of kast) {
      if (andereAzijn && v === 'azijn') continue
      if (naam.endsWith(' ' + v)) return true
    }
  }
  return false
}
