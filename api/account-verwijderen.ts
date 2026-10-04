/**
 * Verwijdert het account van de ingelogde gebruiker, met alles wat erbij hoort.
 *
 * Apple eist dat je een account dat je in de app kunt aanmaken, daar ook kunt
 * verwijderen (App Review 5.1.1(v)); de AVG geeft hetzelfde recht.
 *
 * Waarom een eigen functie: Neon's Managed Better Auth biedt geen
 * delete-user, en de rol `authenticated` mag het `auth`-schema niet aan. Hier
 * draaien we met DATABASE_URL, dus zonder RLS. Daarom komt het user-id nooit
 * uit het verzoek zelf, alleen uit de sessie die Neon Auth bevestigt.
 *
 * Wat er weggaat: de rij in `gebruiker` (alle tabellen hangen daar met
 * `on delete cascade` aan: voorkeuren, weekmenu's, lijst, voorraad,
 * favorieten, bestellingen, huishouden, eigen recepten) en het account in
 * Neon Auth (`neon_auth.user`; sessies en wachtwoord gaan mee). Alles in één
 * transactie: het lukt helemaal of niet.
 *
 * Eén uitzondering: recepten die je deelde en die zijn goedgekeurd, blijven
 * in de gedeelde pool, losgemaakt van jou (user_id null). Anders verdwijnt
 * een recept uit het weekmenu van iemand anders.
 *
 * Omgevingsvariabelen op Vercel: DATABASE_URL en (VITE_)NEON_AUTH_URL.
 */

import { neon } from '@neondatabase/serverless'
import { isAppOrigin } from './auth'
import { sessieUserId } from '../lib/sessie'

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return antwoord({ fout: 'Alleen POST.' }, 405)

  // Geen CORS-headers: alleen de website zelf en de iOS-app mogen dit. Een
  // andere website stuurt zijn eigen origin mee en valt hier af.
  const origin = request.headers.get('origin')
  const eigen = new URL(request.url).origin
  if (!isAppOrigin(origin) && origin !== eigen) return antwoord({ fout: 'Niet toegestaan.' }, 403)

  const basis = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!basis || !databaseUrl) return antwoord({ fout: 'De server is niet goed ingesteld.' }, 500)

  const userId = await sessieUserId(basis, request.headers.get('cookie'), eigen)
  if (!userId) return antwoord({ fout: 'Je bent niet ingelogd.' }, 401)

  try {
    const sql = neon(databaseUrl)
    const [{ tabel }] = await sql`select to_regclass('neon_auth."user"') as tabel` as { tabel: string | null }[]
    if (!tabel) return antwoord({ fout: 'Het account kon niet worden gevonden.' }, 500)

    await sql.transaction([
      sql`update recepten set user_id = null where user_id = ${userId} and deel_status = 'goedgekeurd'`,
      sql`delete from gebruiker where id = ${userId}`,
      sql`delete from neon_auth."user" where id::text = ${userId}`,
    ])
  } catch (e) {
    console.error('account verwijderen mislukt', e)
    return antwoord({ fout: 'Verwijderen lukte niet. Er is niets gewist; probeer het later opnieuw.' }, 500)
  }

  return antwoord({ ok: true }, 200)
}

function antwoord(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
