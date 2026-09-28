/**
 * Van recept naar afbeelding in de database, in vier stappen:
 *
 *   1. prompt bouwen (prompt.ts)
 *   2. beeld genereren bij Gemini (Nano Banana 2 Lite, 1K, 1:1)
 *   3. verkleinen naar WebP (de app toont kleine kaarten; 1K PNG is te zwaar)
 *   4. uploaden naar Vercel Blob en de URL wegschrijven in `recepten`
 *
 * Dezelfde code draait lokaal (scripts/genereer_afbeeldingen.ts) voor de
 * batch, en 's nachts op Vercel (api/afbeeldingen.ts) voor nieuw toegevoegde
 * recepten. Eén implementatie, zodat de stijl niet uit elkaar loopt.
 *
 * Omgevingsvariabelen:
 *   DATABASE_URL            directe Neon-connectiestring
 *   GEMINI_API_KEY          uit Google AI Studio
 *   BLOB_READ_WRITE_TOKEN   verschijnt vanzelf zodra een Blob-store aan het
 *                           Vercel-project hangt; lokaal kopiëren uit Vercel
 *   GEMINI_IMAGE_MODEL      optioneel, standaard gemini-3.1-flash-lite-image
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import { bouwPrompt, type ReceptVoorPrompt } from './prompt'

export const STANDAARD_MODEL = 'gemini-3.1-flash-lite-image'
/** Breedte van de opgeslagen WebP. Kaarten in de app zijn hooguit ~360 px breed,
 *  op een retina-scherm dus 720; 800 geeft wat marge voor het receptscherm. */
export const BREEDTE = 800

export type Sql = NeonQueryFunction<false, false>

export interface ReceptRij extends ReceptVoorPrompt {
  afbeelding_url: string | null
  afbeelding_bron: string | null
}

export function maakSql(): Sql {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ontbreekt.')
  return neon(url)
}

/**
 * Recepten die nog geen afbeelding hebben. Foto's die de gebruiker zelf
 * toevoegde (`eigen_foto`, `kookboek_foto`) laten we met rust; een gegenereerde
 * mag overschreven worden met `opnieuw`.
 */
export async function haalReceptenZonderAfbeelding(sql: Sql, limiet: number, ids?: string[]): Promise<ReceptRij[]> {
  if (ids && ids.length) {
    return (await sql`
      select id, titel, titel_nl, keuken, tags, ingredienten, afbeelding_url, afbeelding_bron
      from recepten
      where id = any(${ids}::uuid[])
    `) as ReceptRij[]
  }
  return (await sql`
    select id, titel, titel_nl, keuken, tags, ingredienten, afbeelding_url, afbeelding_bron
    from recepten
    where afbeelding_url is null
      and (afbeelding_bron is null or afbeelding_bron = 'gegenereerd')
    order by aangemaakt_op
    limit ${limiet}
  `) as ReceptRij[]
}

// -------------------------------------------------------------- Gemini

interface GeminiAntwoord {
  candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string }; text?: string }[] } }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

export async function genereerBeeld(prompt: string, model = process.env.GEMINI_IMAGE_MODEL ?? STANDAARD_MODEL): Promise<Buffer> {
  const sleutel = process.env.GEMINI_API_KEY
  if (!sleutel) throw new Error('GEMINI_API_KEY ontbreekt.')

  const respons = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': sleutel },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
        },
      }),
    },
  )

  const body = (await respons.json()) as GeminiAntwoord
  if (!respons.ok) {
    throw new Error(`Gemini gaf ${respons.status}: ${body.error?.message ?? 'onbekende fout'}`)
  }
  if (body.promptFeedback?.blockReason) {
    throw new Error(`Gemini weigerde de prompt (${body.promptFeedback.blockReason}).`)
  }
  const beeld = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
  if (!beeld) throw new Error('Gemini gaf geen afbeelding terug.')
  return Buffer.from(beeld.data, 'base64')
}

// ---------------------------------------------------------------- WebP

export async function verkleinNaarWebp(origineel: Buffer): Promise<Buffer> {
  return sharp(origineel)
    .resize(BREEDTE, BREEDTE, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toBuffer()
}

// ---------------------------------------------------------------- Blob

export async function uploadNaarBlob(receptId: string, webp: Buffer): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN ontbreekt.')
  const resultaat = await put(`recepten/${receptId}.webp`, webp, {
    access: 'public',
    contentType: 'image/webp',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  })
  return resultaat.url
}

// ------------------------------------------------------------ alles samen

export interface Uitkomst {
  id: string
  titel: string
  url: string
  prompt: string
}

export async function verwerkRecept(sql: Sql, recept: ReceptRij, model?: string): Promise<Uitkomst> {
  const { prompt } = bouwPrompt(recept)
  const origineel = await genereerBeeld(prompt, model)
  const webp = await verkleinNaarWebp(origineel)
  const url = await uploadNaarBlob(recept.id, webp)

  // Cache-buster in de URL: dezelfde bestandsnaam wordt bij `opnieuw` overschreven
  // en de app zou anders de oude versie uit de cache blijven tonen.
  const urlMetVersie = `${url}?v=${Date.now()}`

  await sql`
    update recepten
    set afbeelding_url = ${urlMetVersie},
        afbeelding_bron = 'gegenereerd',
        afbeelding_prompt = ${prompt}
    where id = ${recept.id}::uuid
  `

  return { id: recept.id, titel: recept.titel_nl ?? recept.titel, url: urlMetVersie, prompt }
}
