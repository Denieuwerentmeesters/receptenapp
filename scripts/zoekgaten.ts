/**
 * Totaaloverzicht van ingrediënten die op de boodschappenlijst "zoek" krijgen:
 * geen AH-productnummer of geen Jumbo-SKU, dus een zoeklink in plaats van het
 * mandje.
 *
 *   export DATABASE_URL=...
 *   npm run zoekgaten                # alle recepten en de mapping uit de database
 *   npm run zoekgaten -- --offline   # data/recepten.json en data/*_mapping.json
 *
 * Schrijft zoekgaten.md in de root (staat in .gitignore) en print een samenvatting.
 *
 * We gebruiken de functies van de app zelf (zoekProduct, altijdInHuis,
 * tokoProduct, isDroogKruid), zodat "zoek" hier precies betekent wat de app
 * laat zien. Niet meegeteld: wat nooit op de lijst komt (zout, water, olie),
 * en tokoproducten (die krijgen een toko-link). Droge kruiden staan er wel
 * in, gemarkeerd: die blijven thuis als "Droge kruiden" in je voorraadkast
 * staat.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { zoekProduct } from '../app/src/lib/ah'
import { altijdInHuis } from '../app/src/lib/altijdInHuis'
import { isDroogKruid } from '../app/src/lib/kruiden'
import { ingredientKey } from '../app/src/lib/schaal'
import { canoniek } from '../app/src/lib/synoniemen'
import { tokoProduct } from '../app/src/lib/toko'

interface Recept { titel: string; ingredienten: { naam: string }[] }
type Mapping = Record<string, { product: string | number | null }>

interface Gat {
  key: string
  namen: Set<string>
  recepten: Set<string>
  ah: boolean
  jumbo: boolean
}

async function laad(offline: boolean): Promise<{ recepten: Recept[]; ah: Mapping; jumbo: Mapping }> {
  if (offline) {
    const lees = (pad: string) => JSON.parse(readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8'))
    const naarMapping = (rijen: { key: string; standaard: string | number | null }[]): Mapping =>
      Object.fromEntries(rijen.filter((r) => r.standaard).map((r) => [r.key, { product: r.standaard }]))
    return {
      recepten: (lees('data/recepten.json') as Recept[]).map((r) => ({ titel: r.titel, ingredienten: r.ingredienten })),
      ah: naarMapping(lees('data/ah_mapping.json')),
      jumbo: naarMapping(lees('data/jumbo_mapping.json')),
    }
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ontbreekt. Zet die, of draai met --offline.')
  const sql = neon(url)
  const [recepten, ah, jumbo] = await Promise.all([
    sql`select coalesce(titel_nl, titel) as titel, ingredienten from recepten`,
    sql`select ingredient_key, standaard_product_id as product from ah_product_cache where standaard_product_id is not null`,
    sql`select ingredient_key, standaard_sku as product from jumbo_product_cache where standaard_sku is not null`,
  ])
  const naarMapping = (rijen: Record<string, unknown>[]): Mapping =>
    Object.fromEntries(rijen.map((r) => [r.ingredient_key as string, { product: r.product as string | number }]))
  return { recepten: recepten as Recept[], ah: naarMapping(ah), jumbo: naarMapping(jumbo) }
}

async function main() {
  const offline = process.argv.includes('--offline')
  const { recepten, ah, jumbo } = await laad(offline)

  const gaten = new Map<string, Gat>()
  for (const recept of recepten) {
    for (const ing of recept.ingredienten ?? []) {
      const key = ingredientKey(ing.naam)
      if (!key || altijdInHuis(key)) continue
      const item = { ingredient_key: key, naam: ing.naam }
      if (tokoProduct(item)) continue
      const opAh = Boolean(zoekProduct(item, ah))
      const opJumbo = Boolean(zoekProduct(item, jumbo))
      if (opAh && opJumbo) continue

      const groep = canoniek(key)
      const gat = gaten.get(groep) ?? { key: groep, namen: new Set(), recepten: new Set(), ah: true, jumbo: true }
      gat.namen.add(ing.naam.trim())
      gat.recepten.add(recept.titel)
      gat.ah &&= opAh
      gat.jumbo &&= opJumbo
      gaten.set(groep, gat)
    }
  }

  const lijst = [...gaten.values()].sort((a, b) => b.recepten.size - a.recepten.size || a.key.localeCompare(b.key, 'nl'))
  const beide = lijst.filter((g) => !g.ah && !g.jumbo)
  const alleenAh = lijst.filter((g) => !g.ah && g.jumbo)
  const alleenJumbo = lijst.filter((g) => g.ah && !g.jumbo)

  const rij = (g: Gat) => {
    const namen = [...g.namen].slice(0, 3).join(' · ').replace(/\|/g, '/')
    return `| ${g.key}${isDroogKruid(g.key) ? ' *(kruid)*' : ''} | ${g.recepten.size} | ${namen} |`
  }
  const tabel = (titel: string, rijen: Gat[]) => [
    `## ${titel} (${rijen.length})`, '',
    '| Sleutel | Recepten | Zoals in het recept |', '|---|---:|---|',
    ...rijen.map(rij), '',
  ]

  const md = [
    '# Zoekgaten', '',
    `Bron: ${offline ? 'data/recepten.json en data/*_mapping.json (offline)' : 'de database'} · ` +
      `${recepten.length} recepten · ${new Date().toLocaleDateString('nl-NL')}`, '',
    'Ingrediënten die in de app een zoeklink krijgen in plaats van een product in het mandje. ' +
      'Gesorteerd op het aantal recepten waarin ze voorkomen. *(kruid)*: blijft thuis als ' +
      '"Droge kruiden" in de voorraadkast staat.', '',
    ...tabel('Bij AH én Jumbo zoek', beide),
    ...tabel('Alleen bij AH zoek', alleenAh),
    ...tabel('Alleen bij Jumbo zoek', alleenJumbo),
  ].join('\n')

  writeFileSync(new URL('../zoekgaten.md', import.meta.url), md)
  console.log(`${recepten.length} recepten. Zoek bij allebei: ${beide.length}, alleen AH: ${alleenAh.length}, alleen Jumbo: ${alleenJumbo.length}.`)
  console.log('Volledig overzicht: zoekgaten.md')
}

main().catch((fout) => { console.error(fout instanceof Error ? fout.message : fout); process.exit(1) })
