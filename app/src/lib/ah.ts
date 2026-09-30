import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import { ingredientKey } from './schaal'
import { canoniek } from './synoniemen'
import type { AhProduct, BoodschapItem } from './database.types'

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
export function zoekProduct<P>(
  item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>,
  mapping: Record<string, P>,
): P | undefined {
  // Eerst de synoniemen: "knoflookteentje" is gewoon knoflook, ook al staat
  // er een aparte sleutel voor een potje teentjes in de mapping.
  const direct = mapping[canoniek(item.ingredient_key)] ?? mapping[canoniek(ingredientKey(item.naam))]
    ?? mapping[item.ingredient_key] ?? mapping[ingredientKey(item.naam)]
  if (direct) return direct

  for (const vorm of enkelvoudVormen(ingredientKey(item.naam))) {
    if (mapping[vorm]) return mapping[vorm]
  }

  // Deel van de naam: "rijpe cherrytomaatjes" vindt cherrytomaten, ook via
  // de enkelvouds- en verkleinvormen van het laatste woord.
  const naam = ingredientKey(item.naam)
  let beste: P | undefined
  let besteLengte = 0
  for (const vorm of [naam, ...enkelvoudVormen(naam)]) {
    const woorden = vorm.split(' ').filter(Boolean)
    if (woorden.length < 2) continue
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
  }
  return beste
}

/**
 * Mogelijke enkelvouden van het laatste woord: "preien" → "prei",
 * "kipfilets" → "kipfilet", "tomaten" → "tomaat", "pitten" → "pit".
 *
 * Dit hoort bewust niet in ingredientKey: die sleutel moet op drie plekken
 * identiek blijven (SQL, app, script), en wat meervoud is valt zonder
 * woordenboek niet te zeggen ("kruiden", "linzen"). Hier is een verkeerde
 * kandidaat onschuldig: hij telt alleen als hij exact een mappingsleutel is.
 */
export function enkelvoudVormen(key: string): string[] {
  const woorden = key.split(' ')
  const laatste = woorden.pop() ?? ''
  const voor = woorden.length ? woorden.join(' ') + ' ' : ''
  const vormen: string[] = []

  if (laatste.length >= 4 && laatste.endsWith('s')) vormen.push(laatste.slice(0, -1))
  if (laatste.length >= 4 && laatste.endsWith('en')) {
    const stam = laatste.slice(0, -2)
    vormen.push(stam)
    // Verdubbelde medeklinker terug: pitten → pit, flessen → fles.
    if (/([^aeiou])\1$/.test(stam)) vormen.push(stam.slice(0, -1))
    // Open lettergreep weer sluiten: tomaten → tomaat, bonen → boon.
    const kort = stam.match(/^(.*[^aeiou])([aeou])([^aeiou])$/)
    if (kort) vormen.push(kort[1] + kort[2] + kort[2] + kort[3])
  }
  vormen.push(...zonderVerkleining(laatste))
  return vormen.map((v) => voor + v)
}

/**
 * Verkleinwoorden terug naar het gewone woord, plus de meervouden daarvan,
 * want de mapping gebruikt vaak het meervoud: cherrytomaatje → cherrytomaat,
 * cherrytomaten; worstje → worst; bolletje → bol; aardappeltje → aardappel.
 */
function zonderVerkleining(woord: string): string[] {
  const vormen: string[] = []
  // Elke uitgang proberen: tomaatje is tomaat + je, aardappeltje is aardappel + tje.
  for (const uitgang of ['etjes', 'etje', 'tjes', 'tje', 'pjes', 'pje', 'jes', 'je']) {
    if (!woord.endsWith(uitgang) || woord.length - uitgang.length < 3) continue
    let stam = woord.slice(0, -uitgang.length)
    // bolletje → bol, kommetje → kom
    if (uitgang.startsWith('e') && /([^aeiou])\1$/.test(stam)) stam = stam.slice(0, -1)
    vormen.push(stam, `${stam}s`, `${stam}en`)
    // tomaat → tomaten, boon → bonen
    const lang = stam.match(/^(.*[^aeiou])([aeou])\2([^aeiou])$/)
    if (lang) vormen.push(`${lang[1]}${lang[2]}${lang[3]}en`)
  }
  return vormen
}

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

/** Waar de website draait; de iOS-app heeft zelf geen https-adres. */
const WEBSITE = 'https://receptenapp.vercel.app'

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
