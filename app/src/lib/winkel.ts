import { bouwMandjeLink, zoekLink, zoekProduct, type MandjeResultaat } from './ah'
import { bouwJumboLink, jumboZoekLink } from './jumbo'
import { useAhMapping, useJumboMapping, useVoorkeuren } from './queries'
import type { BoodschapItem } from './database.types'

/**
 * Eén ingang voor "de winkel waar je mandje heen gaat", zodat het
 * boodschappenscherm niet overal hoeft te vragen of het AH of Jumbo is.
 * De keuze staat in gebruiker_voorkeuren.voorkeurswinkel.
 */
export interface Winkel {
  id: 'ah' | 'jumbo'
  /** Voluit, voor lopende tekst: "Albert Heijn", "Jumbo". */
  naam: string
  /** Kort, voor knoppen: "AH-mandje", "Jumbo-mandje". */
  kort: string
  /** Heeft dit ingrediënt een productnummer bij deze winkel? Anders: zoeklink. */
  heeftProduct: (item: BoodschapItem) => boolean
  mandjeLink: (items: BoodschapItem[]) => MandjeResultaat
  zoekLink: (naam: string) => string
}

export function useWinkel(): Winkel {
  const voorkeuren = useVoorkeuren()
  const id = voorkeuren.data?.voorkeurswinkel ?? 'ah'
  const biologisch = voorkeuren.data?.biologisch_voorkeur ?? false

  const ah = useAhMapping(id === 'ah')
  const jumbo = useJumboMapping(id === 'jumbo')

  if (id === 'jumbo') {
    const mapping = jumbo.data ?? {}
    return {
      id,
      naam: 'Jumbo',
      kort: 'Jumbo',
      heeftProduct: (item) => Boolean(zoekProduct(item, mapping)),
      mandjeLink: (items) => bouwJumboLink(items, mapping, biologisch),
      zoekLink: jumboZoekLink,
    }
  }

  const mapping = ah.data ?? {}
  return {
    id,
    naam: 'Albert Heijn',
    kort: 'AH',
    heeftProduct: (item) => Boolean(zoekProduct(item, mapping)),
    mandjeLink: (items) => bouwMandjeLink(items, mapping, biologisch),
    zoekLink,
  }
}
