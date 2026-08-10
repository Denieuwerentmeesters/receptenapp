import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import { ingredientKey } from './schaal'
import type { AhProduct, BoodschapItem } from './database.types'

const ADD_MULTIPLE = 'https://www.ah.nl/mijnlijst/add-multiple'
const ZOEKEN = 'https://www.ah.nl/zoeken'

export interface MandjeResultaat {
  /** Items die als p=ID:AANTAL meegingen. */
  gemapt: BoodschapItem[]
  /** Items zonder productID — die krijgen een zoeklink als terugval. */
  ongemapt: BoodschapItem[]
  url: string
}

/**
 * Bouwt de add-multiple-link uit de openstaande boodschappen.
 *
 * Het mechanisme is live bevestigd (plan §4): elke `p=PRODUCTID:AANTAL` voegt
 * één regel toe aan je AH-lijst. De utm_*- en clickref-parameters uit de
 * originele waarneming zijn puur affiliate-tracking en laten we weg.
 */
/**
 * Zoekt het AH-product bij een boodschapregel.
 *
 * Twee redenen waarom de opgeslagen `ingredient_key` niet altijd volstaat:
 *
 *  1. Rijen die vóór een correctie aan ingredientKey zijn gemaakt dragen nog de
 *     oude sleutel ("sojasau" in plaats van "sojasaus"). Daarom rekenen we 'm
 *     hier opnieuw uit de naam — dan telt altijd de huidige regel.
 *
 *  2. Recepten schrijven bijzinnen mee: "zalmfilet, zonder huid",
 *     "kipfilet in blokjes". De basis staat wél in de mapping, de hele zin niet.
 *     Daarom vallen we terug op de langste mappingsleutel die als aaneengesloten
 *     reeks hele woorden in de regel voorkomt.
 *
 * Bewust op hele woorden en niet op letterreeksen: "amandelmelk" bevat "melk",
 * maar dat is een ander product. Zo'n gok legt stilletjes het verkeerde artikel
 * in je mandje, en dat merk je pas bij de kassa.
 */
export function zoekProduct(
  item: BoodschapItem,
  mapping: Record<string, AhProduct>,
): AhProduct | undefined {
  const direct = mapping[item.ingredient_key] ?? mapping[ingredientKey(item.naam)]
  if (direct) return direct

  const woorden = ingredientKey(item.naam).split(' ').filter(Boolean)
  if (woorden.length < 2) return undefined

  let beste: AhProduct | undefined
  let besteLengte = 0

  for (const [sleutel, product] of Object.entries(mapping)) {
    const deel = sleutel.split(' ')
    if (deel.length >= woorden.length || deel.length <= besteLengte) continue
    for (let i = 0; i + deel.length <= woorden.length; i++) {
      if (deel.every((w, n) => woorden[i + n] === w)) {
        beste = product
        besteLengte = deel.length
        break
      }
    }
  }
  return beste
}

export function bouwMandjeLink(
  items: BoodschapItem[],
  mapping: Record<string, AhProduct>,
  biologisch: boolean,
): MandjeResultaat {
  const gemapt: BoodschapItem[] = []
  const ongemapt: BoodschapItem[] = []
  const aantallen = new Map<number, number>()

  for (const item of items) {
    const product = zoekProduct(item, mapping)
    // Bio-voorkeur aan maar geen bio-variant? Terugvallen op standaard —
    // beter een niet-biologisch artikel op de lijst dan een ontbrekend (plan §4.3).
    const productId = biologisch
      ? product?.bio_product_id ?? product?.standaard_product_id
      : product?.standaard_product_id

    if (!productId) {
      ongemapt.push(item)
      continue
    }
    gemapt.push(item)
    aantallen.set(productId, (aantallen.get(productId) ?? 0) + 1)
  }

  const params = [...aantallen].map(([id, aantal]) => `p=${id}:${aantal}`).join('&')
  return { gemapt, ongemapt, url: `${ADD_MULTIPLE}?${params}` }
}

/** Terugval voor een ingrediënt zonder productID: gewoon de zoekpagina. */
export function zoekLink(naam: string): string {
  return `${ZOEKEN}?query=${encodeURIComponent(naam)}`
}

/**
 * Opent een ah.nl-URL in de systeembrowser — nooit in een in-app webview.
 *
 * Dit is de valkuil uit tech-stack §5: `@capacitor/browser` en een gewone
 * `<a href>` blijven in een omgeving met een eigen cookiejar. Ben je daar niet
 * ingelogd bij AH, dan landen je artikelen op een anonieme lijst en is je mandje
 * leeg als je de AH-app opent — zonder foutmelding. AppLauncher.openUrl geeft de
 * URL aan het besturingssysteem, dat 'm doorzet naar de AH-app (Universal Link)
 * of naar Safari, waar je normale AH-sessie zit.
 */
export async function openBijAh(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await AppLauncher.openUrl({ url })
    return
  }
  // In de browser tijdens ontwikkelen is een nieuw tabblad het equivalent.
  window.open(url, '_blank', 'noopener,noreferrer')
}
