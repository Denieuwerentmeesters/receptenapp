/**
 * Gemini Batch API voor de grote ronde receptafbeeldingen: half zo duur als
 * losse aanroepen, maar asynchroon. Google streeft naar een doorlooptijd onder
 * de 24 uur; een job die na 48 uur nog loopt, vervalt.
 *
 *   1. startBatch      JSONL met één verzoek per recept uploaden en de job aanmaken
 *   2. haalBatch       status opvragen
 *   3. leesResultaten  het resultatenbestand regel voor regel doorlopen
 *
 * De sleutel per regel is het recept-id, zodat een resultaat altijd terug te
 * leggen is, ook als Google de volgorde verandert.
 */

import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { beeldVerzoek, STANDAARD_MODEL, type GeminiAntwoord } from './genereer'

const BASIS = 'https://generativelanguage.googleapis.com'

/** Google noemt ze in de docs JOB_STATE_*, maar de REST-API geeft BATCH_STATE_*;
 *  we halen het voorvoegsel eraf. */
export type BatchStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'

export interface BatchInfo {
  naam: string
  status: BatchStatus
  resultatenBestand?: string
}

export interface BatchRegel {
  sleutel: string
  antwoord?: GeminiAntwoord
  fout?: string
}

function sleutel(): string {
  const s = process.env.GEMINI_API_KEY
  if (!s) throw new Error('GEMINI_API_KEY ontbreekt.')
  return s
}

async function alsJson<T>(respons: Response, wat: string): Promise<T> {
  const tekst = await respons.text()
  if (!respons.ok) throw new Error(`${wat} mislukte (${respons.status}): ${tekst.slice(0, 500)}`)
  return JSON.parse(tekst) as T
}

/** Uploadt de verzoeken als JSONL en maakt de batch-job aan. Geeft de jobnaam terug. */
export async function startBatch(
  verzoeken: { sleutel: string; prompt: string }[],
  weergavenaam: string,
  model = process.env.GEMINI_IMAGE_MODEL ?? STANDAARD_MODEL,
): Promise<string> {
  const jsonl = verzoeken.map((v) => JSON.stringify({ key: v.sleutel, request: beeldVerzoek(v.prompt) })).join('\n') + '\n'
  const inhoud = Buffer.from(jsonl, 'utf8')

  // Resumable upload in twee stappen: eerst een upload-URL vragen, dan de bytes sturen.
  const start = await fetch(`${BASIS}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': sleutel(),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(inhoud.length),
      'X-Goog-Upload-Header-Content-Type': 'application/jsonl',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: weergavenaam } }),
  })
  if (!start.ok) throw new Error(`Upload starten mislukte (${start.status}): ${(await start.text()).slice(0, 500)}`)
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('Google gaf geen upload-URL terug.')

  const upload = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'content-length': String(inhoud.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: inhoud,
  })
  const bestand = await alsJson<{ file: { name: string } }>(upload, 'Upload')

  const aanmaken = await fetch(`${BASIS}/v1beta/models/${model}:batchGenerateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': sleutel(), 'content-type': 'application/json' },
    body: JSON.stringify({
      batch: { display_name: weergavenaam, input_config: { file_name: bestand.file.name } },
    }),
  })
  const job = await alsJson<{ name: string }>(aanmaken, 'Batch aanmaken')
  return job.name
}

export async function haalBatch(naam: string): Promise<BatchInfo> {
  const respons = await fetch(`${BASIS}/v1beta/${naam}`, { headers: { 'x-goog-api-key': sleutel() } })
  const job = await alsJson<{
    metadata?: { state?: string; output?: { responsesFile?: string } }
    response?: { responsesFile?: string }
  }>(respons, 'Batchstatus opvragen')
  return {
    naam,
    status: (job.metadata?.state ?? 'PENDING').replace(/^(JOB|BATCH)_STATE_/, '') as BatchStatus,
    resultatenBestand: job.response?.responsesFile ?? job.metadata?.output?.responsesFile,
  }
}

/**
 * Loopt het resultatenbestand regel voor regel door. Elke regel bevat een
 * volledig beeld in base64, dus het hele bestand is al snel honderden MB's;
 * vandaar streamen in plaats van in één keer inlezen.
 */
export async function* leesResultaten(bestand: string): AsyncGenerator<BatchRegel> {
  const respons = await fetch(`${BASIS}/download/v1beta/${bestand}:download?alt=media`, {
    headers: { 'x-goog-api-key': sleutel() },
  })
  if (!respons.ok || !respons.body) {
    throw new Error(`Resultaten downloaden mislukte (${respons.status}): ${(await respons.text()).slice(0, 500)}`)
  }
  const regels = createInterface({ input: Readable.fromWeb(respons.body as never), crlfDelay: Infinity })
  for await (const regel of regels) {
    if (!regel.trim()) continue
    const r = JSON.parse(regel) as {
      key?: string
      response?: GeminiAntwoord
      error?: { message?: string }
      status?: { message?: string }
    }
    yield {
      sleutel: r.key ?? '',
      antwoord: r.response,
      fout: r.error?.message ?? r.status?.message ?? r.response?.error?.message,
    }
  }
}
