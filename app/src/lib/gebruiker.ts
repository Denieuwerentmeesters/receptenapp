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

const VORIGE = 'pinch-gebruiker'

/**
 * Is dit een ander account dan er het laatst op dit toestel was? Dan hoort
 * alles wat hier bewaard staat bij iemand anders en ruimen we het op.
 *
 * Uitloggen wist de opslag al, maar een sessie kan ook verlopen: dan log je
 * opnieuw in zonder dat er ooit is uitgelogd. Geeft terug of de kopie van de
 * gegevens (de query-cache) weg moet. Weten we niet wie er het laatst was,
 * dan ook: liever één keer trager openen dan de voorkeuren van een ander.
 */
export function andereGebruiker(id: string): boolean {
  try {
    const vorige = localStorage.getItem(VORIGE)
    if (vorige === id) return false
    // Niet alles wissen: je bent al ingelogd, en wat de inlog hier bewaart moet blijven.
    for (const sleutel of ['pinch-onboarding', 'pinch-samenstellen']) localStorage.removeItem(sleutel)
    localStorage.setItem(VORIGE, id)
    return true
  } catch {
    return false
  }
}
