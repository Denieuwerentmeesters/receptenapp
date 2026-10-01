import { Capacitor } from '@capacitor/core'
import { WEBSITE } from './config'
import type { Ingredient } from './database.types'

/**
 * Praat met de serverless functie in api/extraheer.ts.
 *
 * De functie leest een foto of vrije tekst en geeft gestructureerde velden
 * terug. De Anthropic-sleutel staat daar op de server, niet hier — anders kan
 * iedereen die de app installeert 'm eruit halen.
 */

export interface Concept {
  titel: string
  personen: number
  bereidingstijd_minuten?: number
  keuken?: string
  tags: string[]
  ingredienten: Ingredient[]
  bereiding_nl: string[]
}

/**
 * De functie draait op hetzelfde Vercel-project als de app. In de browser is
 * dat dus een pad op ons eigen domein; de iOS-app draait op capacitor:// en
 * moet het hele adres hebben. VITE_EXTRACTIE_URL wint, voor lokaal testen.
 */
function endpoint(): string {
  return import.meta.env.VITE_EXTRACTIE_URL
    || (Capacitor.isNativePlatform() ? `${WEBSITE}/api/extraheer` : '/api/extraheer')
}

async function vraag(body: unknown): Promise<Concept> {
  const respons = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = (await respons.json()) as Partial<Concept> & { fout?: string }
  if (!respons.ok || data.fout) {
    throw new Error(data.fout ?? 'Het uitlezen is niet gelukt.')
  }

  return {
    titel: data.titel ?? '',
    personen: data.personen ?? 4,
    bereidingstijd_minuten: data.bereidingstijd_minuten,
    keuken: data.keuken,
    tags: data.tags ?? [],
    ingredienten: data.ingredienten ?? [],
    bereiding_nl: data.bereiding_nl ?? [],
  }
}

export function leesTekst(tekst: string): Promise<Concept> {
  return vraag({ tekst })
}

export async function leesFoto(bestand: File): Promise<Concept> {
  // Verkleinen voor verzenden: een telefoonfoto van 4 MB is zonde van de tijd
  // en het model leest een kleinere versie net zo goed.
  const { data, mediaType } = await verklein(bestand)
  return vraag({ afbeelding: { data, mediaType } })
}

const MAX_ZIJDE = 1600

async function verklein(bestand: File): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(bestand)
  const schaal = Math.min(1, MAX_ZIJDE / Math.max(bitmap.width, bitmap.height))
  const breedte = Math.round(bitmap.width * schaal)
  const hoogte = Math.round(bitmap.height * schaal)

  const canvas = document.createElement('canvas')
  canvas.width = breedte
  canvas.height = hoogte
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, breedte, hoogte)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg' }
}
