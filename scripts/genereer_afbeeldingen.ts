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
 * Batch (half zo duur, klaar binnen ~24 uur):
 *   npm run afbeeldingen -- --batch --limit 500           job starten voor wie nog geen beeld heeft
 *   npm run afbeeldingen -- --batch --alles --limit 500   idem, en gegenereerde beelden overdoen
 *   npm run afbeeldingen -- --batch-ophalen               status; als hij klaar is: verwerken
 * De lopende job staat in .afbeeldingen-batch.json (niet in git). Ophalen kan
 * veilig vaker: wat al verwerkt is, wordt overgeslagen.
 *
 * Zonder DATABASE_URL en met --dry-run leest het script data/recepten.json,
 * zodat je de prompts ook zonder database kunt bekijken.
 *
 * Kosten: één afbeelding per recept, geen varianten. Valt een beeld tegen, dan
 * doe je dat ene recept opnieuw met --id.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { bouwPrompt, type ReceptVoorPrompt } from '../lib/afbeeldingen/prompt'
import {
  beeldUitAntwoord,
  haalReceptenZonderAfbeelding,
  maakSql,
  slaBeeldOp,
  verwerkRecept,
  type ReceptRij,
  type Sql,
} from '../lib/afbeeldingen/genereer'
import { haalBatch, leesResultaten, startBatch } from '../lib/afbeeldingen/batch'

const BATCHBESTAND = new URL('../.afbeeldingen-batch.json', import.meta.url)

interface BatchStand {
  naam: string
  gestart: string
  /** recept-id → prompt, zodat de prompt bij het ophalen niet opnieuw bepaald hoeft te worden */
  prompts: Record<string, string>
  verwerkt: string[]
}

interface Opties {
  limiet: number
  dryRun: boolean
  telling: boolean
  ids: string[]
  opnieuw: boolean
  batch: boolean
  batchOphalen: boolean
  alles: boolean
  model?: string
}

function leesOpties(argv: string[]): Opties {
  const opties: Opties = {
    limiet: 10, dryRun: false, telling: false, ids: [], opnieuw: false, batch: false, batchOphalen: false, alles: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--limit') opties.limiet = Number(argv[++i])
    else if (a === '--dry-run') opties.dryRun = true
    else if (a === '--telling') opties.telling = true
    else if (a === '--id') opties.ids.push(argv[++i])
    else if (a === '--opnieuw') opties.opnieuw = true
    else if (a === '--model') opties.model = argv[++i]
    else if (a === '--batch') opties.batch = true
    else if (a === '--batch-ophalen') opties.batchOphalen = true
    else if (a === '--alles') opties.alles = true
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

async function startBatchRonde(recepten: ReceptRij[], opties: Opties): Promise<void> {
  if (existsSync(BATCHBESTAND)) {
    const stand = JSON.parse(readFileSync(BATCHBESTAND, 'utf8')) as BatchStand
    throw new Error(`Er loopt al een batch (${stand.naam}). Haal die eerst op met --batch-ophalen.`)
  }
  const teDoen = recepten.filter((r) => !r.afbeelding_bron || r.afbeelding_bron === 'gegenereerd')
  if (!teDoen.length) {
    console.log('Niets te doen.')
    return
  }
  const prompts = Object.fromEntries(teDoen.map((r) => [r.id, bouwPrompt(r).prompt]))
  const naam = await startBatch(
    Object.entries(prompts).map(([id, prompt]) => ({ sleutel: id, prompt })),
    `receptafbeeldingen-${new Date().toISOString().slice(0, 10)}`,
    opties.model,
  )
  const stand: BatchStand = { naam, gestart: new Date().toISOString(), prompts, verwerkt: [] }
  writeFileSync(BATCHBESTAND, JSON.stringify(stand, null, 2))
  console.log(`Batch gestart: ${naam}\n${teDoen.length} recepten. Ophalen met: npm run afbeeldingen -- --batch-ophalen`)
}

async function haalBatchRondeOp(sql: Sql): Promise<void> {
  if (!existsSync(BATCHBESTAND)) throw new Error('Geen lopende batch gevonden (.afbeeldingen-batch.json ontbreekt).')
  const stand = JSON.parse(readFileSync(BATCHBESTAND, 'utf8')) as BatchStand
  const info = await haalBatch(stand.naam)
  console.log(`Batch ${stand.naam}: ${info.status} (gestart ${stand.gestart})`)
  if (info.status === 'PENDING' || info.status === 'RUNNING') {
    console.log('Nog niet klaar; probeer het later nog eens.')
    return
  }
  if (info.status !== 'SUCCEEDED') {
    throw new Error(`De batch is niet gelukt (${info.status}). Verwijder .afbeeldingen-batch.json en start opnieuw.`)
  }
  if (!info.resultatenBestand) throw new Error('Batch is klaar maar Google noemt geen resultatenbestand.')

  const verwerkt = new Set(stand.verwerkt)
  let gelukt = 0
  let mislukt = 0
  for await (const regel of leesResultaten(info.resultatenBestand)) {
    const prompt = stand.prompts[regel.sleutel]
    if (!prompt || verwerkt.has(regel.sleutel)) continue
    try {
      if (regel.fout || !regel.antwoord) throw new Error(regel.fout ?? 'leeg antwoord')
      const url = await slaBeeldOp(sql, regel.sleutel, prompt, beeldUitAntwoord(regel.antwoord))
      verwerkt.add(regel.sleutel)
      gelukt++
      console.log(`klaar      ${regel.sleutel}  ${url}`)
    } catch (fout) {
      mislukt++
      console.error(`mislukt    ${regel.sleutel}: ${fout instanceof Error ? fout.message : fout}`)
    }
    // Tussentijds bewaren: breekt het af, dan gaat de volgende keer verder waar het was.
    if ((gelukt + mislukt) % 25 === 0) writeFileSync(BATCHBESTAND, JSON.stringify({ ...stand, verwerkt: [...verwerkt] }, null, 2))
  }
  writeFileSync(BATCHBESTAND, JSON.stringify({ ...stand, verwerkt: [...verwerkt] }, null, 2))

  const totaal = Object.keys(stand.prompts).length
  console.log(`\n${gelukt} verwerkt, ${mislukt} mislukt; in totaal ${verwerkt.size} van ${totaal} klaar.`)
  if (verwerkt.size === totaal) {
    unlinkSync(BATCHBESTAND)
    console.log('Batch helemaal verwerkt.')
  } else if (mislukt) {
    console.log('Mislukte recepten krijgen vannacht via de cron alsnog een beeld, of doe ze los met --id.')
  }
}

async function main(): Promise<void> {
  const opties = leesOpties(process.argv.slice(2))

  if (opties.batchOphalen) {
    await haalBatchRondeOp(maakSql())
    return
  }

  let sql: Sql | null = null
  let recepten: ReceptRij[]
  if (process.env.DATABASE_URL) {
    sql = maakSql()
    recepten = await haalReceptenZonderAfbeelding(sql, opties.limiet, opties.ids.length ? opties.ids : undefined, opties.alles)
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

  if (opties.batch) {
    await startBatchRonde(recepten, opties)
    return
  }

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
