/**
 * Webhook van RevenueCat: zet in `abonnement` tot wanneer Kookmaatje Plus loopt.
 *
 * De aankoop zelf loopt in de iOS-app via Apple (src/lib/aankoop.ts) en
 * RevenueCat meldt elke wijziging hier: eerste aankoop, verlenging, opzegging,
 * verlopen. Wij slaan alleen de einddatum op; `api/extraheer.ts` en
 * `api/samenstellen.ts` kijken daarnaar (lib/plus.ts). Een opzegging doet dus
 * niets tot de betaalde periode om is, en een verlopen abonnement werkt zichzelf
 * bij doordat `loopt_tot` in het verleden komt te liggen.
 *
 * Het user-id is de `app_user_id` van RevenueCat. De app logt RevenueCat in met
 * het Neon-id (aankoop.ts), dus er is geen koppeltabel. Een anonieme id
 * ($RCAnonymousID…) slaan we over: die hoort bij niemand.
 *
 * Beveiliging: RevenueCat stuurt de waarde die jij bij de webhook als
 * "Authorization header" instelt. Die staat ook in REVENUECAT_WEBHOOK_AUTH op
 * Vercel; zonder die waarde, of met een andere, wijzen we het verzoek af.
 * Omdat alleen RevenueCat die kent, kan niemand zichzelf Plus geven.
 *
 * Omgevingsvariabelen op Vercel: DATABASE_URL, REVENUECAT_WEBHOOK_AUTH en
 * (optioneel) REVENUECAT_ENTITLEMENT (standaard `plus`).
 *
 * Een 200 betekent "ontvangen". Alleen bij een echte fout (database) geven we
 * een 500, zodat RevenueCat het opnieuw probeert.
 */

import { neon } from '@neondatabase/serverless'

export const config = { runtime: 'edge' }

const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT || 'plus'

interface Gebeurtenis {
  type?: string
  app_user_id?: string
  original_app_user_id?: string
  /** Bij een overdracht tussen accounts. */
  transferred_from?: string[]
  transferred_to?: string[]
  entitlement_ids?: string[] | null
  expiration_at_ms?: number | null
  store?: string
  original_transaction_id?: string | null
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return antwoord({ fout: 'Alleen POST.' }, 405)

  const verwacht = process.env.REVENUECAT_WEBHOOK_AUTH
  const databaseUrl = process.env.DATABASE_URL
  if (!verwacht || !databaseUrl) return antwoord({ fout: 'De server is niet goed ingesteld.' }, 500)
  if (!gelijk(request.headers.get('authorization') ?? '', verwacht)) return antwoord({ fout: 'Niet toegestaan.' }, 401)

  const ruw = (await request.json().catch(() => null)) as { event?: Gebeurtenis } | null
  const e = ruw?.event
  if (!e || typeof e.type !== 'string') return antwoord({ fout: 'Ongeldige aanvraag.' }, 400)

  // TEST (de testknop van RevenueCat) en overdrachten laten we met rust.
  const userId = e.app_user_id
  if (e.type === 'TEST' || e.type === 'TRANSFER' || !userId || userId.startsWith('$RCAnonymousID')) {
    return antwoord({ ok: true, genegeerd: e.type }, 200)
  }

  // Een ander abonnement (bijvoorbeeld later een jaarproduct) mag mee, maar het
  // moet wel Plus geven; anders negeren we het.
  if (Array.isArray(e.entitlement_ids) && e.entitlement_ids.length > 0 && !e.entitlement_ids.includes(ENTITLEMENT)) {
    return antwoord({ ok: true, genegeerd: 'ander recht' }, 200)
  }
  if (typeof e.expiration_at_ms !== 'number') return antwoord({ ok: true, genegeerd: 'geen einddatum' }, 200)

  const kanaal = e.store === 'APP_STORE' || e.store === 'MAC_APP_STORE' ? 'apple' : e.store === 'STRIPE' ? 'stripe' : 'handmatig'
  const loopt = new Date(e.expiration_at_ms)
  if (Number.isNaN(loopt.getTime())) return antwoord({ fout: 'Ongeldige einddatum.' }, 400)

  try {
    const sql = neon(databaseUrl)
    // Een id die we niet kennen (account verwijderd) geeft geen fout: er is niets om te bewaren.
    await sql`
      insert into abonnement (user_id, loopt_tot, kanaal, extern_id)
      select ${userId}, ${loopt.toISOString()}::timestamptz, ${kanaal}, ${e.original_transaction_id ?? null}
      where exists (select 1 from gebruiker where id = ${userId})
      on conflict (user_id) do update
        set loopt_tot = excluded.loopt_tot,
            kanaal = excluded.kanaal,
            extern_id = coalesce(excluded.extern_id, abonnement.extern_id),
            bijgewerkt_op = now()
    `
  } catch (err) {
    console.error('revenuecat: abonnement bewaren', err)
    return antwoord({ fout: 'Bewaren lukte niet.' }, 500)
  }

  return antwoord({ ok: true }, 200)
}

/** Vergelijking die niet sneller stopt naarmate meer tekens kloppen. */
function gelijk(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let verschil = 0
  for (let i = 0; i < a.length; i++) verschil |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return verschil === 0
}

function antwoord(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
