import { bouwMandjeLink, kiesVariant, zoekLink, zoekProduct, type MandjeItem, type MandjeResultaat, type Productvoorkeur } from './ah'
import { bouwJumboLink, jumboSku, jumboZoekLink } from './jumbo'
import { useJumboVerpakkingen } from './queries2'
import type { Verpakking } from './eenheden'
import { useAhMapping, useJumboMapping, useVoorkeuren } from './queries'
import type { BoodschapItem, Voorkeuren } from './database.types'

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
  mandjeLink: (items: MandjeItem[]) => MandjeResultaat
  /** Het productnummer dat voor dit item in het mandje gaat (AH-id of Jumbo-SKU), of null. */
  productVoor: (item: BoodschapItem) => string | null
  /** Inhoud van het product dat voor dit item in het mandje gaat, als we die kennen (nu alleen Jumbo). */
  verpakkingVoor: (item: BoodschapItem) => Verpakking | undefined
  zoekLink: (naam: string) => string
}

export function useWinkel(): Winkel {
  const voorkeuren = useVoorkeuren()
  const id = voorkeuren.data?.voorkeurswinkel ?? 'ah'
  const voorkeur = productvoorkeur(voorkeuren.data)

  const ah = useAhMapping(id === 'ah')
  const jumbo = useJumboMapping(id === 'jumbo')
  const verpakkingen = useJumboVerpakkingen(id === 'jumbo')

  if (id === 'jumbo') {
    const mapping = jumbo.data ?? {}
    return {
      id,
      naam: 'Jumbo',
      kort: 'Jumbo',
      heeftProduct: (item) => Boolean(zoekProduct(item, mapping)),
      mandjeLink: (items) => bouwJumboLink(items, mapping, voorkeur),
      productVoor: (item) => {
        const product = zoekProduct(item, mapping)
        return product ? jumboSku(product, voorkeur) : null
      },
      verpakkingVoor: (item) => {
        const product = zoekProduct(item, mapping)
        const sku = product && jumboSku(product, voorkeur)
        return sku ? verpakkingen.data?.[sku] : undefined
      },
      zoekLink: jumboZoekLink,
    }
  }

  const mapping = ah.data ?? {}
  return {
    id,
    naam: 'Albert Heijn',
    kort: 'AH',
    heeftProduct: (item) => Boolean(zoekProduct(item, mapping)),
    mandjeLink: (items) => bouwMandjeLink(items, mapping, voorkeur),
    productVoor: (item) => {
      const product = zoekProduct(item, mapping)
      const id = product && kiesVariant({
        standaard: product.standaard_product_id, bio: product.bio_product_id, huismerk: product.huismerk_product_id,
      }, voorkeur)
      return id ? String(id) : null
    },
    verpakkingVoor: () => undefined,
    zoekLink,
  }
}

/** Bio en huismerk uit de voorkeuren; zolang die laden, gewoon de standaard. */
export function productvoorkeur(v: Voorkeuren | undefined): Productvoorkeur {
  return { biologisch: v?.biologisch_voorkeur ?? false, huismerk: v?.huismerk_voorkeur ?? false }
}
