/**
 * Bonus en aanbiedingen van AH en Jumbo, via PrijsProfeet (plan "gemak en
 * bonus", onderdeel 5). Gedeeld door de nachtelijke ronde
 * (scripts/bonus_ophalen.ts) en de proef (scripts/bonus_proef.ts).
 *
 * Voorwaarden (prijsprofeet.nl/api-voorwaarden, versie 1.10):
 * - lopende en komende acties in hun geheel ophalen via /api/v1/products mag
 *   (art. 6); product voor product aflopen niet;
 * - een prijs niet langer dan 24 uur als actueel tonen (art. 7): daarom elke
 *   nacht verversen;
 * - zonder betaald plan: zichtbaar "PrijsProfeet" met een link naar
 *   prijsprofeet.nl op elk scherm met deze data (art. 6).
 *
 * Koppelen gaat op productnummer: in product_url staat bij AH het wi-nummer en
 * bij Jumbo de SKU, dezelfde nummers als in onze mapping. Daarnaast telt
 * hetzelfde product in een andere verpakking ("AH Kipfilet 1 kg" als wij 500 g
 * gekoppeld hebben). Losse woorden koppelen we niet: dat gaf in de proef vooral
 * fouten (zalm → zalm-ovenschotel).
 */

const API = 'https://www.prijsprofeet.nl/api/v1/products'
const UA = 'Receptenapp/0.1 (+https://receptenapp.vercel.app)'

export const WINKELS = { ah: 'albert_heijn', jumbo: 'jumbo' } as const
export type Winkel = keyof typeof WINKELS

export interface Actie {
  name: string
  product_url: string
  price: number | null
  original_price: number | null
  promotion_type: string | null
  promotional_keywords: string[] | null
  valid_from: string
  valid_until: string
}

/** Een rij uit onze mapping: sleutel, naam en de productnummers van alle varianten. */
export interface MappingRij {
  key: string
  naam: string | null
  nummers: (string | number | null | undefined)[]
}

export interface GekoppeldeActie {
  winkel: Winkel
  ingredientKey: string
  externId: string
  titel: string
  prijsNu: number | null
  prijsWas: number | null
  mechanisme: string | null
  geldigVan: string
  geldigTot: string
  productUrl: string
}

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Alle acties van één winkel, pagina voor pagina. Zonder key mag je 30
 * verzoeken per minuut op de lijst-endpoints doen, met een (gratis) key 150.
 */
export async function haalActies(winkel: Winkel, apiKey?: string, opVoortgang?: (n: number, totaal: number) => void): Promise<Actie[]> {
  const pauze = apiKey ? 450 : 2100
  const headers: Record<string, string> = { 'User-Agent': UA }
  if (apiKey) headers['X-API-Key'] = apiKey

  const uit: Actie[] = []
  for (let pagina = 1; ; pagina++) {
    const url = `${API}?retailer=${WINKELS[winkel]}&is_promotional=true&page_size=100&page=${pagina}`
    const antwoord = await fetch(url, { headers })
    if (!antwoord.ok) throw new Error(`PrijsProfeet ${winkel} pagina ${pagina}: HTTP ${antwoord.status}`)
    const data = await antwoord.json() as { total: number; products: Actie[] }
    uit.push(...data.products)
    opVoortgang?.(uit.length, data.total)
    if (uit.length >= data.total || data.products.length === 0) break
    await wacht(pauze)
  }
  return uit
}

/** AH: 575084 uit …/wi575084/…; Jumbo: de SKU aan het eind van de url (474843DSL). */
export function productnummer(winkel: Winkel, url: string): string | null {
  const m = winkel === 'ah' ? url.match(/\/wi(\d+)/) : url.match(/-(\d+[A-Z]+)(?:[/?#]|$)/)
  return m ? m[1] : null
}

const woorden = (t: string): string[] => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/'s\b/g, '').match(/[a-z]+/g) ?? []

const VERPAKKINGSWOORDEN = new Set(['stuk', 'stuks', 'pack', 'voordeelverpakking', 'grootverpakking', 'kleinverpakking'])

/** Productnaam zonder maat, aantal en verpakking: "AH Kipfilet 500 g" → "ah kipfilet". */
export function zonderMaat(naam: string): string {
  const kaal = naam
    .replace(/\d+([.,]\d+)?\s*(x\s*\d+\s*)?(kg|g|gr|gram|ml|l|cl|liter|stuks?|st|pack|pak)\b/gi, ' ')
    .replace(/\bca\.?/gi, ' ')
  return woorden(kaal).filter((w) => !VERPAKKINGSWOORDEN.has(w)).join(' ')
}

/** "5 + 1 gratis", "3 voor 4.99", "30% korting": de tekst die de winkel zelf gebruikt. */
export function mechanisme(actie: Actie): string | null {
  const woorden = (actie.promotional_keywords ?? []).filter((w) => !/bezorging/i.test(w))
  const tekst = woorden.find((w) => w !== w.toUpperCase()) ?? woorden[0]
  if (tekst) return tekst.replace(/\s+/g, ' ').trim().toLowerCase()
  if (actie.promotion_type === 'one_plus_one') return '1+1 gratis'
  return null
}

/**
 * Koppelt acties aan ingrediënten: eerst op productnummer, dan op hetzelfde
 * product in een andere verpakking. Eén rij per ingrediënt per actie.
 */
export function koppel(winkel: Winkel, acties: Actie[], mapping: MappingRij[]): GekoppeldeActie[] {
  const perNummer = new Map<string, string[]>()
  const perNaam = new Map<string, string[]>()
  for (const rij of mapping) {
    for (const nr of rij.nummers) {
      if (nr === null || nr === undefined || nr === '') continue
      perNummer.set(String(nr), [...(perNummer.get(String(nr)) ?? []), rij.key])
    }
    if (rij.naam) {
      const n = zonderMaat(rij.naam)
      if (n) perNaam.set(n, [...(perNaam.get(n) ?? []), rij.key])
    }
  }

  const uit: GekoppeldeActie[] = []
  const gezien = new Set<string>()
  for (const a of acties) {
    const nr = productnummer(winkel, a.product_url)
    if (!nr) continue
    const sleutels = perNummer.get(nr) ?? perNaam.get(zonderMaat(a.name)) ?? []
    for (const key of sleutels) {
      const id = `${key}|${nr}|${a.valid_from}`
      if (gezien.has(id)) continue
      gezien.add(id)
      uit.push({
        winkel, ingredientKey: key, externId: nr, titel: a.name,
        prijsNu: a.price, prijsWas: a.original_price, mechanisme: mechanisme(a),
        geldigVan: a.valid_from, geldigTot: a.valid_until, productUrl: a.product_url,
      })
    }
  }
  return uit
}
