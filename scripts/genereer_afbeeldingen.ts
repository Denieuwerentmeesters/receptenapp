/**
 * Genereert receptafbeeldingen voor recepten die er nog geen hebben.
 *
 *   npm install                      (in de root, één keer)
 *   export DATABASE_URL=...
 *   export GEMINI_API_KEY=...
 *   export BLOB_READ_WRITE_TOKEN=...
 *
 *   npm run afbeeldingen -- --dry-run --telling      verdeling over de hele pool, kost niets
 *   npm run afbeeldingen -- --dry-run --limit 10     de eerste 10 prompts bekijken
 *   npm run afbeeldingen -- --limit 10               steekproef: 10 afbeeldingen maken
 *   npm run afbeeldingen -- --limit 500              de hele pool
 *   npm run afbeeldingen -- --id <uuid> --opnieuw    één recept overdoen
 *   npm run afbeeldingen -- --model gemini-3.1-flash-image --limit 10   ander model proberen
 *
 * Zonder DATABASE_URL en met --dry-run leest het script data/recepten.json,
 * zodat je de prompts ook zonder database kunt bekijken.
 *
 * Kosten: één afbeelding per recept, geen varianten. Valt een beeld tegen, dan
 * doe je dat ene recept opnieuw met --id.
 */

import { readFileSync } from 'node:fs'
import { bouwPrompt, type ReceptVoorPrompt } from '../lib/afbeeldingen/prompt'
import { haalReceptenZonderAfbeelding, maakSql, verwerkRecept, type ReceptRij, type Sql } from '../lib/afbeeldingen/genereer'

interface Opties {
  limiet: number
  dryRun: boolean
  telling: boolean
  ids: string[]
  opnieuw: boolean
  model?: string
}

function leesOpties(argv: string[]): Opties {
  const opties: Opties = { limiet: 10, dryRun: false, telling: false, ids: [], opnieuw: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--limit') opties.limiet = Number(argv[++i])
    else if (a === '--dry-run') opties.dryRun = true
    else if (a === '--telling') opties.telling = true
    else if (a === '--id') opties.ids.push(argv[++i])
    else if (a === '--opnieuw') opties.opnieuw = true
    else if (a === '--model') opties.model = argv[++i]
    else throw new Error(`Onbekende optie: ${a}`)
  }
  if (opties.telling) opties.limiet = 10_000
  return opties
}

function uitArchief(): ReceptRij[] {
  const rijen = JSON.parse(readFileSync(new URL('../data/recepten.json', import.meta.url), 'utf8')) as (ReceptVoorPrompt & { url?: string })[]
  return rijen.map((r, i) => ({ ...r, id: r.url ?? `archief-${i}`, afbeelding_url: null, afbeelding_bron: null }))
}

function toonTelling(recepten: ReceptRij[]): void {
  const tel = (sleutel: (r: ReceptRij) => string) => {
    const teller = new Map<string, number>()
    for (const r of recepten) {
      const k = sleutel(r)
      teller.set(k, (teller.get(k) ?? 0) + 1)
    }
    return [...teller.entries()].sort((a, b) => b[1] - a[1])
  }
  const kort = (s: string) => s.split(' ').slice(0, 6).join(' ')

  const keuzes = recepten.map((r) => ({ r, k: bouwPrompt(r).keuzes }))
  console.log(`\n${recepten.length} recepten\n`)
  console.log('Hoek')
  for (const [k, n] of tel((r) => kort(keuzes.find((x) => x.r === r)!.k.hoek))) console.log(`  ${String(n).padStart(4)}  ${k}`)
  console.log('\nOndergrond')
  for (const [k, n] of tel((r) => keuzes.find((x) => x.r === r)!.k.ondergrond)) console.log(`  ${String(n).padStart(4)}  ${k}`)
  console.log('\nVaatwerk')
  for (const [k, n] of tel((r) => keuzes.find((x) => x.r === r)!.k.vaatwerk)) console.log(`  ${String(n).padStart(4)}  ${k}`)
  console.log('\nCompositie')
  for (const [k, n] of tel((r) => kort(keuzes.find((x) => x.r === r)!.k.compositie))) console.log(`  ${String(n).padStart(4)}  ${k}`)
  const leeg = keuzes.filter((x) => x.k.rekwisieten.length === 0).length
  console.log(`\nZonder rekwisieten: ${leeg} van ${recepten.length} (${Math.round((100 * leeg) / recepten.length)}%)`)
}

async function main(): Promise<void> {
  const opties = leesOpties(process.argv.slice(2))

  let sql: Sql | null = null
  let recepten: ReceptRij[]
  if (process.env.DATABASE_URL) {
    sql = maakSql()
    recepten = await haalReceptenZonderAfbeelding(sql, opties.limiet, opties.ids.length ? opties.ids : undefined)
  } else if (opties.dryRun) {
    console.log('Geen DATABASE_URL; ik lees data/recepten.json.')
    recepten = uitArchief().slice(0, opties.limiet)
  } else {
    throw new Error('DATABASE_URL ontbreekt. Gebruik --dry-run om zonder database de prompts te bekijken.')
  }

  if (opties.telling) {
    toonTelling(recepten)
    return
  }

  if (opties.dryRun) {
    for (const r of recepten) {
      console.log(`\n### ${r.titel_nl ?? r.titel}  (${r.id})\n${bouwPrompt(r).prompt}`)
    }
    console.log(`\n${recepten.length} prompts, niets gegenereerd.`)
    return
  }

  if (!sql) throw new Error('Geen databaseverbinding.')

  let gelukt = 0
  let mislukt = 0
  for (const r of recepten) {
    if (r.afbeelding_url && !opties.opnieuw) {
      console.log(`overslaan  ${r.titel_nl ?? r.titel}  (heeft al een afbeelding; gebruik --opnieuw)`)
      continue
    }
    if (r.afbeelding_bron && r.afbeelding_bron !== 'gegenereerd') {
      console.log(`overslaan  ${r.titel_nl ?? r.titel}  (eigen foto, blijft staan)`)
      continue
    }
    try {
      const uitkomst = await verwerkRecept(sql, r, opties.model)
      gelukt++
      console.log(`klaar      ${uitkomst.titel}\n           ${uitkomst.url}`)
    } catch (fout) {
      mislukt++
      console.error(`mislukt    ${r.titel_nl ?? r.titel}: ${fout instanceof Error ? fout.message : fout}`)
    }
  }
  console.log(`\n${gelukt} gelukt, ${mislukt} mislukt.`)
}

main().catch((fout) => {
  console.error(fout instanceof Error ? fout.message : fout)
  process.exit(1)
})
