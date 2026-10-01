import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import { WEBSITE } from './config'
import type { AhProduct, BoodschapItem } from './database.types'
import { zoekProduct } from './zoekProduct'

// Blijven hier ook te importeren; de regels zelf staan in lib/zoekProduct.ts.
export { enkelvoudVormen, zoekProduct } from './zoekProduct'

/**
 * Met een dubbele slash, en dat is geen slordigheid. AH claimt
 * `/mijnlijst/add-multiple` exact als Universal Link, dus iOS geeft die aan de
 * AH-app, die niets toevoegt. Een slash erachter hielp niet: ah.nl stuurt die
 * door naar het pad zonder slash, en bij een doorverwijzing kijkt iOS opnieuw
 * en opent alsnog de app. `//add-multiple` staat niet in AH's lijst én geeft
 * direct de pagina, zonder doorverwijzing — de producten komen gewoon in het
 * mandje (getest op 30-09-2026). Niet "opschonen".
 */
const ADD_MULTIPLE = 'https://www.ah.nl/mijnlijst//add-multiple'
const ZOEKEN = 'https://www.ah.nl/zoeken'

/** Een boodschapregel op weg naar het mandje, met hoeveel verpakkingen. */
export type MandjeItem = BoodschapItem & {
  /** Aantal verpakkingen; zonder opgave één (zie aantalVerpakkingen in lijst.ts). */
  aantal?: number
}

export interface MandjeResultaat {
  /** Items die als p=ID:AANTAL meegingen. */
  gemapt: BoodschapItem[]
  /** Items zonder productID — die krijgen een zoeklink als terugval. */
  ongemapt: BoodschapItem[]
  url: string
}

/** Welke variant je wilt als een product er meerdere heeft (Instellingen → Boodschappen). */
export interface Productvoorkeur {
  biologisch: boolean
  huismerk: boolean
}

/**
 * Kiest uit standaard, bio en huismerk. Bio gaat voor huismerk: wie beide
 * aanzet wil vooral biologisch, en de bio-variant is meestal zelf al huismerk.
 * Ontbreekt de gewenste variant, dan de standaard — beter een ander merk op
 * de lijst dan een ontbrekend artikel (plan §4.3).
 */
export function kiesVariant<T>(
  varianten: { standaard: T | null | undefined; bio: T | null | undefined; huismerk: T | null | undefined },
  voorkeur: Productvoorkeur,
): T | null {
  if (voorkeur.biologisch && varianten.bio) return varianten.bio
  if (voorkeur.huismerk && varianten.huismerk) return varianten.huismerk
  return varianten.standaard ?? null
}

/**
 * Bouwt de add-multiple-link uit de openstaande boodschappen.
 *
 * Het mechanisme is live bevestigd (plan §4): elke `p=PRODUCTID:AANTAL` voegt
 * één regel toe aan je AH-lijst. De utm_*- en clickref-parameters uit de
 * originele waarneming zijn puur affiliate-tracking en laten we weg.
 */



export function bouwMandjeLink(
  items: MandjeItem[],
  mapping: Record<string, AhProduct>,
  voorkeur: Productvoorkeur,
): MandjeResultaat {
  const gemapt: BoodschapItem[] = []
  const ongemapt: BoodschapItem[] = []
  const aantallen = new Map<number, number>()

  for (const item of items) {
    const product = zoekProduct(item, mapping)
    const productId = product && kiesVariant({
      standaard: product.standaard_product_id,
      bio: product.bio_product_id,
      huismerk: product.huismerk_product_id,
    }, voorkeur)

    if (!productId) {
      ongemapt.push(item)
      continue
    }
    gemapt.push(item)
    aantallen.set(productId, (aantallen.get(productId) ?? 0) + (item.aantal ?? 1))
  }

  const params = [...aantallen].map(([id, aantal]) => `p=${id}:${aantal}`).join('&')
  return { gemapt, ongemapt, url: `${ADD_MULTIPLE}?${params}` }
}

/** Terugval voor een ingrediënt zonder productID: gewoon de zoekpagina. */
export function zoekLink(naam: string): string {
  return `${ZOEKEN}?query=${encodeURIComponent(naam)}`
}

/** Een link die producten in je mandje zet (en niet alleen een zoekpagina). */
function isMandjeLink(url: string): boolean {
  return url.startsWith(`${ADD_MULTIPLE}?`) || url.startsWith('https://www.jumbo.com/mandje/')
}

/**
 * Opent een winkel-URL (ah.nl of jumbo.com) in de systeembrowser — nooit in
 * een in-app webview.
 *
 * Dit is de valkuil uit tech-stack §5: `@capacitor/browser` en een gewone
 * `<a href>` blijven in een omgeving met een eigen cookiejar. Ben je daar niet
 * ingelogd bij AH, dan landen je artikelen op een anonieme lijst en is je mandje
 * leeg als je de AH-app opent — zonder foutmelding.
 *
 * Mandjelinks mogen niet in de AH-app belanden: die gaat open maar voegt
 * niets toe, "add-multiple" werkt alleen op de website. Iedere link die via
 * iOS loopt, geeft iOS aan de app van de winkel (Universal Link). Dat geldt
 * voor de iOS-app en voor de app op het beginscherm; alleen een gewoon
 * Safari-tabblad opent een nieuw tabblad en blijft in Safari.
 *
 * Daarom openen app en beginscherm mandjelinks met `x-safari-https://`: dan
 * opent iOS altijd Safari, waar je bij AH ingelogd bent. Werkt dat niet
 * (ouder dan iOS 17), dan valt het terug op /doorsturen.html. Je AH-mandje
 * hoort bij je account, dus wat de website toevoegt staat daarna ook in de
 * AH-app.
 */
export async function openBijWinkel(url: string): Promise<void> {
  const native = Capacitor.isNativePlatform()
  if (!isMandjeLink(url)) {
    if (native) await AppLauncher.openUrl({ url })
    else window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  const viaSafari = `x-safari-${url}`
  const tussenstation = `${native ? WEBSITE : window.location.origin}/doorsturen.html?naar=${encodeURIComponent(url)}`

  if (native) {
    const gelukt = await AppLauncher.openUrl({ url: viaSafari })
      .then((r) => r.completed, () => false)
    if (!gelukt) await AppLauncher.openUrl({ url: tussenstation })
    return
  }

  if (!isBeginschermApp()) {
    window.open(tussenstation, '_blank', 'noopener,noreferrer')
    return
  }

  // Gaat Safari open, dan verdwijnt deze app naar de achtergrond. Blijft 'ie
  // in beeld, dan kende iOS x-safari-https niet: dan toch het tussenstation.
  let weg = false
  const opWeg = () => { if (document.visibilityState === 'hidden') weg = true }
  document.addEventListener('visibilitychange', opWeg)
  window.location.href = viaSafari
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', opWeg)
    if (!weg) window.open(tussenstation, '_blank', 'noopener,noreferrer')
  }, 1500)
}

/** Draait de website als app op het beginscherm (en niet in een Safari-tabblad)? */
function isBeginschermApp(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
}
