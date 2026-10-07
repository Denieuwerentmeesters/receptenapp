import type { BronType, Ingredient, Recept } from './database.types'

/**
 * Recepten importeren van een link (website of Instagram) of van screenshots.
 *
 * Wat hier staat is puur: geen fetch, geen database. Het wordt door de app
 * gebruikt (welke knop, welke bronvermelding) én door api/extraheer.ts
 * (welke route een link neemt), zodat beide kanten dezelfde regels volgen.
 */

/** Waar het recept vandaan kwam, zoals de server (api/extraheer.ts) het vaststelde. */
export interface ConceptBron {
  soort: 'instagram' | 'website' | 'screenshot' | 'kookboek' | 'tekst'
  /** De genormaliseerde link (normaliseerUrl); null bij beelden en tekst. */
  url: string | null
  /** @account of de naam van de website. */
  maker: string | null
}

/** Een uitgelezen recept, nog niet opgeslagen: wat het controlescherm toont. */
export interface Concept {
  titel: string
  personen: number
  bereidingstijd_minuten?: number
  keuken?: string
  tags: string[]
  ingredienten: Ingredient[]
  bereiding_nl: string[]
  /** Ontbreekt bij een leeg concept (zelf invullen) en bij een samengesteld menu. */
  bron?: ConceptBron
}

/** Eén regel in het antwoord van api/extraheer.ts (lib/extractie.ts leest ze). */
export type ScanGebeurtenis =
  | { soort: 'stap'; tekst: string }
  | { soort: 'klaar'; concept: Concept; scanId: string | null }
  | { soort: 'fout'; fout: string }
  /** Deze link staat al bij je recepten. */
  | { soort: 'bestaat'; receptId: string }

/** Het bron_type van een opgeslagen recept dat uit deze bron kwam. */
export function bronTypeVoor(bron: ConceptBron['soort']): BronType {
  switch (bron) {
    case 'instagram': return 'instagram'
    case 'website': return 'website'
    case 'screenshot': return 'screenshot'
    case 'kookboek': return 'kookboek_foto'
    default: return 'eigen_input'
  }
}

/** De bron_types die uit een import komen; altijd privé (check-constraint import_altijd_prive). */
export const IMPORT_BRON_TYPES: readonly BronType[] = ['website', 'screenshot', 'instagram']

export function isImport(bronType: BronType): boolean {
  return IMPORT_BRON_TYPES.includes(bronType)
}

/** Een post, reel of IGTV op Instagram; profielen en stories tellen niet. */
export function isInstagramUrl(url: string): boolean {
  return instagramCode(url) !== null
}

/**
 * De code van de post uit een Instagram-link, of null als het geen post is.
 * Accepteert www., m., zonder subdomein en met of zonder slash erachter.
 */
export function instagramCode(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (!/^(www\.|m\.)?instagram\.com$/i.test(u.hostname)) return null
  // /p/<code>/, /reel/<code>/, /reels/<code>/, /tv/<code>/, en /<account>/p/<code>/
  const m = u.pathname.match(/\/(?:p|reels?|tv)\/([A-Za-z0-9_-]{5,})\/?/)
  return m ? m[1] : null
}

/**
 * Dezelfde link in één vaste vorm, zodat twee keer importeren niet twee
 * recepten geeft. Instagram: alleen de post, zonder account of parameters.
 * Website: zonder #fragment, zonder volgparameters (utm_*, fbclid, …) en
 * zonder slash aan het eind. Geeft null bij alles wat geen http(s)-link is.
 */
export function normaliseerUrl(invoer: string): string | null {
  const tekst = invoer.trim()
  // Een geplakte tekst met een link erin: pak de link.
  const gevonden = tekst.match(/https?:\/\/[^\s<>"')\]]+/i)?.[0] ?? (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(tekst) ? `https://${tekst}` : tekst)
  let u: URL
  try { u = new URL(gevonden) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  const code = instagramCode(u.href)
  if (code) return `https://www.instagram.com/p/${code}/`

  u.hash = ''
  for (const naam of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|igsh|ref|source|mc_cid|mc_eid)/i.test(naam)) u.searchParams.delete(naam)
  }
  u.hostname = u.hostname.toLowerCase()
  let href = u.href
  if (u.pathname.length > 1 && u.pathname.endsWith('/') && !u.search) href = href.replace(/\/$/, '')
  return href
}

/** Eenheden en woorden waaraan je een ingrediëntregel herkent, in het Nederlands en Engels. */
const EENHEID = /\b(g|gr|gram|kg|ml|l|dl|el|tl|eetlepels?|theelepels?|cups?|tbsp|tsp|oz|ounces?|lbs?|pounds?|stuks?|teen(tjes?)?|tenen|blik(jes?)?|bos(jes?)?|snufje|cloves?|cans?|bunch|handful|pinch|slices?|plak(jes?)?)\b/i

/**
 * Staat er een recept in deze tekst, met hoeveelheden erbij? Drie of meer
 * regels die beginnen met een getal (of een streepje en dan een getal), of
 * een getal met een eenheid erachter, is er een. Een tekst die alleen "link
 * in bio" zegt, of een gerecht aanprijst zonder ingrediënten, niet.
 */
export function lijktRecept(tekst: string): boolean {
  const regels = tekst.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
  let treffers = 0
  for (const regel of regels) {
    // Opsommingstekens en emoji vooraan tellen niet: "✅ 250 g pasta" is een ingrediëntregel.
    const kaal = regel.replace(/^[^\p{L}\p{N}½¼¾⅓⅔]+/u, '')
    const metGetal = /^(\d+([.,/]\d+)?|½|¼|¾|⅓|⅔)\s*/.test(kaal)
    if (metGetal || (/\d/.test(regel) && EENHEID.test(regel))) treffers++
    if (treffers >= 3) return true
  }
  return false
}

/**
 * De eerste link in een onderschrift die naar een gewone website wijst:
 * niet Instagram zelf en geen linkpagina (linktr.ee en soortgenoten), want
 * daar staat het recept niet op. Null als er geen is.
 */
export function websiteLinkIn(tekst: string): string | null {
  const links = tekst.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? []
  for (const link of links) {
    try {
      const host = new URL(link).hostname.toLowerCase()
      if (/(^|\.)(instagram\.com|facebook\.com|threads\.net|tiktok\.com|youtube\.com|youtu\.be)$/.test(host)) continue
      if (/(^|\.)(linktr\.ee|linkin\.bio|beacons\.ai|lnk\.bio|bio\.link|later\.com|taplink\.cc|campsite\.bio|snipfeed\.co)$/.test(host)) continue
      return link.replace(/[.,;:!?]+$/, '')
    } catch { /* geen geldige link */ }
  }
  return null
}

/** Een leesbare naam voor een website: zonder www., zonder pad. */
export function siteNaam(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

/**
 * De bronvermelding op het receptscherm: "Recept van @account" of "Recept
 * van uitpaulineskeuken.nl". Null voor alles wat geen import is.
 */
export function bronVermelding(recept: Pick<Recept, 'bron_type' | 'bron_maker' | 'url'>): { tekst: string; bekijk: string; url: string } | null {
  if (!isImport(recept.bron_type)) return null
  const maker = recept.bron_maker?.trim() || (recept.url ? siteNaam(recept.url) : null)
  const tekst = maker ? `Recept van ${maker}` : 'Geïmporteerd recept'
  if (!recept.url) return { tekst, bekijk: '', url: '' }
  const bekijk = recept.bron_type === 'instagram' ? 'Bekijk op Instagram' : `Bekijk op ${siteNaam(recept.url)}`
  return { tekst, bekijk, url: recept.url }
}
