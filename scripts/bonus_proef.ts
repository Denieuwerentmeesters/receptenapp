/**
 * Proef voor onderdeel 5 van het plan "gemak en bonus": hoeveel recepten
 * zouden een bonuslabel krijgen als we de aanbiedingen van PrijsProfeet
 * koppelen aan onze AH- en Jumbo-mapping?
 *
 *   npm run bonus-proef                   # peildatum: eerste bezorgdag vanaf vandaag
 *   npm run bonus-proef -- --op 2026-10-03  # doen alsof het die dag is
 *
 * Haalt de lopende en komende acties op via /api/v1/products (mag volgens de
 * API-voorwaarden, art. 6), koppelt ze op productnummer (AH: wi-nummer uit de
 * product_url, Jumbo: SKU) aan data/ah_mapping.json en data/jumbo_mapping.json,
 * en telt welke recepten uit data/recepten.json daardoor een bonuslabel
 * krijgen. Geen database nodig.
 *
 * Een recept krijgt het label als zijn hoofdingrediënt in de bonus is: vlees
 * of vis, of anders het duurste ingrediënt volgens lib/prijsschatting.ts.
 *
 * Bron: PrijsProfeet (prijsprofeet.nl). Gratis zonder key, max. 30 verzoeken
 * per minuut op de lijst-endpoints; we wachten daarom 2,1 s per pagina.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { altijdInHuis } from '../app/src/lib/altijdInHuis'
import { isDroogKruid } from '../app/src/lib/kruiden'
import { schatIngredient } from '../app/src/lib/prijsschatting'
import { ingredientKey } from '../app/src/lib/schaal'
import { canoniek } from '../app/src/lib/synoniemen'
import { schapVoor } from '../app/src/lib/winkelindeling'
import type { Ingredient } from '../app/src/lib/database.types'

const API = 'https://www.prijsprofeet.nl/api/v1/products'
const UA = 'Receptenapp/0.1 (+https://receptenapp.vercel.app)'
const WINKELS = { ah: 'albert_heijn', jumbo: 'jumbo' } as const
type Winkel = keyof typeof WINKELS

interface Actie {
  name: string
  product_url: string
  price: number | null
  original_price: number | null
  promotion_type: string | null
  promotion_status: string
  valid_from: string
  valid_until: string
  unified_category: string
}

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms))
const datum = (d: Date) => d.toISOString().slice(0, 10)

/** Eerste mogelijke bezorgdag: morgen, en valt morgen op zondag, dan maandag. */
export function eersteBezorgdag(vandaag: Date): Date {
  const d = new Date(vandaag)
  d.setDate(d.getDate() + 1)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return d
}

async function haalActies(winkel: Winkel): Promise<Actie[]> {
  // Een uur bewaren: een tweede run hoeft PrijsProfeet niet opnieuw te belasten.
  const cache = join(tmpdir(), `bonus-proef-${winkel}.json`)
  if (existsSync(cache) && Date.now() - statSync(cache).mtimeMs < 3600_000) {
    return JSON.parse(readFileSync(cache, 'utf8')) as Actie[]
  }
  const uit: Actie[] = []
  for (let pagina = 1; ; pagina++) {
    const url = `${API}?retailer=${WINKELS[winkel]}&is_promotional=true&page_size=100&page=${pagina}`
    const antwoord = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!antwoord.ok) throw new Error(`${winkel} pagina ${pagina}: HTTP ${antwoord.status}`)
    const data = await antwoord.json() as { total: number; products: Actie[] }
    uit.push(...data.products)
    process.stdout.write(`\r${winkel}: ${uit.length} van ${data.total}`)
    if (uit.length >= data.total || data.products.length === 0) break
    await wacht(2100)
  }
  process.stdout.write('\n')
  writeFileSync(cache, JSON.stringify(uit))
  return uit
}

/** Productnaam zonder maat, aantal en verpakking: "AH Kipfilet 500 g" → "ah kipfilet". */
function zonderMaat(naam: string): string {
  return woorden(naam.replace(/\d+([.,]\d+)?\s*(x\s*\d+\s*)?(kg|g|gr|gram|ml|l|cl|liter|stuks?|st|pack|pak)\b/gi, ' ')
    .replace(/\bca\.?/gi, ' ')).filter((w) => !['stuk', 'stuks', 'pack', 'voordeelverpakking', 'grootverpakking', 'kleinverpakking'].includes(w)).join(' ')
}

function productNamen(winkel: Winkel): [string, { key: string; naam: string }][] {
  const rijen = JSON.parse(readFileSync(new URL(`../data/${winkel}_mapping.json`, import.meta.url), 'utf8')) as { key: string; naam: string }[]
  return rijen.filter((r) => r.naam).map((r) => [r.key, r])
}

const woorden = (t: string): string[] => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/'s\b/g, '').match(/[a-z]+/g) ?? []

/** AH: wi575084 uit de url; Jumbo: de SKU aan het eind (474843DSL). */
function productnummer(winkel: Winkel, url: string): string | null {
  const m = winkel === 'ah' ? url.match(/\/wi(\d+)/) : url.match(/-(\d+[A-Z]+)(?:[/?#]|$)/)
  return m ? m[1] : null
}

/** Productnummer → sleutels in onze mapping (standaard, bio en huismerk). */
function nummersNaarSleutels(pad: string): Map<string, string[]> {
  const uit = new Map<string, string[]>()
  const rijen = JSON.parse(readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8')) as Record<string, unknown>[]
  for (const r of rijen) {
    for (const veld of ['standaard', 'bio', 'huismerk']) {
      const nr = r[veld]
      if (nr === null || nr === undefined) continue
      const sleutels = uit.get(String(nr)) ?? []
      sleutels.push(r.key as string)
      uit.set(String(nr), sleutels)
    }
  }
  return uit
}

/** Het ingrediënt waar het recept om draait: vlees of vis, anders het duurste. */
function hoofdingredient(ingredienten: Ingredient[]): string | null {
  let beste: string | null = null
  let besteScore = -1
  for (const ing of ingredienten) {
    const key = canoniek(ingredientKey(ing.naam))
    if (!key || altijdInHuis(key) || isDroogKruid(key)) continue
    const schap = schapVoor(key)
    const score = (schap === 'Vlees' || schap === 'Vis' ? 1000 : 0) + (schatIngredient(ing) ?? 0)
    if (score > besteScore) { beste = key; besteScore = score }
  }
  return beste
}

async function main() {
  const opIndex = process.argv.indexOf('--op')
  const vandaag = opIndex > 0 ? new Date(`${process.argv[opIndex + 1]}T12:00:00`) : new Date()
  const peil = datum(eersteBezorgdag(vandaag))
  console.log(`Vandaag ${datum(vandaag)}, eerste bezorgdag (peildatum) ${peil}\n`)

  const recepten = JSON.parse(readFileSync(new URL('../data/recepten.json', import.meta.url), 'utf8')) as
    { titel: string; titel_nl: string | null; ingredienten: Ingredient[] }[]

  for (const winkel of Object.keys(WINKELS) as Winkel[]) {
    const acties = await haalActies(winkel)
    const mapping = nummersNaarSleutels(winkel === 'ah' ? 'data/ah_mapping.json' : 'data/jumbo_mapping.json')

    const geldig = acties.filter((a) => a.valid_from <= peil && peil <= a.valid_until)
    const komend = acties.filter((a) => a.valid_from > peil)
    const inBonus = new Map<string, Actie>()
    const opNaam = new Map<string, Actie>()
    let gekoppeld = 0
    for (const a of geldig) {
      const nr = productnummer(winkel, a.product_url)
      const sleutels = nr ? mapping.get(nr) : undefined
      if (!sleutels) continue
      gekoppeld++
      for (const s of sleutels) inBonus.set(canoniek(s), a)
    }

    // Stap 2, streng: hetzelfde product in een andere verpakking. De naam van de
    // actie moet, zonder maat en aantal, gelijk zijn aan de naam van ons product.
    const naamNaarSleutels = new Map<string, string[]>()
    for (const [, info] of productNamen(winkel)) {
      const n = zonderMaat(info.naam)
      naamNaarSleutels.set(n, [...(naamNaarSleutels.get(n) ?? []), info.key])
    }
    for (const a of geldig) {
      for (const k of naamNaarSleutels.get(zonderMaat(a.name)) ?? []) {
        if (!inBonus.has(canoniek(k))) opNaam.set(canoniek(k), a)
      }
    }
    const beide = new Map([...opNaam, ...inBonus])

    const metLabel: string[] = []
    const metLabelNaam: string[] = []
    for (const r of recepten) {
      const hoofd = hoofdingredient(r.ingredienten)
      if (hoofd && inBonus.has(hoofd)) metLabel.push(`${r.titel_nl ?? r.titel} (${hoofd})`)
      else if (hoofd && beide.has(hoofd)) metLabelNaam.push(`${r.titel_nl ?? r.titel} (${hoofd}: ${beide.get(hoofd)!.name})`)
    }

    console.log(`== ${winkel.toUpperCase()} ==`)
    console.log(`Acties opgehaald: ${acties.length} (geldig op ${peil}: ${geldig.length}, begint later: ${komend.length})`)
    console.log(`Gekoppeld op productnummer: ${gekoppeld} acties → ${inBonus.size} ingrediënten`)
    console.log(`Op naam gekoppeld (extra): ${opNaam.size} ingrediënten`)
    console.log(`Recepten met label, op productnummer: ${metLabel.length} van ${recepten.length}`)
    console.log(`Recepten met label, daarbovenop op naam: ${metLabelNaam.length}`)
    console.log('Op naam (ingrediënt ← actie):', [...opNaam].map(([k, a]) => `${k} ← ${a.name}`).join(' · '))
    console.log('Voorbeelden met label:', metLabel.slice(0, 8).join(' · '), '\n')
  }
  console.log('Bron: PrijsProfeet (prijsprofeet.nl)')
}

main().catch((fout) => { console.error(fout instanceof Error ? fout.message : fout); process.exit(1) })
