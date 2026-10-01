import { ingredientKey } from './schaal'
import { schapVoor } from './winkelindeling'

/**
 * "Droge kruiden" in je voorraadkast staat voor het hele kruidenrek: peper,
 * kurkuma, paprikapoeder, chilipoeder enzovoort. Die blijven op je lijst
 * staan — dan zie je dat een recept ze vraagt — maar gaan niet mee naar het
 * mandje. Anders koop je elke week een nieuw potje komijn.
 */
export const DROGE_KRUIDEN = 'Droge kruiden'
export const DROGE_KRUIDEN_KEY = ingredientKey(DROGE_KRUIDEN)

export const DROGE_KRUIDEN_UITLEG =
  'We gaan er vanuit dat je veel standaard kruiden thuis hebt (peper, kurkuma, paprikapoeder, ' +
  'chilipoeder etc). Let er soms op om deze in huis te halen.'

/**
 * Wat via "zout" of "poeder" bij de specerijen landt, maar geen kruid is:
 * gezouten boter en noten, poedersuiker, sojasaus, bakmeel. Die moeten gewoon
 * mee naar het mandje.
 */
const GEEN_KRUID = /cacao|boter|cashew|pinda|noot\b|noten|suiker|sojasaus|pretzel|stokjes|bakmeel|bloem|gelei|chocolade|maizena|bouillon|kruidenpasta|soep|wortel|trassi/

/**
 * Bijzondere kruiden: die heeft niet iedereen in het kruidenrek staan. Ze
 * vallen niet onder "Droge kruiden" en gaan dus mee naar het mandje, maar
 * eerst vragen we of je ze echt niet in huis hebt. Een potje sumak kost
 * een paar euro en gaat jaren mee.
 */
const BIJZONDER = /sumak|sumac|za atar|zaatar|ras el hanout|kardemom|steranijs|saffraan|fenegriek|nigella|baharat|\burfa|aleppo|pul biber|dukkah|berbere|vijfkruiden|laospoeder|karwij|masalakruiden|tajin|mexicaanse oregano|jeneverbes|shichimi|roze peperkorrel/

/** Hoort dit bij het kruidenrek? We volgen het schap uit de winkelindeling. */
export function isDroogKruid(key: string): boolean {
  return schapVoor(key) === 'Kruiden & specerijen' && !GEEN_KRUID.test(key) && !isBijzonderKruid(key)
}

/** Een kruid dat je niet zomaar in huis hebt; zie BIJZONDER. */
export function isBijzonderKruid(key: string): boolean {
  return BIJZONDER.test(key)
}

/**
 * Een potje uit het kruidenrek, gewoon of bijzonder. Op de lijst staat alleen
 * de naam: je koopt een potje, geen theelepel. Hoeveel erin gaat zie je in
 * het recept.
 */
export function isKruid(key: string): boolean {
  return schapVoor(key) === 'Kruiden & specerijen' && !GEEN_KRUID.test(key)
}
