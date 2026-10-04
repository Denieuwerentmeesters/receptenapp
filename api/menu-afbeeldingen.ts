/**
 * Maakt meteen de foto's bij een menu dat je net opsloeg (Zelf samenstellen).
 *
 * De nachtelijke ronde (api/afbeeldingen.ts) pakt elk recept zonder foto
 * vanzelf op, maar naar een menu kijk je dezelfde dag nog: een avond lang
 * rode vlakken met "foto" leest als een storing. De app roept dit daarom aan
 * zodra de recepten zijn opgeslagen. Mislukt het, dan blijft de nachtelijke
 * ronde het vangnet.
 *
 * Kost een paar cent per menu, dus alleen voor wie ingelogd is, alleen voor
 * je eigen samengestelde recepten zonder foto, en met een dagmaximum.
 *
 * Node-runtime (sharp), net als api/afbeeldingen.ts.
 */

import { isAppOrigin } from './auth'
import { sessieUserId } from '../lib/sessie'
import { haalReceptenZonderAfbeelding, maakSql, verwerkRecept } from '../lib/afbeeldingen/genereer'

/** Zoveel foto's per gebruiker per 24 uur; tien menu's van vier gerechten. */
const DAGMAXIMUM = 40

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin')
  const eigen = new URL(request.url).origin
  if (!isAppOrigin(origin) && origin !== eigen) return Response.json({ fout: 'Niet toegestaan.' }, { status: 403 })

  const basis = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL
  if (!basis) return Response.json({ fout: 'De server is niet goed ingesteld.' }, { status: 500 })
  const userId = await sessieUserId(basis, request.headers.get('cookie'), eigen)
  if (!userId) return Response.json({ fout: 'Je bent niet ingelogd.' }, { status: 401 })

  const { samenstellingId } = (await request.json().catch(() => ({}))) as { samenstellingId?: unknown }
  if (typeof samenstellingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(samenstellingId)) {
    return Response.json({ fout: 'Ongeldige aanvraag.' }, { status: 400 })
  }

  const sql = maakSql()
  const [{ aantal }] = await sql`
    select count(*)::int as aantal from recepten
    where user_id = ${userId} and bron_type = 'samengesteld' and afbeelding_bron = 'gegenereerd'
      and aangemaakt_op > now() - interval '24 hours'
  ` as { aantal: number }[]
  const ruimte = DAGMAXIMUM - aantal
  if (ruimte <= 0) return Response.json({ gelukt: 0, mislukt: 0 })

  // Het user-id komt uit de sessie: zo maak je geen foto's bij andermans recepten.
  const eigenRecepten = await sql`
    select id from recepten
    where samenstelling_id = ${samenstellingId}::uuid and user_id = ${userId}
      and bron_type = 'samengesteld' and afbeelding_url is null
    order by aangemaakt_op
    limit ${Math.min(6, ruimte)}
  ` as { id: string }[]
  if (eigenRecepten.length === 0) return Response.json({ gelukt: 0, mislukt: 0 })

  // Tegelijk: vier beelden na elkaar past niet altijd binnen de minuut.
  const recepten = await haalReceptenZonderAfbeelding(sql, eigenRecepten.length, eigenRecepten.map((r) => r.id))
  const uitkomsten = await Promise.allSettled(recepten.map((r) => verwerkRecept(sql, r)))
  const mislukt = uitkomsten.filter((u) => u.status === 'rejected')
  for (const m of mislukt) console.error('menu-afbeeldingen', (m as PromiseRejectedResult).reason)

  return Response.json({ gelukt: uitkomsten.length - mislukt.length, mislukt: mislukt.length })
}
