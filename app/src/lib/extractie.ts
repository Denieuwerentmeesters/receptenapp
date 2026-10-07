import { Capacitor } from '@capacitor/core'
import { WEBSITE } from './config'

/**
 * Praat met de serverless functie in api/extraheer.ts.
 *
 * De functie leest een link (website of Instagram), screenshots, een
 * kookboekfoto of vrije tekst en geeft gestructureerde velden terug. De
 * sleutels van Anthropic, OpenAI en de scraper staan daar op de server, niet
 * hier — anders kan iedereen die de app installeert ze eruit halen.
 *
 * Het antwoord komt als één gebeurtenis per regel (ScanGebeurtenis): de
 * stappen onderweg ("Video uitschrijven") en aan het eind het recept. In de
 * browser druppelen die binnen; in de iOS-app (CapacitorHttp) komt alles
 * tegelijk. Beide lopen door dezelfde lus, net als bij Zelf samenstellen.
 */

export type { Concept, ConceptBron, ScanGebeurtenis } from './importeren'
import type { Concept, ScanGebeurtenis } from './importeren'

/** Het recept zoals het terugkwam, met de scan waar het bij hoort (voor recepten.scan_id). */
export interface Uitgelezen {
  concept: Concept
  scanId: string | null
}

/** De link is al eens geïmporteerd; de app opent dat recept. */
export class BestaatAl extends Error {
  receptId: string
  constructor(receptId: string) {
    super('Dit recept staat al bij je recepten.')
    this.receptId = receptId
  }
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

type OpStap = (tekst: string) => void

async function vraag(body: Record<string, unknown>, opStap: OpStap, signaal?: AbortSignal): Promise<Uitgelezen> {
  const respons = await fetch(endpoint(), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, stroom: true }),
    signal: signaal,
  })
  if (!respons.ok) {
    const { fout } = (await respons.json().catch(() => ({}))) as { fout?: string }
    throw new Error(fout ?? 'Het uitlezen is niet gelukt.')
  }

  let klaar: Uitgelezen | null = null
  const verwerk = (regel: string) => {
    if (!regel.trim()) return
    const g = JSON.parse(regel) as ScanGebeurtenis
    if (g.soort === 'fout') throw new Error(g.fout)
    if (g.soort === 'bestaat') throw new BestaatAl(g.receptId)
    if (g.soort === 'klaar') klaar = { concept: g.concept, scanId: g.scanId }
    if (g.soort === 'stap') opStap(g.tekst)
  }

  const lezer = respons.body?.getReader()
  if (!lezer) {
    for (const regel of (await respons.text()).split('\n')) verwerk(regel)
  } else {
    const decoder = new TextDecoder()
    let rest = ''
    for (;;) {
      const { done, value } = await lezer.read()
      rest += decoder.decode(value, { stream: !done })
      const regels = rest.split('\n')
      rest = regels.pop() ?? ''
      for (const regel of regels) verwerk(regel)
      if (done) break
    }
    verwerk(rest)
  }

  if (!klaar) throw new Error('De verbinding viel weg voordat het recept af was. Probeer het opnieuw.')
  return klaar
}

export function leesTekst(tekst: string, opStap: OpStap = () => undefined): Promise<Uitgelezen> {
  return vraag({ tekst }, opStap)
}

export async function leesFoto(bestand: File, opStap: OpStap = () => undefined): Promise<Uitgelezen> {
  // Verkleinen voor verzenden: een telefoonfoto van 4 MB is zonde van de tijd
  // en het model leest een kleinere versie net zo goed.
  const afbeelding = await verklein(bestand)
  return vraag({ afbeelding }, opStap)
}

/** Een link van een website of Instagram. De server bepaalt de route. */
export function leesLink(url: string, opStap: OpStap = () => undefined, signaal?: AbortSignal): Promise<Uitgelezen> {
  return vraag({ url }, opStap, signaal)
}

/** Hooguit zoveel screenshots per recept; dezelfde grens als de server. */
export const MAX_SCREENSHOTS = 4

/** Screenshots van één recept, in de volgorde waarin ze gekozen zijn. */
export async function leesScreenshots(bestanden: File[], opStap: OpStap = () => undefined): Promise<Uitgelezen> {
  const afbeeldingen = await Promise.all(bestanden.slice(0, MAX_SCREENSHOTS).map(verklein))
  return vraag({ afbeeldingen }, opStap)
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
