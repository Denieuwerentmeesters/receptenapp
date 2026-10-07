import { db } from './db'
import { huidigeUserId } from './auth'

/**
 * De zes events van de onboarding (migratie 20261006100000_onboarding.sql):
 * waar haken mensen af, en leidt het tot een eerste week?
 *
 * In `extra` staat alleen wáár iets gebeurde (welke kaart, welke vraag, hoeveel
 * recepten), nooit het antwoord zelf: een allergie hoort hier niet.
 */
export type OnboardingEvent =
  | 'onboarding_gestart'
  | 'uitleg_overgeslagen'
  | 'vraag_beantwoord'
  | 'vraag_overgeslagen'
  | 'onboarding_klaar'
  | 'week_gevuld_onboarding'

/** Schrijft een event weg. Wacht nergens op en faalt stil: meten mag de app nooit ophouden. */
export function meet(event: OnboardingEvent, extra: Record<string, string | number> = {}): void {
  void (async () => {
    try {
      await db.from('onboarding_event').insert({ user_id: await huidigeUserId(), event, extra })
    } catch { /* geen bereik of de tabel is er nog niet: dan missen we dit event */ }
  })()
}
