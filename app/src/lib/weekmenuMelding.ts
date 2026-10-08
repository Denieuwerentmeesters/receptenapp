import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Voorkeuren } from './database.types'

/**
 * De wekelijkse melding "Je weekmenu staat klaar", op de dag en tijd uit
 * Instellingen (pushbericht_dag, pushbericht_tijd).
 *
 * Een lokale melding, geen push: de app plant 'm zelf op het toestel, elke
 * week opnieuw op hetzelfde moment, en iOS laat 'm afgaan, ook als de app
 * dicht is. Daar is geen server en geen Apple-sleutel voor nodig. De tekst
 * is daardoor wel vast: welke recepten er klaarstaan weet de app pas als je
 * 'm opent (genereer_weekmenu). In de browser gebeurt er niets.
 *
 * De planning wordt bij elke start en bij elke wijziging van de instelling
 * opnieuw gezet (App.tsx, Poort), zodat de melding de instelling volgt.
 */

/** Vast id, zodat opnieuw plannen de vorige vervangt. De kookwekker heeft 4711. */
const MELDING_ID = 2026

export interface MeldingMoment {
  /** iOS/Capacitor: 1 = zondag … 7 = zaterdag. */
  weekday: number
  hour: number
  minute: number
}

/** Wanneer de melding komt, uit de voorkeuren (dag 0 = zondag, tijd 'uu:mm[:ss]'); null als hij uit staat of de tijd onleesbaar is. */
export function meldingMoment(v: Pick<Voorkeuren, 'pushbericht_aan' | 'pushbericht_dag' | 'pushbericht_tijd'>): MeldingMoment | null {
  if (!v.pushbericht_aan) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(v.pushbericht_tijd ?? '')
  if (!m) return null
  const hour = Number(m[1]), minute = Number(m[2])
  if (hour > 23 || minute > 59 || !Number.isInteger(v.pushbericht_dag) || v.pushbericht_dag < 0 || v.pushbericht_dag > 6) return null
  return { weekday: v.pushbericht_dag + 1, hour, minute }
}

/** Plant de melding volgens de voorkeuren, of trekt 'm in als hij uit staat. Vraagt de eerste keer om toestemming. */
export async function planWeekmenuMelding(v: Pick<Voorkeuren, 'pushbericht_aan' | 'pushbericht_dag' | 'pushbericht_tijd'>): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const moment = meldingMoment(v)
    if (!moment) {
      await LocalNotifications.cancel({ notifications: [{ id: MELDING_ID }] })
      return
    }
    let toestemming = await LocalNotifications.checkPermissions()
    if (toestemming.display === 'prompt' || toestemming.display === 'prompt-with-rationale') {
      toestemming = await LocalNotifications.requestPermissions()
    }
    if (toestemming.display !== 'granted') return
    await LocalNotifications.cancel({ notifications: [{ id: MELDING_ID }] })
    await LocalNotifications.schedule({
      notifications: [{
        id: MELDING_ID,
        title: 'Je weekmenu staat klaar',
        body: 'Tien nieuwe recepten voor komende week. Kies wat je gaat koken.',
        // `on` zonder datum herhaalt elke week op deze dag en tijd.
        schedule: { on: moment, allowWhileIdle: true },
      }],
    })
  } catch (e) {
    // Geen melding is jammer, de app werkt verder gewoon.
    console.error('weekmenu-melding plannen', e)
  }
}
