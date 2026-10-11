/**
 * Overzicht van álle ingrediënten in de recepten, met wat de app ermee doet:
 * welke sleutel ze krijgen, met welke regel ze op de lijst samenvallen, en
 * welk AH- en Jumbo-product `zoekProduct` ervoor vindt (of niet).
 *
 *   npm run ingredienten                 # recepten en mapping uit de database
 *   npm run ingredienten -- --offline    # data/recepten.json en data/*_mapping.json
 *
 * Schrijft ingredienten_overzicht.json in de root (staat in .gitignore).
 * Daarna maakt `python3 scripts/ingredienten_excel.py` er een Excel van met
 * voorstellen om namen samen te voegen; zie dat script.
 *
 * We gebruiken de functies van de app zelf, zodat "zoek" hier precies
 * betekent wat de app op de lijst laat zien.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { altijdInHuis } from '../app/src/lib/altijdInHuis'
import { isBijzonderKruid, isDroogKruid } from '../app/src/lib/kruiden'
import { ingredientKey } from '../app/src/lib/schaal'
import { canoniek, droogKruid, lijstSleutel } from '../app/src/lib/synoniemen'
import { tokoProduct } from '../app/src/lib/toko'
import { vegaVervanger } from '../app/src/lib/vega'
import { schapVoor } from '../app/src/lib/winkelindeling'
import { zoekProduct } from '../app/src/lib/zoekProduct'

interface Recept { titel: string; ingredienten: { naam: string; hoeveelheid?: string | null; eenheid?: string | null }[] }

/** Eén mapping-regel, met de sleutel erbij zodat we zien wélke regel matchte. */
interface Regel {
  key: string
  product: string | number
  naam: string | null
  bio: string | number | null
  /** Zoals in de database: zoekProduct kijkt hierin naar "plak". */
  weergavenaam: string | null
}
type Mapping = Record<string, Regel>

interface Product { product_id: number; titel: string; inhoud_tekst: string | null; prijs: number | null; leverbaar: boolean }

async function laad(offline: boolean): Promise<{ recepten: Recept[]; ah: Mapping; jumbo: Mapping; producten: Record<string, Product> }> {
  const lees = (pad: string) => JSON.parse(readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8'))
  const producten: Record<string, Product> = Object.fromEntries(
    (lees('data/ah_producten.json') as Product[]).map((p) => [String(p.product_id), p]),
  )
  if (offline) {
    const naarMapping = (rijen: { key: string; naam: string | null; standaard: string | number | null; bio: string | number | null }[]): Mapping =>
      Object.fromEntries(rijen.filter((r) => r.standaard).map((r) => [r.key, {
        key: r.key, product: r.standaard as string | number, naam: r.naam, bio: r.bio ?? null, weergavenaam: r.naam,
      }]))
    return {
      recepten: (lees('data/recepten.json') as Recept[]).map((r) => ({ titel: r.titel, ingredienten: r.ingredienten })),
      ah: naarMapping(lees('data/ah_mapping.json')),
      jumbo: naarMapping(lees('data/jumbo_mapping.json')),
      producten,
    }
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ontbreekt. Zet die, of draai met --offline.')
  const sql = neon(url)
  const [recepten, ah, jumbo] = await Promise.all([
    sql`select coalesce(titel_nl, titel) as titel, ingredienten from recepten`,
    sql`select ingredient_key as key, standaard_product_id as product, weergavenaam, bio_product_id as bio
        from ah_product_cache where standaard_product_id is not null`,
    sql`select ingredient_key as key, standaard_sku as product, weergavenaam, bio_sku as bio
        from jumbo_product_cache where standaard_sku is not null`,
  ])
  const naarMapping = (rijen: Record<string, unknown>[]): Mapping =>
    Object.fromEntries(rijen.map((r) => [r.key as string, {
      key: r.key as string, product: r.product as string | number, naam: (r.weergavenaam as string | null) ?? null,
      bio: (r.bio as string | number | null) ?? null, weergavenaam: (r.weergavenaam as string | null) ?? null,
    }]))
  return { recepten: recepten as Recept[], ah: naarMapping(ah), jumbo: naarMapping(jumbo), producten }
}

/** Wat de app met een regel doet vóór het zoeken: komt hij überhaupt op de lijst, en waar? */
type Soort = 'gewoon' | 'altijd in huis' | 'toko' | 'droog kruid' | 'bijzonder kruid'

interface Rij {
  naam: string
  aantal_regels: number
  aantal_recepten: number
  recepten: string[]
  voorbeeld_hoeveelheid: string | null
  ingredient_key: string
  lijst_sleutel: string
  schap: string
  soort: Soort
  keuze: boolean
  /** Gaat standaard vega naar het mandje (gehakt, rookworst, spekjes): de variant en of die een product heeft. */
  vega_variant: string | null
  vega_ah_product: string | number | null
  ah_sleutel: string | null
  ah_product: string | number | null
  ah_naam: string | null
  ah_leverbaar: boolean | null
  ah_bio: boolean
  jumbo_sleutel: string | null
  jumbo_product: string | number | null
  jumbo_naam: string | null
}

async function main() {
  const offline = process.argv.includes('--offline')
  const { recepten, ah, jumbo, producten } = await laad(offline)

  // Eén rij per naam zoals het recept 'm schrijft (zonder hoofdletters en witruimte).
  const rijen = new Map<string, Rij & { spellingen: Map<string, number>; receptSet: Set<string> }>()
  for (const recept of recepten) {
    for (const ing of recept.ingredienten ?? []) {
      const ruw = (ing.naam ?? '').trim()
      if (!ruw) continue
      const sleutel = ruw.toLowerCase().replace(/\s+/g, ' ')
      let rij = rijen.get(sleutel)
      if (!rij) {
        const key = ingredientKey(ruw)
        const item = { ingredient_key: key, naam: ruw }
        const canon = canoniek(key)
        const soort: Soort = altijdInHuis(key) ? 'altijd in huis'
          : tokoProduct(item) ? 'toko'
          : isBijzonderKruid(canon) ? 'bijzonder kruid'
          : isDroogKruid(canon) || droogKruid(canon, ruw) ? 'droog kruid'
          : 'gewoon'
        const opAh = zoekProduct(item, ah)
        const opJumbo = zoekProduct(item, jumbo)
        const product = opAh ? producten[String(opAh.product)] : undefined
        const vega = vegaVervanger(canon)
        const vegaProduct = vega ? zoekProduct({ ingredient_key: vega.key, naam: vega.naam }, ah) : undefined
        rij = {
          naam: ruw,
          aantal_regels: 0,
          aantal_recepten: 0,
          recepten: [],
          voorbeeld_hoeveelheid: [ing.hoeveelheid, ing.eenheid].filter(Boolean).join(' ') || null,
          ingredient_key: key,
          lijst_sleutel: lijstSleutel(item),
          schap: schapVoor(canon),
          soort,
          keuze: /\bof\b/i.test(ruw),
          vega_variant: vega?.naam ?? null,
          vega_ah_product: vegaProduct?.product ?? null,
          ah_sleutel: opAh?.key ?? null,
          ah_product: opAh?.product ?? null,
          ah_naam: product?.titel ?? opAh?.naam ?? null,
          ah_leverbaar: opAh ? (product ? product.leverbaar : null) : null,
          ah_bio: Boolean(opAh?.bio),
          jumbo_sleutel: opJumbo?.key ?? null,
          jumbo_product: opJumbo?.product ?? null,
          jumbo_naam: opJumbo?.naam ?? null,
          spellingen: new Map(),
          receptSet: new Set(),
        }
        rijen.set(sleutel, rij)
      }
      rij.aantal_regels++
      rij.spellingen.set(ruw, (rij.spellingen.get(ruw) ?? 0) + 1)
      rij.receptSet.add(recept.titel)
    }
  }

  // Hoe vaak elke mapping-regel geraakt wordt: zo zie je ook wat nooit gebruikt wordt.
  const gebruik: Record<string, { regels: number; namen: string[] }> = {}
  for (const rij of rijen.values()) {
    if (!rij.ah_sleutel) continue
    const g = gebruik[rij.ah_sleutel] ?? (gebruik[rij.ah_sleutel] = { regels: 0, namen: [] })
    g.regels += rij.aantal_regels
    g.namen.push(rij.naam)
  }

  const uit = [...rijen.values()]
    .map(({ spellingen, receptSet, ...rij }) => ({
      ...rij,
      // De meest gebruikte spelling als naam.
      naam: [...spellingen.entries()].sort((a, b) => b[1] - a[1])[0][0],
      aantal_recepten: receptSet.size,
      recepten: [...receptSet].slice(0, 5),
    }))
    .sort((a, b) => b.aantal_recepten - a.aantal_recepten || a.naam.localeCompare(b.naam, 'nl'))

  const mapping = Object.values(ah).map((r) => {
    const p = producten[String(r.product)]
    return {
      key: r.key, product: r.product, naam: p?.titel ?? r.naam, inhoud: p?.inhoud_tekst ?? null,
      prijs: p?.prijs ?? null, leverbaar: p ? p.leverbaar : null, bio: r.bio,
      jumbo: jumbo[r.key]?.product ?? null, jumbo_naam: jumbo[r.key]?.naam ?? null,
      gebruik_regels: gebruik[r.key]?.regels ?? 0, gebruik_namen: gebruik[r.key]?.namen ?? [],
    }
  }).sort((a, b) => a.key.localeCompare(b.key, 'nl'))

  const resultaat = {
    bron: offline ? 'data/recepten.json en data/*_mapping.json (offline)' : 'de database',
    datum: new Date().toISOString().slice(0, 10),
    aantal_recepten: recepten.length,
    ingredienten: uit,
    mapping,
  }
  writeFileSync(new URL('../ingredienten_overzicht.json', import.meta.url), JSON.stringify(resultaat, null, 1))

  const gewoon = uit.filter((r) => r.soort === 'gewoon')
  const zoek = gewoon.filter((r) => !r.ah_product)
  console.log(`${recepten.length} recepten, ${uit.length} verschillende ingrediëntnamen.`)
  console.log(`Komt op de lijst en hoort in het mandje: ${gewoon.length}; daarvan zonder AH-product: ${zoek.length} ` +
    `(${zoek.reduce((n, r) => n + r.aantal_regels, 0)} receptregels).`)
  console.log('Geschreven: ingredienten_overzicht.json')
}

main().catch((fout) => { console.error(fout instanceof Error ? fout.message : fout); process.exit(1) })
