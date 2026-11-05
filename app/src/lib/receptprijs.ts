import { useMemo } from 'react'
import { altijdInHuis } from './altijdInHuis'
import type { BoodschapItem } from './database.types'
import type { Verpakking } from './eenheden'
import { voegSamen, verpakkingenPerRegel, type LijstRegel } from './lijst'
import { DROGE_KRUIDEN_KEY, isDroogKruid } from './kruiden'
import { schatIngredient } from './prijsschatting'
import { useVoorraad } from './queries2'
import { ingredientKey } from './schaal'
import { inVoorraad } from './voorraad'
import { useWinkel } from './winkel'

/**
 * Wat een recept ongeveer kost per persoon aan de kassa: de hele verpakkingen
 * die je ervoor koopt, in de prijzen van jouw winkel (AH of Jumbo), met wat je
 * in de voorraadkast hebt eraf. Dezelfde som als de mandjeknop en Bespaard!
 * (verpakkingenPerRegel, een kwart speling), zonder bezorgkosten.
 *
 * Dus niet het aandeel dat het recept verbruikt: een pot miso van € 3,99
 * betaal je helemaal, ook als het recept er één eetlepel van vraagt. Dat is
 * ook waarom "heb je het al in huis?" ertoe doet: miso in de kast scheelt dat
 * hele bedrag. Voor een klein huishouden is het per persoon duurder, zoals
 * aan de kassa. Een restant gebruik je een andere avond, dus vergelijk
 * recepten met dit getal alleen als je gelijk kookt.
 *
 * Per ingrediënt: basisvoorraad (water, zout, olie) en wat in je voorraadkast
 * staat telt niet. Een product met prijs: aantal verpakkingen maal de prijs,
 * per product geteld (twee regels uit één pot vragen samen één pot). Zonder
 * prijs of product: de klassenschatting uit lib/prijsschatting.ts; `geschat`
 * telt die regels, zodat het scherm niet doet alsof het exact is.
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
  /** Wat het mandje voor dit recept kost, voor het gevraagde aantal personen, in euro's. */
  totaal: number
  perPersoon: number
  /** Regels met een echte prijs. */
  opPrijs: number
  /** Regels die op de klassenschatting rekenden. */
  geschat: number
  /** Regels die je al in huis hebt (voorraadkast) en dus niets kosten. */
  inHuis: number
}

export function receptPrijs(
  regels: PrijsRegel[],
  personen: number,
  bron: PrijsBron,
  voorraad: ReadonlySet<string> = new Set(),
  kruidenThuis = false,
): ReceptPrijs {
  // Dezelfde samenvoeging als de boodschappenlijst, zodat "ui" en "uien" één product zijn.
  const items: BoodschapItem[] = regels
    .filter((r) => {
      const key = ingredientKey(r.naam ?? '')
      return key && !altijdInHuis(key) && !/olie/.test(key)
    })
    .map((r, i) => ({
      id: String(i), user_id: '', week_start_datum: '', naam: r.naam, ingredient_key: ingredientKey(r.naam),
      hoeveelheid: r.geschaald, eenheid: r.eenheid, categorie: null, bron_type: 'recept' as const,
      bron_recept_id: null, is_afgevinkt: false, aangemaakt_op: '',
    }))
  const alle = voegSamen(items)
  const inHuisRegel = (r: LijstRegel) => (kruidenThuis && isDroogKruid(r.key)) || inVoorraad(r.key, voorraad)
  const kopen = alle.filter((r) => !inHuisRegel(r))

  const productVan = (r: LijstRegel) => bron.productVoor(r.voorbeeld)
  const aantallen = verpakkingenPerRegel(kopen, productVan, (r) => bron.verpakkingVoor(r.voorbeeld))

  let totaal = 0
  let opPrijs = 0
  let geschat = 0
  for (const regel of kopen) {
    const prijs = productVan(regel) ? bron.prijsVoor(regel.voorbeeld) : undefined
    if (prijs !== undefined) {
      totaal += prijs * (aantallen.get(regel.key)?.aantal ?? 1)
      opPrijs++
      continue
    }
    let schatting = 0
    for (const item of regel.items) {
      schatting += schatIngredient({
        naam: item.naam,
        hoeveelheid: item.hoeveelheid === null ? null : String(item.hoeveelheid),
        eenheid: item.eenheid,
      }) ?? 0
    }
    if (schatting > 0) {
      totaal += schatting
      geschat++
    }
  }

  const p = personen > 0 ? personen : 1
  return {
    totaal: Math.round(totaal * 100) / 100,
    perPersoon: Math.round((totaal / p) * 100) / 100,
    opPrijs, geschat, inHuis: alle.length - kopen.length,
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
