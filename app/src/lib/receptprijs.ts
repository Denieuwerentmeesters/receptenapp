import { useMemo } from 'react'
import { altijdInHuis } from './altijdInHuis'
import type { BoodschapItem } from './database.types'
import { naarEenheid, stukgewicht, type Verpakking } from './eenheden'
import { DROGE_KRUIDEN_KEY, isDroogKruid } from './kruiden'
import { schatIngredient } from './prijsschatting'
import { useVoorraad } from './queries2'
import { ingredientKey } from './schaal'
import { inVoorraad } from './voorraad'
import { useWinkel } from './winkel'

/**
 * Wat een recept ongeveer kost per persoon, in de prijzen van jouw winkel
 * (AH of Jumbo), met wat je in de voorraadkast hebt eraf.
 *
 * Anders dan Bespaard! (mandjeKosten: hele verpakkingen, want die ga je
 * kopen) rekenen we hier het aandeel: 150 g uit een pak van 500 g kost 30% van
 * de pakprijs. Een recept kost wat het verbruikt; wat er overblijft heb je
 * een andere avond nodig. Zo zijn recepten onderling te vergelijken.
 *
 * Per ingrediënt, in deze volgorde:
 *  - basisvoorraad (water, zout, olie) of wat in je voorraadkast staat: telt niet;
 *  - product met prijs én bekende inhoud, en de hoeveelheid is om te rekenen:
 *    aandeel van de pakprijs;
 *  - anders de klassenschatting uit lib/prijsschatting.ts (el, tl, een bos,
 *    producten zonder prijs of inhoud).
 * `geschat` zegt hoeveel regels op die schatting rekenden, zodat het scherm
 * niet doet alsof het exact is.
 */

/** De drie dingen die een winkel (lib/winkel.ts) over een product weet. */
export interface PrijsBron {
  productVoor: (item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>) => string | null
  verpakkingVoor: (item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>) => Verpakking | undefined
  prijsVoor: (item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>) => number | undefined
}

export interface PrijsRegel {
  naam: string
  eenheid: string | null
  geschaald: number | null
}

export interface ReceptPrijs {
  /** Totaal voor het gevraagde aantal personen, in euro's. */
  totaal: number
  perPersoon: number
  /** Regels met een echte prijs. */
  opPrijs: number
  /** Regels die op de klassenschatting rekenden. */
  geschat: number
  /** Regels die je al in huis hebt (voorraadkast) en dus niets kosten. */
  inHuis: number
}

/** Meer dan tien verpakkingen voor één regel is een fout in de data, geen recept. */
const MAX_AANDEEL = 10

/** Het aandeel van een verpakking dat deze regel verbruikt, of null als dat niet te zeggen is. */
function aandeel(regel: PrijsRegel, key: string, verpakking: Verpakking): number | null {
  if (regel.geschaald === null) return null
  let nodig = naarEenheid(regel.geschaald, regel.eenheid, key, verpakking.eenheid)
  // Een prijs per stuk (bloemkool) tegenover een recept in gram: via het stukgewicht.
  if (nodig === null && verpakking.eenheid === 'stuks') {
    const gram = naarEenheid(regel.geschaald, regel.eenheid, key, 'g')
    const gewicht = stukgewicht(key)
    if (gram !== null && gewicht) nodig = gram / gewicht
  }
  if (nodig === null) return null
  const deel = nodig / verpakking.inhoud
  return deel > MAX_AANDEEL ? null : deel
}

export function receptPrijs(
  regels: PrijsRegel[],
  personen: number,
  bron: PrijsBron,
  voorraad: ReadonlySet<string> = new Set(),
  kruidenThuis = false,
): ReceptPrijs {
  let totaal = 0
  let opPrijs = 0
  let geschat = 0
  let inHuis = 0

  for (const regel of regels) {
    const key = ingredientKey(regel.naam ?? '')
    if (!key || altijdInHuis(key) || /olie/.test(key)) continue
    if ((kruidenThuis && isDroogKruid(key)) || inVoorraad(key, voorraad)) {
      inHuis++
      continue
    }

    const item = { ingredient_key: key, naam: regel.naam }
    const prijs = bron.productVoor(item) ? bron.prijsVoor(item) : undefined
    const verpakking = bron.verpakkingVoor(item)
    const deel = prijs !== undefined && verpakking ? aandeel(regel, key, verpakking) : null
    if (prijs !== undefined && deel !== null) {
      totaal += prijs * deel
      opPrijs++
      continue
    }

    const schatting = schatIngredient({
      naam: regel.naam,
      hoeveelheid: regel.geschaald === null ? null : String(regel.geschaald),
      eenheid: regel.eenheid,
    })
    if (schatting !== null) {
      totaal += schatting
      geschat++
    }
  }

  const p = personen > 0 ? personen : 1
  return {
    totaal: Math.round(totaal * 100) / 100,
    perPersoon: Math.round((totaal / p) * 100) / 100,
    opPrijs, geschat, inHuis,
  }
}

/** Het recept van het scherm, met jouw winkel en jouw voorraadkast. */
export function useReceptPrijs(regels: PrijsRegel[] | null, personen: number): ReceptPrijs | null {
  const winkel = useWinkel()
  const voorraad = useVoorraad()
  return useMemo(() => {
    // Zonder prijzen en voorraad zou de eerste weergave te hoog of te laag zijn.
    if (!regels || !voorraad.data) return null
    const kruidenThuis = voorraad.data.some((v) => v.ingredient_key === DROGE_KRUIDEN_KEY && v.in_huis)
    const thuis = new Set(voorraad.data
      .filter((v) => v.in_huis && v.ingredient_key !== DROGE_KRUIDEN_KEY).map((v) => v.ingredient_key))
    return receptPrijs(regels, personen, winkel, thuis, kruidenThuis)
  }, [regels, personen, winkel, voorraad.data])
}
