/**
 * Gesproken tekst uit een video halen, voor Instagram-posts waar het recept
 * alleen wordt verteld. Via de spraak-naar-tekstdienst van OpenAI; het model
 * staat in een omgevingsvariabele zodat wisselen geen deploy kost.
 *
 * De video gaat één keer naar OpenAI en wordt daarna weggegooid; er blijft
 * alleen het recept over dat Claude eruit haalt.
 *
 * Omgevingsvariabelen: OPENAI_API_KEY en optioneel OPENAI_TRANSCRIBE_MODEL
 * (standaard gpt-4o-mini-transcribe).
 */

import { haalBestand } from './media'

/** De grens van de dienst: 25 MB per bestand. */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024

export interface Transcript {
  tekst: string
  model: string
}

export function uitschrijvenAan(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

/**
 * Schrijft de gesproken tekst van een video uit. Geeft null als de video te
 * groot is, de dienst niet is ingesteld of er niets verstaanbaars in zit: dan
 * gaan onderschrift en beeld alleen verder.
 */
export async function schrijfUit(videoUrl: string): Promise<Transcript | null> {
  const sleutel = process.env.OPENAI_API_KEY
  if (!sleutel) return null
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe'

  let video
  try {
    video = await haalBestand(videoUrl, MAX_VIDEO_BYTES, 30_000)
  } catch (e) {
    console.error('transcriptie: video ophalen', e instanceof Error ? e.message : e)
    return null
  }

  const vorm = new FormData()
  vorm.append('file', new Blob([video.bytes as BlobPart], { type: video.mediaType || 'video/mp4' }), 'video.mp4')
  vorm.append('model', model)
  vorm.append('response_format', 'json')

  const respons = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${sleutel}` },
    body: vorm,
  })
  if (!respons.ok) {
    console.error('transcriptie', respons.status, (await respons.text().catch(() => '')).slice(0, 300))
    return null
  }
  const data = (await respons.json().catch(() => null)) as { text?: string } | null
  const tekst = data?.text?.trim()
  return tekst ? { tekst, model } : null
}
