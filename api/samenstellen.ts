/**
 * Stelt een menu samen met Claude: een keuken, een aantal personen en wensen
 * erin, een paar recepten in het schema van de app eruit.
 *
 * Het antwoord komt als losse regels JSON (één gebeurtenis per regel, zie
 * MenuGebeurtenis) terwijl Claude schrijft: eerst de kop, dan elk gerecht
 * zodra het af is, en aan het eind het hele menu. Zo kijk je niet een halve
 * minuut naar een spinner. In de iOS-app vangt CapacitorHttp de fetch af en
 * komt alles in één keer; de app leest het dan op dezelfde manier.
 *
 * Dit kost geld per aanvraag, dus anders dan api/extraheer.ts:
 *  - alleen voor wie ingelogd is (de sessie die Neon Auth bevestigt);
 *  - een daglimiet per gebruiker, geteld in de tabel `samenstelling`.
 *
 * De functie slaat geen recepten op. Dat doet de app pas bij "Zet op mijn
 * lijst" of "Bewaar de recepten"; wie alleen kijkt laat niets achter.
 *
 * Edge-runtime: die mag blijven stromen zolang er binnen 25 seconden iets
 * teruggaat, en dat doet de kop.
 *
 * Omgevingsvariabelen op Vercel: ANTHROPIC_API_KEY, DATABASE_URL,
 * (VITE_)NEON_AUTH_URL en optioneel ANTHROPIC_MODEL_SAMENSTELLEN.
 */

import Anthropic from '@anthropic-ai/sdk'
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { isAppOrigin } from './auth'
import { sessieUserId } from '../lib/sessie'
import { MENU_SCHEMA, systeem, vraag } from '../lib/samenstellen/prompt'
import { MenuStroom } from '../app/src/lib/menuStroom'
import {
  MAX_PERSONEN, MAX_WENSEN, leesDraaiboek, leesGerecht, leesMenu,
  type Menu, type MenuGebeurtenis, type SamenstelVerzoek,
} from '../app/src/lib/menu'

export const config = { runtime: 'edge' }

/**
 * Sonnet: drie recepten die samen een menu vormen vraagt meer smaak en
 * planning dan het uitlezen van een foto. Wisselen kan zonder deploy.
 */
const MODEL = process.env.ANTHROPIC_MODEL_SAMENSTELLEN || 'claude-sonnet-5-5'

/** Per gebruiker, per 24 uur. */
const LIMIET = { nieuw: 10, aanpassing: 30 } as const
type Soort = keyof typeof LIMIET

type Sql = NeonQueryFunction<false, false>

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return fout('Alleen POST.', 405)

  // Geen CORS-headers: alleen de website zelf en de iOS-app mogen dit.
  const origin = request.headers.get('origin')
  const eigen = new URL(request.url).origin
  if (!isAppOrigin(origin) && origin !== eigen) return fout('Niet toegestaan.', 403)

  const sleutel = process.env.ANTHROPIC_API_KEY
  const basis = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!sleutel || !basis || !databaseUrl) return fout('De server is niet goed ingesteld.', 500)

  const userId = await sessieUserId(basis, request.headers.get('cookie'), eigen)
  if (!userId) return fout('Je bent niet ingelogd.', 401)

  const gelezen = leesVerzoek(await request.json().catch(() => null))
  if (typeof gelezen === 'string') return fout(gelezen, 400)
  const { verzoek, vorig } = gelezen
  const soort: Soort = vorig ? 'aanpassing' : 'nieuw'

  const sql = neon(databaseUrl)
  let samenstellingId: string
  let sleutels: string[]
  try {
    const [{ aantal }] = await sql`
      select count(*)::int as aantal from samenstelling
      where user_id = ${userId} and soort = ${soort} and aangemaakt_op > now() - interval '24 hours'
    ` as { aantal: number }[]
    if (aantal >= LIMIET[soort]) {
      return fout(soort === 'nieuw'
        ? `Je hebt vandaag al ${LIMIET.nieuw} menu's laten samenstellen. Morgen kan het weer.`
        : `Je hebt dit menu vandaag al ${LIMIET.aanpassing} keer aangepast. Morgen kan het weer.`, 429)
    }
    sleutels = await productSleutels(sql, verzoek.winkel)
    // Vóór de aanroep vastleggen: ook een afgebroken aanvraag telt voor de limiet.
    const [rij] = await sql`
      insert into samenstelling (user_id, soort, keuken, personen, wensen, model)
      values (${userId}, ${soort}, ${verzoek.keuken}, ${verzoek.personen},
              ${verzoek.wijziging ?? verzoek.wensen}, ${MODEL})
      returning id
    ` as { id: string }[]
    samenstellingId = rij.id
  } catch (e) {
    console.error('samenstellen: database', e)
    return fout('Samenstellen lukt nu even niet. Probeer het later opnieuw.', 500)
  }

  const codeer = new TextEncoder()
  const stroom = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stuur = (g: MenuGebeurtenis) => controller.enqueue(codeer.encode(`${JSON.stringify(g)}\n`))
      try {
        const menu = await schrijfMenu(new Anthropic({ apiKey: sleutel }), sleutels, verzoek, vorig, stuur, async (gebruik) => {
          await sql`
            update samenstelling set tokens_in = ${gebruik.tokensIn}, tokens_uit = ${gebruik.tokensUit}
            where id = ${samenstellingId}
          `
        })
        await sql`
          update samenstelling
          set keuken = ${menu.keuken}, begrepen = ${JSON.stringify(menu.begrepen)}::jsonb,
              antwoord = ${JSON.stringify(menu)}::jsonb
          where id = ${samenstellingId}
        `
        stuur({ soort: 'klaar', menu, samenstellingId })
      } catch (e) {
        console.error('samenstellen', e)
        stuur({ soort: 'fout', fout: meldingVoor(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stroom, {
    status: 200,
    headers: {
      // Platte tekst: CapacitorHttp in de iOS-app geeft die ongemoeid door.
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}

/** Een fout die we de gebruiker letterlijk mogen laten zien. */
class Melding extends Error {}

function meldingVoor(e: unknown): string {
  if (e instanceof Melding) return e.message
  if (e instanceof Anthropic.RateLimitError || (e instanceof Anthropic.APIError && Number(e.status) >= 500)) {
    return 'Het is even druk bij Claude. Probeer het over een minuut opnieuw.'
  }
  return 'Het samenstellen is niet gelukt. Probeer het opnieuw.'
}

/**
 * Vraagt Claude om het menu en stuurt kop en gerechten door zodra ze af zijn.
 * Geeft het hele, nagelopen menu terug; gooit als er geen bruikbaar menu kwam.
 */
async function schrijfMenu(
  claude: Anthropic,
  sleutels: string[],
  verzoek: SamenstelVerzoek,
  vorig: Menu | null,
  stuur: (g: MenuGebeurtenis) => void,
  legGebruikVast: (gebruik: { tokensIn: number; tokensUit: number }) => Promise<unknown>,
): Promise<Menu> {
  const eenGerecht = vorig !== null && verzoek.vervang !== undefined
  const lopend = claude.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: systeem(sleutels, verzoek.winkel),
    messages: [{ role: 'user', content: vraag(verzoek, vorig) }],
    output_config: {
      format: { type: 'json_schema', schema: MENU_SCHEMA },
      // Laag: het nadenken vooraf is wachttijd voor de gebruiker. Haiku 4.5
      // kent dit veld niet en weigert het verzoek als het erin staat.
      ...(MODEL.includes('haiku') ? {} : { effort: 'low' as const }),
    },
  })

  const lezer = new MenuStroom()
  let gerechten = 0
  for await (const gebeurtenis of lopend) {
    if (gebeurtenis.type !== 'content_block_delta' || gebeurtenis.delta.type !== 'text_delta') continue
    for (const deel of lezer.voeg(gebeurtenis.delta.text)) {
      if (deel.soort === 'kop') {
        // Bij één ander voorstel staat de kop er al.
        if (eenGerecht) continue
        const keuken = typeof deel.waarde.keuken === 'string' && deel.waarde.keuken.trim()
        const begrepen = Array.isArray(deel.waarde.begrepen)
          ? deel.waarde.begrepen.filter((b): b is string => typeof b === 'string') : []
        stuur({ soort: 'kop', keuken: keuken || verzoek.keuken, begrepen })
      } else {
        const gerecht = leesGerecht(deel.waarde)
        if (!gerecht) continue
        if (eenGerecht) {
          if (gerechten === 0) stuur({ soort: 'gerecht', index: verzoek.vervang!, gerecht })
        } else {
          stuur({ soort: 'gerecht', index: gerechten, gerecht })
        }
        gerechten++
      }
    }
  }

  const bericht = await lopend.finalMessage()
  const u = bericht.usage
  await legGebruikVast({
    tokensIn: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    tokensUit: u.output_tokens,
  }).catch((e) => console.error('samenstellen: gebruik vastleggen', e))

  if (bericht.stop_reason === 'refusal') {
    throw new Melding('Hier kan Pinch geen menu van maken. Probeer het met andere wensen.')
  }
  if (bericht.stop_reason === 'max_tokens') {
    throw new Melding('Het menu werd te lang. Probeer het met minder gerechten.')
  }

  let ruw: unknown
  try {
    ruw = JSON.parse(lezer.alles)
  } catch {
    throw new Melding('Het menu kwam niet goed door. Probeer het opnieuw.')
  }

  if (eenGerecht) {
    const nieuw = leesGerecht(((ruw as { gerechten?: unknown[] }).gerechten ?? [])[0])
    if (!nieuw) throw new Melding('Er kwam geen bruikbaar voorstel terug. Probeer het opnieuw.')
    const draaiboek = leesDraaiboek((ruw as { draaiboek?: unknown }).draaiboek)
    return {
      ...vorig,
      gerechten: vorig.gerechten.map((g, i) => (i === verzoek.vervang ? nieuw : g)),
      draaiboek: draaiboek.length > 0 ? draaiboek : vorig.draaiboek,
    }
  }

  const menu = leesMenu(ruw, verzoek.personen, vorig?.keuken ?? verzoek.keuken)
  if (!menu) throw new Melding('Er kwam geen bruikbaar menu terug. Probeer het opnieuw.')
  return menu
}

/**
 * De ingrediëntsleutels waarvoor deze winkel een productnummer heeft. Altijd
 * in dezelfde volgorde: de lijst staat in het deel van de prompt dat uit de
 * cache komt, en één verschil in volgorde maakt die cache waardeloos.
 */
async function productSleutels(sql: Sql, winkel: 'ah' | 'jumbo'): Promise<string[]> {
  const rijen = (winkel === 'jumbo'
    ? await sql`select ingredient_key from jumbo_product_cache where standaard_sku is not null order by ingredient_key`
    : await sql`select ingredient_key from ah_product_cache where standaard_product_id is not null order by ingredient_key`
  ) as { ingredient_key: string }[]
  return rijen.map((r) => r.ingredient_key)
}

/** Loopt het verzoek na; een tekst als antwoord is de foutmelding. */
function leesVerzoek(ruw: unknown): { verzoek: SamenstelVerzoek; vorig: Menu | null } | string {
  if (!ruw || typeof ruw !== 'object') return 'Ongeldige aanvraag.'
  const o = ruw as Record<string, unknown>

  const keuken = typeof o.keuken === 'string' ? o.keuken.replace(/\s+/g, ' ').trim().slice(0, 40) : ''
  if (!keuken) return 'Kies eerst een keuken.'
  const personen = Number(o.personen)
  if (!Number.isInteger(personen) || personen < 1 || personen > MAX_PERSONEN) {
    return `Kies een aantal personen van 1 tot ${MAX_PERSONEN}.`
  }
  const kort = (w: unknown) => (typeof w === 'string' ? w.trim().slice(0, MAX_WENSEN) : '')

  const verzoek: SamenstelVerzoek = {
    keuken,
    personen,
    wensen: kort(o.wensen),
    // De id's uit lib/allergenen.ts: één woord in kleine letters. Meer laten we niet door.
    allergieen: Array.isArray(o.allergieen)
      ? o.allergieen.filter((a): a is string => typeof a === 'string' && /^[a-z]{2,20}$/.test(a)).slice(0, 12) : [],
    winkel: o.winkel === 'jumbo' ? 'jumbo' : 'ah',
  }

  if (o.vorig === undefined || o.vorig === null) return { verzoek, vorig: null }

  // Bijsturen: het vorige menu komt van de app en gaat de prompt in, dus eerst
  // door dezelfde controle als een antwoord van Claude.
  const vorig = leesMenu(o.vorig, personen, keuken)
  if (!vorig) return 'Het menu om aan te passen ontbreekt.'
  const wijziging = kort(o.wijziging)
  if (Number.isInteger(o.vervang)) {
    const vervang = Number(o.vervang)
    if (vervang < 0 || vervang >= vorig.gerechten.length) return 'Dat gerecht staat niet in het menu.'
    return { verzoek: { ...verzoek, vervang }, vorig }
  }
  if (!wijziging) return 'Schrijf op wat er anders moet.'
  return { verzoek: { ...verzoek, wijziging }, vorig }
}

function fout(bericht: string, status: number): Response {
  return new Response(JSON.stringify({ fout: bericht }), {
    status, headers: { 'content-type': 'application/json' },
  })
}
