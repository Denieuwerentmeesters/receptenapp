import { NeonPostgrestClient, fetchWithToken } from '@neondatabase/postgrest-js'
import { haalToken } from './auth'
import { config } from './config'
import type { Database } from './database.types'

/**
 * De Neon Data API is PostgREST: dezelfde `.from().select().eq()`-vorm als
 * supabase-js. Het token wordt lui opgehaald bij elk verzoek, zodat een
 * verlopen JWT vanzelf ververst wordt zonder dat de app iets merkt.
 *
 * Alle afscherming zit in RLS (db/migrations/20260809000002_rls.sql) — een tabel
 * zonder policy is via deze endpoint volledig leesbaar voor elke ingelogde
 * gebruiker, dus daar mag nooit een tabel doorheen glippen.
 *
 * De client wordt lui opgebouwd: zo wordt een ontbrekende configuratie een
 * nette foutmelding in het foutscherm in plaats van een omvallende bundle.
 */

let client: NeonPostgrestClient<Database> | null = null

function neon(): NeonPostgrestClient<Database> {
  client ??= new NeonPostgrestClient<Database>({
    dataApiUrl: config().neonDataApiUrl,
    options: { global: { fetch: fetchWithToken(haalToken) } },
  })
  return client
}

/**
 * Proxy zodat de rest van de app gewoon `db.from(...)` kan schrijven, terwijl de
 * client pas ontstaat op het moment dat 'ie echt gebruikt wordt.
 */
export const db = new Proxy({} as NeonPostgrestClient<Database>, {
  get(_doel, eigenschap: string | symbol) {
    const waarde = Reflect.get(neon(), eigenschap) as unknown
    return typeof waarde === 'function' ? waarde.bind(neon()) : waarde
  },
})
