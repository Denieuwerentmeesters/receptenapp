/**
 * Nachtelijke vertaalronde: nieuwe recepten krijgen een Engelse titel,
 * ingrediëntenlijst en bereiding (titel_en, ingredienten_en, bereiding_en).
 *
 * Vercel Cron roept dit elke nacht aan (zie vercel.json), net als de
 * afbeeldingen. Recepten zonder titel_en komen aan de beurt; een recept dat
 * mislukt (verkeerd aantal regels) blijft onvertaald en wordt morgen opnieuw
 * geprobeerd. Zo is de hele pool na een paar nachten Engels, en elk nieuw recept
 * de nacht erna.
 *
 * Per run hooguit 600 recepten, tien tegelijk, binnen de 300 seconden die de
 * functie krijgt (tijdslimiet 270 s). Wat dan nog niet af is komt de volgende
 * nacht aan de beurt, zodat de hele pool in een paar nachten Engels is.
 *
 * Omgevingsvariabelen op Vercel: DATABASE_URL, ANTHROPIC_API_KEY en
 * CRON_SECRET (zonder geldige secret doet de functie niets).
 */
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'
import { vertaalRecept, type NlRecept } from '../lib/vertalen/vertaal.js'

const MAX_PER_RUN = 600
const PARALLEL = 10
const TIJDSLIMIET_MS = 270_000

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ fout: 'Geen toegang.' }, { status: 401 })
  }
  const url = process.env.DATABASE_URL
  if (!url || !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ fout: 'DATABASE_URL of ANTHROPIC_API_KEY ontbreekt.' }, { status: 500 })
  }

  const start = Date.now()
  const sql = neon(url)
  const client = new Anthropic()
  const recepten = (await sql`
    select id, titel, titel_nl, ingredienten, bereiding_nl from recepten
    where titel_en is null order by aangemaakt_op limit ${MAX_PER_RUN}`) as unknown as NlRecept[]

  const gelukt: string[] = []
  const mislukt: { titel: string; fout: string }[] = []
  const wachtrij = [...recepten]
  const werker = async () => {
    for (let r = wachtrij.shift(); r; r = wachtrij.shift()) {
      if (Date.now() - start > TIJDSLIMIET_MS) return
      try {
        const en = await vertaalRecept(client, r)
        await sql`update recepten set titel_en = ${en.titel_en},
          ingredienten_en = ${JSON.stringify(en.ingredienten_en)}::jsonb,
          bereiding_en = ${en.bereiding_en} where id = ${r.id}`
        gelukt.push(en.titel_en)
      } catch (fout) {
        mislukt.push({ titel: r.titel_nl ?? r.titel, fout: fout instanceof Error ? fout.message : String(fout) })
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, werker))

  console.log(`vertalen: ${gelukt.length} gelukt, ${mislukt.length} mislukt, ${recepten.length} gevonden`)
  return Response.json({ gevonden: recepten.length, gelukt: gelukt.length, mislukt })
}
