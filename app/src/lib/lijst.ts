import { enkelvoudVormen } from './ah'
import type { BoodschapItem } from './database.types'
import { isKruid } from './kruiden'
import { naarEenheid, type Verpakking } from './eenheden'
import { canoniek, droogKruid, lijstSleutel, TENEN } from './synoniemen'
import { LOOPROUTE, schapVoor, type Schap } from './winkelindeling'

/**
 * Eén regel op het scherm. In de database staat een rij per ingrediënt per
 * recept; hier voegen we ze samen op ingredient_key, zodat twee recepten met
 * tomaten één regel "tomaten" opleveren. Synoniemen gaan ook samen:
 * "knoflooktenen" en "knoflook" worden één regel knoflook.
 */
export interface LijstRegel {
  key: string
  naam: string
  /** De databaserijen achter deze regel — afvinken en verwijderen raakt ze allemaal. */
  items: BoodschapItem[]
  ids: string[]
  afgevinkt: boolean
  label: string
  /** Eén representatieve rij, voor de AH-koppeling (zoekProduct, bouwMandjeLink). */
  voorbeeld: BoodschapItem
}

export interface LijstGroep {
  schap: Schap
  regels: LijstRegel[]
}

export function voegSamen(items: BoodschapItem[]): LijstRegel[] {
  const perKey = new Map<string, BoodschapItem[]>()
  for (const item of items) {
    // Vers en gedroogd apart: gemalen koriander hoort niet bij het bosje.
    const key = lijstSleutel(item)
    const rij = perKey.get(key) ?? []
    rij.push(item)
    perKey.set(key, rij)
  }

  return [...perKey].map(([key, rij]) => {
    // Een rij die zelf zo heet geeft de naam. Anders: bij een synoniem de
    // gewone naam ("knoflook", niet "knoflooktenen"), en bij alleen een andere
    // vorm de naam uit het recept ("uien" blijft "uien"), zonder de bereiding.
    const eerste = rij[0]
    const naam = rij.find((i) => i.ingredient_key === key)?.naam
      ?? (canoniek(eerste.ingredient_key) !== eerste.ingredient_key || droogKruid(canoniek(eerste.ingredient_key), eerste.naam)
        ? key
        : eerste.naam.replace(/\([^)]*\)/g, ' ').split(',')[0].replace(/\s+/g, ' ').trim() || key)
    return {
      key,
      naam,
      items: rij,
      ids: rij.map((i) => i.id),
      // Pas afgevinkt als álles erachter afgevinkt is. Komt er een recept bij
      // met hetzelfde ingrediënt, dan staat de regel weer open.
      afgevinkt: rij.every((i) => i.is_afgevinkt),
      // Kruiden zonder hoeveelheid: "1 theelepel + 10 gram kurkuma" zegt niets
      // in de winkel. Het recept laat zien hoeveel erin gaat.
      label: isKruid(key) ? key : labelVan(rij, naam),
      voorbeeld: rij[0],
    }
  })
}

/**
 * Optellen kan alleen bij dezelfde eenheid. Verschillen ze ("200 g" en
 * "1 blik"), dan tonen we ze naast elkaar in plaats van er een te laten vallen.
 */
function labelVan(rij: BoodschapItem[], naam: string): string {
  const perEenheid = new Map<string, number | null>()
  for (const item of rij) {
    const eenheid = eenheidVan(item)
    const huidig = perEenheid.get(eenheid)
    if (item.hoeveelheid === null) {
      if (!perEenheid.has(eenheid)) perEenheid.set(eenheid, null)
      continue
    }
    perEenheid.set(eenheid, (huidig ?? 0) + item.hoeveelheid)
  }

  const delen = [...perEenheid]
    .filter(([, waarde]) => waarde !== null)
    .map(([eenheid, waarde]) => {
      const tekst = eenheid === 'tenen' && waarde === 1 ? 'teen' : eenheid
      return `${formatteer(waarde as number)} ${tekst}`.trim()
    })
  const kleineNaam = naam.toLowerCase()
  return delen.length > 0 ? `${delen.join(' + ')} ${kleineNaam}` : kleineNaam
}

/**
 * Teen, teentje en tenen tellen op tot één getal. Ook "3 knoflooktenen" zonder
 * eenheid zijn tenen, anders stond er "2 tenen + 3 knoflook".
 */
function eenheidVan(item: BoodschapItem): string {
  const eenheid = (item.eenheid ?? '').trim().toLowerCase()
  if (TENEN.has(eenheid)) return 'tenen'
  if (!eenheid && canoniek(item.ingredient_key) === 'knoflook' && item.ingredient_key !== 'knoflook') return 'tenen'
  return (item.eenheid ?? '').trim()
}

/**
 * Groente die per stuk verkocht wordt, bij AH én bij Jumbo. Alleen voor deze
 * producten sturen we het aantal uit het recept door: "4 paprika's" wordt
 * vier paprika's in je mandje. Voor de rest blijft het één verpakking — "4
 * uien" zijn één net, en "4 wortels" één zak.
 *
 * Bewust een vaste lijst en geen gok: een te hoog aantal legt stilletjes vier
 * netten citroenen in je mandje. Citroen en limoen verkoopt AH per stuk, Jumbo
 * per net of drietal; daarom die twee alleen bij AH.
 */
const PER_STUK = new Set([
  'paprika', 'rode paprika', 'gele paprika', 'groene paprika',
  'courgette', 'aubergine', 'komkommer', 'prei', 'avocado', 'mango',
  'bloemkool', 'knolselderij', 'venkel', 'venkelknol', 'chinese kool', 'sla',
])
const PER_STUK_AH = new Set(['citroen', 'limoen'])
const STUKS = new Set(['', 'st', 'stuk', 'stuks', 'krop', 'kroppen'])

function perStuk(key: string, winkel: 'ah' | 'jumbo'): boolean {
  const lijst = winkel === 'ah' ? [PER_STUK, PER_STUK_AH] : [PER_STUK]
  return [key, ...enkelvoudVormen(key)].some((vorm) => lijst.some((s) => s.has(vorm)))
}

/**
 * Eenheden die zelf een verpakking zijn: twee recepten met "1 blik tomaten"
 * zijn twee blikken, niet één.
 */
const VERPAKKING = /^(blik|blikje|blikjes|blikken|pak|pakje|pakjes|pakken|zak|zakje|zakjes|zakken|fles|flesje|flesjes|flessen|pot|potje|potjes|potten)\b/

/**
 * Hoeveel verpakkingen van deze regel in het mandje moeten. Opgeteld over alle
 * recepten erachter en naar boven afgerond: een halve paprika is er één.
 *
 * Vier gevallen, in deze volgorde:
 *  - staat het in het recept als verpakking (blik, pak, zak, fles, pot), dan
 *    tellen we die op;
 *  - kennen we de inhoud van de verpakking (`verpakking`, nu alleen bij
 *    Jumbo), dan: wat nodig is gedeeld door de inhoud, naar boven afgerond;
 *  - groente die per stuk verkocht wordt: het aantal stuks;
 *  - al het andere: één verpakking. Liever eens een ui te weinig dan twee
 *    netten te veel; de totale hoeveelheid staat op de lijst.
 */
export function aantalVerpakkingen(regel: LijstRegel, winkel: 'ah' | 'jumbo', verpakking?: Verpakking): number {
  const inVerpakking = regel.items.filter((i) => VERPAKKING.test((i.eenheid ?? '').trim().toLowerCase()))
  if (inVerpakking.length > 0) {
    const totaal = inVerpakking.reduce((som, i) => som + (i.hoeveelheid ?? 1), 0)
    return Math.max(1, Math.ceil(totaal - 0.01))
  }
  if (verpakking) {
    const nodig = nodigIn(regel, verpakking)
    if (nodig !== null) return verpakkingenVoor(nodig, verpakking)
  }
  if (!perStuk(regel.key, winkel)) return 1
  let stuks = 0
  for (const item of regel.items) {
    if (item.hoeveelheid === null || !STUKS.has((item.eenheid ?? '').trim().toLowerCase())) continue
    stuks += item.hoeveelheid
  }
  return Math.max(1, Math.ceil(stuks))
}

/** Nooit meer dan dit van één product: bij meer klopt er vast iets niet. */
const MAX_VERPAKKINGEN = 6

/**
 * Wat alle recepten samen vragen, in de eenheid van de verpakking. Null als
 * geen enkele regel om te rekenen is (alleen el, tl, "naar smaak").
 */
function nodigIn(regel: LijstRegel, verpakking: Verpakking): number | null {
  let totaal = 0
  let geteld = false
  for (const item of regel.items) {
    const waarde = naarEenheid(item.hoeveelheid, item.eenheid, regel.key, verpakking.eenheid)
    if (waarde === null) continue
    totaal += waarde
    geteld = true
  }
  return geteld ? totaal : null
}

/**
 * Tien procent speling: 550 g gehakt bij pakken van 500 g is één pak. Liever
 * een beetje krap dan een halve verpakking die overblijft.
 */
function verpakkingenVoor(nodig: number, verpakking: Verpakking): number {
  return Math.min(MAX_VERPAKKINGEN, Math.max(1, Math.ceil(nodig / verpakking.inhoud - 0.1)))
}

function formatteer(waarde: number): string {
  const afgerond = waarde >= 10 ? Math.round(waarde) : Math.round(waarde * 10) / 10
  return String(afgerond).replace('.', ',')
}

/**
 * Groepeert op schap, in de looproute door de winkel. Binnen een schap zakken
 * afgevinkte regels naar onderen, zodat je bovenaan ziet wat je nog moet halen.
 */
export function groepeerOpSchap(regels: LijstRegel[]): LijstGroep[] {
  const perSchap = new Map<Schap, LijstRegel[]>()
  for (const regel of regels) {
    const schap = schapVoor(regel.key)
    const rij = perSchap.get(schap) ?? []
    rij.push(regel)
    perSchap.set(schap, rij)
  }
  return LOOPROUTE
    .filter((schap) => perSchap.has(schap))
    .map((schap) => ({
      schap,
      regels: [...perSchap.get(schap)!].sort((a, b) =>
        Number(a.afgevinkt) - Number(b.afgevinkt) || a.naam.localeCompare(b.naam, 'nl')),
    }))
}
