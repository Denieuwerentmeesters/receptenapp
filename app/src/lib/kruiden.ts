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

/** Hoort dit bij het kruidenrek? We volgen het schap uit de winkelindeling. */
export function isDroogKruid(key: string): boolean {
  // Cacaopoeder landt via "poeder" bij de specerijen, maar is bakwerk.
  return schapVoor(key) === 'Kruiden & specerijen' && !/cacao/.test(key)
}
