import type { Ingredient } from './database.types'

/**
 * Eenheden die niet meeschalen met het aantal personen (plan §2.4).
 * "1 snufje zout" blijft 1 snufje, ook als je voor 8 kookt.
 */
const SCHAALT_NIET = new Set(['snufje', 'snuf', 'blaadje', 'blaadjes', 'takje', 'takjes'])

/** Eenheden waarbij halve stuks raar zijn en we op hele getallen afronden. */
const TELBAAR = new Set(['', 'st', 'stuk', 'stuks', 'teen', 'teentje', 'teentjes', 'blik', 'blikje', 'pak', 'zakje'])

export interface GeschaaldIngredient extends Ingredient {
  /** Numerieke hoeveelheid na schaling; null als het recept er geen gaf. */
  geschaald: number | null
  /** Klaar voor weergave, bv. "1,5 tl" of "250 g". */
  weergave: string
}

function parseHoeveelheid(ruw: string | null): number | null {
  if (!ruw) return null
  // De dataset gebruikt zowel "600" als "1,5" als "1/2".
  const genormaliseerd = ruw.trim().replace(',', '.')
  const breuk = genormaliseerd.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (breuk) return Number(breuk[1]) / Number(breuk[2])
  const getal = Number.parseFloat(genormaliseerd)
  return Number.isFinite(getal) ? getal : null
}

function rond(waarde: number, eenheid: string | null): number {
  const e = (eenheid ?? '').toLowerCase().trim()
  if (TELBAAR.has(e)) {
    // Hele of halve stuks — "1,3 ui" oogt raar.
    return waarde < 1 ? Math.round(waarde * 2) / 2 : Math.round(waarde)
  }
  // Gewicht en volume: gewone decimalen, maar niet meer dan één.
  if (waarde >= 10) return Math.round(waarde)
  return Math.round(waarde * 10) / 10
}

function formatteer(waarde: number): string {
  return String(waarde).replace('.', ',')
}

/**
 * Schaalt de ingrediënten van een recept naar het gewenste aantal personen.
 *
 * Dit gebeurt on the fly bij het tonen en bij het samenstellen van de
 * boodschappenlijst — we slaan nooit herschaalde hoeveelheden op, alleen de
 * basis uit het recept plus aantal_personen uit je voorkeuren (plan §2.4).
 */
export function schaalIngredienten(
  ingredienten: Ingredient[],
  receptPersonen: number,
  gewenstPersonen: number,
): GeschaaldIngredient[] {
  const factor = receptPersonen > 0 ? gewenstPersonen / receptPersonen : 1

  return ingredienten.map((ing) => {
    const basis = parseHoeveelheid(ing.hoeveelheid)
    const eenheid = (ing.eenheid ?? '').trim()

    if (basis === null) {
      // Geen hoeveelheid in de brondata ("olijfolie", "peper en zout").
      return { ...ing, geschaald: null, weergave: eenheid }
    }

    const schaaltMee = !SCHAALT_NIET.has(eenheid.toLowerCase())
    const geschaald = rond(schaaltMee ? basis * factor : basis, eenheid)

    return {
      ...ing,
      geschaald,
      weergave: eenheid ? `${formatteer(geschaald)} ${eenheid}` : formatteer(geschaald),
    }
  })
}

/**
 * Genormaliseerde matchsleutel — spiegel van de SQL-functie public.ingredient_key.
 * Wordt clientside gebruikt om ingrediënten van verschillende recepten samen te
 * voegen voordat ze naar de boodschappenlijst gaan.
 */
export function ingredientKey(naam: string): string {
  const schoon = naam
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/'s\b/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(
      /\b(verse?|vers|gedroogde?|gemalen|geraspte?|fijngesneden|grofgesneden|gesneden|gehakte?|geschilde|biologische?|bio|kleine?|grote?|halve|hele|extra|vergine|zonder vel|naar smaak|om te frituren|optioneel)\b/g,
      ' ',
    )
    .replace(/[^a-z ]/g, ' ')
    .replace(/\b\w\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Meervouds-s alleen weghalen waar het Nederlands 'm ook echt plakt: achter
  // -el, -er, -em, -en, -ie, -je of -e (aardappels, bosuitjes, wortels). Achter
  // een gewone klinker gebruikt het Nederlands een apostrof, en die is hierboven
  // al weg. Staat de s ergens anders achter, dan hoort 'ie bij het woord:
  // citroengras, ansjovis, kaas, saus, chips.
  if (schoon.length >= 5 && /(el|er|em|en|ie|je|e)s$/.test(schoon)) {
    return schoon.slice(0, -1)
  }
  return schoon
}
