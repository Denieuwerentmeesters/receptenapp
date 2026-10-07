/**
 * Een afbeelding of video ophalen om naar Claude of OpenAI te sturen. Niets
 * hiervan wordt bewaard: het leeft in het geheugen van de functie en is na
 * het antwoord weg.
 */

export interface Bestand {
  bytes: Uint8Array
  mediaType: string
}

/**
 * Haalt een bestand op, tot `maxBytes`. Gooit een fout als het groter is of
 * niet lukt; de aanroeper beslist of dat erg is (een video die te groot is
 * voor het uitschrijven, is geen reden om de hele import af te breken).
 */
export async function haalBestand(url: string, maxBytes: number, timeoutMs = 20_000): Promise<Bestand> {
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), timeoutMs)
  try {
    const respons = await fetch(url, { signal: stop.signal, headers: { 'user-agent': 'Mozilla/5.0' } })
    if (!respons.ok) throw new Error(`Bestand niet opgehaald (${respons.status}).`)
    const lengte = Number(respons.headers.get('content-length') ?? 0)
    if (lengte > maxBytes) throw new Error(`Bestand te groot (${Math.round(lengte / 1e6)} MB).`)
    const buffer = await respons.arrayBuffer()
    if (buffer.byteLength > maxBytes) throw new Error(`Bestand te groot (${Math.round(buffer.byteLength / 1e6)} MB).`)
    const mediaType = (respons.headers.get('content-type') ?? '').split(';')[0].trim() || raadMediaType(url)
    return { bytes: new Uint8Array(buffer), mediaType }
  } finally {
    clearTimeout(timer)
  }
}

function raadMediaType(url: string): string {
  const pad = url.split('?')[0].toLowerCase()
  if (pad.endsWith('.png')) return 'image/png'
  if (pad.endsWith('.webp')) return 'image/webp'
  if (pad.endsWith('.gif')) return 'image/gif'
  if (pad.endsWith('.mp4') || pad.endsWith('.m4v')) return 'video/mp4'
  return 'image/jpeg'
}

/** Base64 zonder Buffer: de edge-runtime heeft die niet. */
export function naarBase64(bytes: Uint8Array): string {
  let binair = ''
  const stap = 0x8000
  for (let i = 0; i < bytes.length; i += stap) {
    binair += String.fromCharCode(...bytes.subarray(i, i + stap))
  }
  return btoa(binair)
}

/** De mediatypes die Claude als afbeelding accepteert. */
export type AfbeeldingType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
export const AFBEELDING_TYPES: ReadonlySet<string> = new Set<AfbeeldingType>(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export function isAfbeeldingType(t: string): t is AfbeeldingType {
  return AFBEELDING_TYPES.has(t)
}

/** Een afbeelding als inhoudsblok voor Claude; null als het type niet past. */
export function alsAfbeeldingBlok(b: Bestand): { type: 'image'; source: { type: 'base64'; media_type: AfbeeldingType; data: string } } | null {
  if (!isAfbeeldingType(b.mediaType)) return null
  return { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: naarBase64(b.bytes) } }
}
