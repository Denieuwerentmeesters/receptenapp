import { db } from './db'
import { huidigeUserId } from './auth'

/**
 * Zorgt dat de gebruikersrij en de voorkeurenrij bestaan.
 *
 * Dit was een databasefunctie, maar die kon op Neon niet bij auth.user_id():
 * als `security definer` zag hij de JWT-claims niet, en als gewone functie mag
 * de rol `authenticated` het auth-schema niet aanroepen. Vanuit de client is het
 * gewoon twee inserts, en de RLS-policies (`... = auth.user_id()`) bewaken nog
 * steeds dat je alleen jezelf kunt aanmaken.
 *
 * Idempotent: bestaat de rij al, dan doet de insert niets.
 */
export async function zorgVoorGebruiker(): Promise<string> {
  const id = await huidigeUserId()

  const gebruiker = await db
    .from('gebruiker')
    .upsert({ id }, { onConflict: 'id', ignoreDuplicates: true })
  if (gebruiker.error) throw gebruiker.error

  const voorkeuren = await db
    .from('gebruiker_voorkeuren')
    .upsert({ user_id: id }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (voorkeuren.error) throw voorkeuren.error

  return id
}
