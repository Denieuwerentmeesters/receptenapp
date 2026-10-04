/**
 * De openbare pagina van één recept: receptenapp.vercel.app/r/<naam>. Voor wie
 * een link kreeg en geen account heeft (of niet in je huishouden zit).
 *
 * Het adres (app/src/lib/slug.ts):
 *   - /r/<slug> voor een recept uit de pool; de slug staat in de database;
 *   - /r/<naam>-<id> voor een eigen recept: de naam is voor het oog, het id
 *     is wat telt en wat de link geheim houdt;
 *   - /r/<id> zoals het was blijft werken, en gaat door naar de slug als die er is.
 *
 * Waarom een functie en geen scherm in de app: de app begint met inloggen, en
 * een pagina die de server maakt heeft een titel en foto in de voorvertoning
 * van WhatsApp en iMessage.
 *
 * Draait met DATABASE_URL, dus zonder RLS. Wat openbaar is bepaalt de query
 * hieronder, en nergens anders:
 *   - de gedeelde pool en goedgekeurd gedeelde recepten;
 *   - een eigen recept waar de eigenaar een link voor maakte (deellink_sinds);
 *   - nooit een kookboekrecept.
 * Er gaat niets over de eigenaar mee: geen user_id, geen naam.
 *
 * vercel.json stuurt /r/<pad> hierheen als ?id=<pad>; ?p=<n> is het aantal personen.
 */

import { neon } from '@neondatabase/serverless'
import { MAX_PERSONEN, meldingPagina, receptPagina, type DeelRecept } from '../lib/deelpagina'
import { leesReceptPad, receptPad } from '../app/src/lib/slug'

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return html(meldingPagina('Niet gevonden', 'Deze pagina bestaat niet.'), 405)

  const binnen = new URL(request.url)
  const pad = (binnen.searchParams.get('id') ?? '').toLowerCase()
  const gezocht = leesReceptPad(pad)
  if (!gezocht) return nietGevonden()

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return storing()

  let recept: DeelRecept | undefined
  try {
    const sql = neon(databaseUrl)
    // Op slug vind je alleen de pool: een eigen recept heeft er geen.
    const rijen = ('id' in gezocht
      ? await sql`
          select id, slug, titel, titel_nl, personen, bereidingstijd_minuten, keuken,
                 ingredienten, bereiding_nl, afbeelding_url,
                 (user_id is null or deel_status = 'goedgekeurd') as "inPool"
          from recepten
          where id = ${gezocht.id}
            and bron_type <> 'kookboek_foto'
            and (user_id is null or deel_status = 'goedgekeurd' or deellink_sinds is not null)
        `
      : await sql`
          select id, slug, titel, titel_nl, personen, bereidingstijd_minuten, keuken,
                 ingredienten, bereiding_nl, afbeelding_url, true as "inPool"
          from recepten
          where slug = ${gezocht.slug}
            and bron_type <> 'kookboek_foto'
            and (user_id is null or deel_status = 'goedgekeurd')
        `) as DeelRecept[]
    recept = rijen[0]
  } catch (e) {
    console.error('receptpagina mislukt', e)
    return storing()
  }
  if (!recept) return nietGevonden()

  // Een oude link naar een recept uit de pool gaat door naar het adres met de naam.
  const adres = `${binnen.origin}/r/${receptPad(recept)}`
  const p = binnen.searchParams.get('p')
  if (recept.slug && pad !== recept.slug) {
    return new Response(null, { status: 308, headers: { location: p ? `${adres}?p=${encodeURIComponent(p)}` : adres } })
  }

  const gevraagd = Number.parseInt(p ?? '', 10)
  const personen = Number.isFinite(gevraagd) ? Math.min(MAX_PERSONEN, Math.max(1, gevraagd)) : recept.personen

  // Kort in de cache: een link wordt in een groepsapp in één klap vaak geopend.
  return html(receptPagina(recept, personen, adres), 200, 'public, max-age=0, s-maxage=300')
}

function nietGevonden(): Response {
  return html(meldingPagina('Recept niet gevonden', 'Deze link klopt niet, of het recept wordt niet meer gedeeld.'), 404)
}

function storing(): Response {
  return html(meldingPagina('Even niet bereikbaar', 'Het recept kon niet worden opgehaald. Probeer het zo nog eens.'), 500)
}

function html(body: string, status: number, cache = 'no-store'): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache },
  })
}
