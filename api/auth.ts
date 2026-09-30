/**
 * Doorgeefluik naar Neon Auth op het eigen domein van de app.
 *
 * Waarom: Neon Auth draait op een eigen domein (….neonauth….neon.tech). De
 * sessiecookie die het bij inloggen zet, is voor receptenapp.vercel.app dan
 * een cookie van een ander domein, en Safari gooit die weg — altijd in een
 * app op het beginscherm, en meestal ook in een gewoon tabblad. Inloggen
 * leek te lukken, maar je stond meteen weer op het inlogscherm.
 *
 * Via /api/auth/… hoort de cookie bij de app zelf. vercel.json stuurt
 * /api/auth/<pad> hierheen als ?pad=<pad>; wij sturen het ongewijzigd door
 * naar Neon Auth en geven het antwoord terug.
 *
 * De Neon-URL komt uit VITE_NEON_AUTH_URL in de Vercel-instellingen, dezelfde
 * waarde als de app gebruikt. De iOS-app gaat hier niet langs (zie
 * app/src/lib/config.ts).
 */

export const config = { runtime: 'edge' }

/** Headers die we niet doorsturen: die horen bij deze verbinding, niet bij het verzoek. */
const NIET_DOOR = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'x-forwarded-host'])

export default async function handler(request: Request): Promise<Response> {
  const basis = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL
  if (!basis) return new Response('NEON_AUTH_URL ontbreekt in de Vercel-instellingen.', { status: 500 })

  const binnen = new URL(request.url)
  const pad = binnen.searchParams.get('pad') ?? ''
  binnen.searchParams.delete('pad')
  const doel = `${basis.replace(/\/$/, '')}/${pad}${binnen.search}`

  const headers = new Headers()
  request.headers.forEach((waarde, naam) => {
    if (!NIET_DOOR.has(naam.toLowerCase())) headers.set(naam, waarde)
  })

  const antwoord = await fetch(doel, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
  })

  const terug = new Headers()
  antwoord.headers.forEach((waarde, naam) => {
    const n = naam.toLowerCase()
    // fetch heeft de body al uitgepakt; lengte en codering kloppen dan niet meer.
    if (n === 'set-cookie' || n === 'content-encoding' || n === 'content-length') return
    // Zelfde domein: geen CORS-headers nodig, en die van Neon noemen een andere origin.
    if (n.startsWith('access-control-')) return
    terug.set(naam, waarde)
  })
  for (const cookie of antwoord.headers.getSetCookie()) {
    terug.append('set-cookie', eigenCookie(cookie))
  }

  return new Response(antwoord.body, { status: antwoord.status, statusText: antwoord.statusText, headers: terug })
}

/**
 * Maakt een cookie van Neon Auth tot een cookie van dit domein: zonder
 * Domain (dan geldt hij voor de host van de app) en zonder Partitioned.
 */
export function eigenCookie(cookie: string): string {
  return cookie
    .split(';')
    .map((deel) => deel.trim())
    .filter((deel) => !/^domain=/i.test(deel) && !/^partitioned$/i.test(deel))
    .join('; ')
}
