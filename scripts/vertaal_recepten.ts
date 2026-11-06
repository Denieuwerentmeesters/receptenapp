/**
 * Vertaalt recepten naar het Engels (titel_en, ingredienten_en, bereiding_en).
 *
 *   export DATABASE_URL=...
 *   export ANTHROPIC_API_KEY=...
 *
 *   npm run vertaal -- --dry-run                  telt wat er nog te vertalen is
 *   npm run vertaal -- --limit 5                  steekproef: 5 recepten
 *   npm run vertaal -- --limit 1000               de hele pool
 *   npm run vertaal -- --id <uuid> --opnieuw      één recept overdoen
 *
 * Het script slaat recepten over die al een Engelse titel hebben. Valt het
 * antwoord van Claude af (verkeerd aantal regels), dan blijft dat recept
 * onvertaald en meldt het script dat; draai het gewoon nog eens.
 */
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'
import { vertaalRecept, type NlRecept } from '../lib/vertalen/vertaal'

const argv = process.argv.slice(2)
let limiet = 10
let dryRun = false
let opnieuw = false
const ids: string[] = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--limit') limiet = Number(argv[++i])
  else if (a === '--dry-run') dryRun = true
  else if (a === '--opnieuw') opnieuw = true
  else if (a === '--id') ids.push(argv[++i])
  else throw new Error(`Onbekende optie: ${a}`)
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL ontbreekt.')
const sql = neon(url)

const rijen = (ids.length > 0
  ? await sql`select id, titel, titel_nl, ingredienten, bereiding_nl from recepten where id = any(${ids}::uuid[])`
  : opnieuw
    ? await sql`select id, titel, titel_nl, ingredienten, bereiding_nl from recepten order by aangemaakt_op limit ${limiet}`
    : await sql`select id, titel, titel_nl, ingredienten, bereiding_nl from recepten
                where titel_en is null order by aangemaakt_op limit ${limiet}`) as unknown as NlRecept[]

console.log(`${rijen.length} recepten te vertalen`)
if (dryRun) process.exit(0)
if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY ontbreekt.')
const client = new Anthropic()

let klaar = 0
let mislukt = 0
const wachtrij = [...rijen]
async function werker() {
  for (let r = wachtrij.shift(); r; r = wachtrij.shift()) {
    try {
      const en = await vertaalRecept(client, r)
      await sql`update recepten set titel_en = ${en.titel_en},
        ingredienten_en = ${JSON.stringify(en.ingredienten_en)}::jsonb,
        bereiding_en = ${en.bereiding_en} where id = ${r.id}`
      klaar++
      console.log(`✓ ${en.titel_en}`)
    } catch (e) {
      mislukt++
      console.error(`✗ ${r.titel_nl ?? r.titel} (${r.id}): ${e instanceof Error ? e.message : e}`)
    }
  }
}
await Promise.all([werker(), werker(), werker(), werker()])
console.log(`Klaar: ${klaar} vertaald, ${mislukt} mislukt.`)
