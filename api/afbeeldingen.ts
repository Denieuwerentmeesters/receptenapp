/**
 * Nachtelijke opruimronde voor receptafbeeldingen (plan §6).
 *
 * Vercel Cron roept dit elke nacht aan (zie vercel.json). De functie zoekt
 * recepten zonder afbeelding, meestal wat er die dag via het conceptscherm is
 * toegevoegd, en genereert er een met dezelfde code als de batch
 * (lib/afbeeldingen). Zo krijgt een nieuw recept vanzelf een foto zonder dat
 * iemand een script hoeft te draaien.
 *
 * Waarom een cron en geen aanroep bij het opslaan: mislukt de generatie, dan
 * heeft dat geen effect op het toevoegen zelf, en de volgende nacht pakt hij het
 * gewoon opnieuw op. Vercel Hobby laat één cron-run per dag toe.
 *
 * Per run hooguit een handvol beelden, binnen de 60 seconden die de functie
 * krijgt. Ligt er meer, dan is dat morgen aan de beurt.
 *
 * Omgevingsvariabelen op Vercel: DATABASE_URL, GEMINI_API_KEY,
 * BLOB_READ_WRITE_TOKEN en CRON_SECRET (Vercel stuurt die laatste zelf mee;
 * zonder geldige secret doet de functie niets).
 */

import { haalReceptenZonderAfbeelding, maakSql, verwerkRecept } from '../lib/afbeeldingen/genereer.js'

const MAX_PER_RUN = 8
const TIJDSLIMIET_MS = 45_000

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ fout: 'Geen toegang.' }, { status: 401 })
  }

  const start = Date.now()
  const sql = maakSql()
  const recepten = await haalReceptenZonderAfbeelding(sql, MAX_PER_RUN)

  const gelukt: string[] = []
  const mislukt: { titel: string; fout: string }[] = []

  for (const recept of recepten) {
    if (Date.now() - start > TIJDSLIMIET_MS) break
    try {
      const uitkomst = await verwerkRecept(sql, recept)
      gelukt.push(uitkomst.titel)
    } catch (fout) {
      mislukt.push({ titel: recept.titel_nl ?? recept.titel, fout: fout instanceof Error ? fout.message : String(fout) })
    }
  }

  console.log(`afbeeldingen: ${gelukt.length} gelukt, ${mislukt.length} mislukt, ${recepten.length} gevonden`)
  return Response.json({ gevonden: recepten.length, gelukt, mislukt })
}
