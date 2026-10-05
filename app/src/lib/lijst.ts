import { enkelvoudVormen } from './ah'
import type { BoodschapItem } from './database.types'
import { isKruid } from './kruiden'
import { naarEenheid, stukgewicht, type Verpakking } from './eenheden'
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
 * netten citroenen in je mandje. Dit is de terugval voor een product waarvan
 * we de inhoud niet kennen; staat die in ah_verpakking of jumbo_verpakking,
 * dan rekenen we daarmee (een net citroenen van 500 g, een rode peper per stuk).
 */
const PER_STUK = new Set([
  'paprika', 'rode paprika', 'gele paprika', 'groene paprika',
  'courgette', 'aubergine', 'komkommer', 'prei', 'avocado', 'mango',
  'bloemkool', 'knolselderij', 'venkel', 'venkelknol', 'chinese kool', 'sla',
  'pompoen', 'flespompoen',
])
const STUKS = new Set(['', 'st', 'stuk', 'stuks', 'krop', 'kroppen'])

function perStuk(key: string): boolean {
  return [key, ...enkelvoudVormen(key)].some((vorm) => PER_STUK.has(vorm))
}

/**
 * Eenheden die zelf een verpakking zijn: twee recepten met "1 blik tomaten"
 * zijn twee blikken, niet één.
 */
const VERPAKKING = /^(blik|blikje|blikjes|blikken|pak|pakje|pakjes|pakken|zak|zakje|zakjes|zakken|fles|flesje|flesjes|flessen|pot|potje|potjes|potten)\b/

/**
 * Hoeveel er over de rand van een verpakking mag voordat er een bij komt: een
 * kwart. 500 g broccoli is één stronk van 400 g, 520 g zijn er twee. Liever
 * een beetje krap dan een halve verpakking die overblijft. Geldt voor alles,
 * ook voor stuks (twaalf eieren is één doos van tien).
 */
const SPELING = 0.25

/** Naar boven afgerond, met de speling eraf. Het kleine beetje vangt afrondfouten op: 500 / 400 is precies de grens. */
function afgerond(verpakkingen: number): number {
  return Math.ceil(verpakkingen - SPELING - 1e-9)
}

/**
 * Hoeveel verpakkingen in het mandje moeten. Opgeteld over alle recepten
 * erachter en naar boven afgerond: een halve paprika is er één. Geef je
 * meerdere regels mee, dan zijn dat regels die hetzelfde product krijgen
 * (bruine bonen en pintobonen uit dezelfde pot): die tellen als één.
 *
 * Vier gevallen, in deze volgorde:
 *  - staat het in het recept als verpakking (blik, pak, zak, fles, pot), dan
 *    tellen we die op;
 *  - kennen we de inhoud van de verpakking (`verpakking`), dan: wat nodig is
 *    gedeeld door de inhoud, afgerond met een kwart speling;
 *  - groente die per stuk verkocht wordt: het aantal stuks, of het gewicht
 *    gedeeld door wat één stuk weegt;
 *  - al het andere: één verpakking. Liever eens een ui te weinig dan twee
 *    netten te veel; de totale hoeveelheid staat op de lijst.
 */
export function aantalVerpakkingen(regel: LijstRegel | LijstRegel[], verpakking?: Verpakking): number {
  const regels = Array.isArray(regel) ? regel : [regel]
  const delen = regels.flatMap((r) => r.items.map((item) => ({ item, key: r.key })))

  const inVerpakking = delen.filter(({ item }) => VERPAKKING.test((item.eenheid ?? '').trim().toLowerCase()))
  if (inVerpakking.length > 0) {
    const totaal = inVerpakking.reduce((som, { item }) => som + (item.hoeveelheid ?? 1), 0)
    return Math.max(1, Math.ceil(totaal - 0.01))
  }
  if (verpakking) {
    const nodig = nodigIn(delen, verpakking)
    if (nodig !== null) return Math.min(MAX_VERPAKKINGEN, Math.max(1, afgerond(nodig / verpakking.inhoud)))
  }
  if (!regels.some((r) => perStuk(r.key))) return 1
  let stuks = 0
  // Vraagt het recept een gewicht ("2,5 kg pompoen"), dan rekenen we om met
  // wat één stuk ongeveer weegt. Zonder bekend gewicht telt het niet mee.
  let uitGewicht = 0
  for (const { item, key } of delen) {
    if (item.hoeveelheid === null) continue
    const gewicht = stukgewicht(key)
    if (STUKS.has((item.eenheid ?? '').trim().toLowerCase())) stuks += item.hoeveelheid
    else if (gewicht) uitGewicht += (naarEenheid(item.hoeveelheid, item.eenheid, key, 'g') ?? 0) / gewicht
  }
  // Dezelfde speling als bij verpakkingen: 1,05 pompoen is er één.
  return Math.min(MAX_STUKS, Math.max(1, Math.ceil(stuks) + Math.max(0, afgerond(uitGewicht))))
}

/** Per stuk mag het er meer zijn dan zes pakken: tien paprika's voor een groep kan. */
const MAX_STUKS = 12

/** Nooit meer dan dit van één product: bij meer klopt er vast iets niet. */
const MAX_VERPAKKINGEN = 6

/**
 * Wat alle recepten samen vragen, in de eenheid van de verpakking. Null als
 * geen enkele regel om te rekenen is (alleen el, tl, "naar smaak").
 */
function nodigIn(delen: { item: BoodschapItem; key: string }[], verpakking: Verpakking): number | null {
  let totaal = 0
  let geteld = false
  for (const { item, key } of delen) {
    if (PORTIE.test(item.naam.trim())) continue
    // eenheidVan: "3 knoflooktenen" zijn tenen, geen drie bollen.
    const waarde = naarEenheid(item.hoeveelheid, eenheidVan(item), key, verpakking.eenheid)
    if (waarde === null) continue
    totaal += waarde
    geteld = true
  }
  return geteld ? totaal : null
}

/**
 * Een portie in de naam ("3 stengels bleekselderij" zonder eenheid): dat zijn
 * geen drie struiken. Zo'n rij telt niet mee; dan blijft het één verpakking.
 */
const PORTIE = /^(?:takjes?|blaadjes|stengels?|handjes?|scheutje|snufje|plukje|plakjes?|sneetjes?|tenen|teen|teentjes?) /i

/** Wat er van één regel in het mandje gaat. */
export interface RegelAantal {
  /**
   * Wat deze regel aan de mandjelink bijdraagt. Delen regels een product, dan
   * draagt de eerste alles en de rest nul: de link telt per product op.
   */
  aantal: number
  /** Hoeveel verpakkingen van het product er in het mandje komen. */
  totaal: number
  /** Namen van de andere regels die uit dezelfde verpakking komen. */
  samenMet: string[]
}

/**
 * Het aantal verpakkingen per regel, geteld per product en niet per regel.
 * Twee regels met hetzelfde productnummer (200 g bruine bonen en 400 g
 * pintobonen, allebei de pot van 800 g) vragen samen één pot, niet elk één.
 * Een regel zonder productnummer telt op zichzelf.
 */
export function verpakkingenPerRegel(
  regels: LijstRegel[],
  productVan: (regel: LijstRegel) => string | null,
  verpakkingVan: (regel: LijstRegel) => Verpakking | undefined,
): Map<string, RegelAantal> {
  const perProduct = new Map<string, LijstRegel[]>()
  for (const regel of regels) {
    const product = productVan(regel) ?? `zonder:${regel.key}`
    perProduct.set(product, [...(perProduct.get(product) ?? []), regel])
  }
  const uit = new Map<string, RegelAantal>()
  for (const groep of perProduct.values()) {
    const totaal = aantalVerpakkingen(groep, verpakkingVan(groep[0]))
    groep.forEach((regel, i) => uit.set(regel.key, {
      aantal: i === 0 ? totaal : 0,
      totaal,
      samenMet: groep.filter((r) => r !== regel).map((r) => r.naam.toLowerCase()),
    }))
  }
  return uit
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
