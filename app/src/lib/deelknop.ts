import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * De deelknop van iOS (app/ios/App/Delen): in Instagram of Safari tik je op
 * Delen en kies je Pinch. De extension zet de link in de App Group en opent
 * de app met pinch://toevoegen?url=…; de app gaat dan naar het toevoegscherm,
 * waar het uitlezen vanzelf start.
 *
 * Twee wegen, omdat een extension de app officieel niet mag openen: lukt het
 * URL-schema niet, dan staat de link nog in de App Group en pakt de app 'm op
 * bij de volgende start of zodra hij weer actief wordt.
 */

/** Dezelfde naam als in App.entitlements, Delen.entitlements en ShareViewController.swift. */
export const APP_GROEP = 'group.nl.reinoudtencate.receptenapp'
const SLEUTEL = 'gedeeldeLink'
/** De standaardgroep van @capacitor/preferences; daar zetten we 'm na het lezen weer op. */
const STANDAARD_GROEP = 'CapacitorStorage'

/** De gedeelde link uit pinch://toevoegen?url=…, of null als het iets anders is. */
export function linkUitSchema(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (u.protocol !== 'pinch:' || !/^(\/\/)?toevoegen\/?$/.test(u.host + u.pathname)) return null
  const link = u.searchParams.get('url')
  return link && /^https?:\/\//i.test(link) ? link : null
}

/** Haalt de link uit de App Group en wist 'm meteen, zodat hij maar één keer meetelt. */
export async function haalGedeeldeLink(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    await Preferences.configure({ group: APP_GROEP })
    const { value } = await Preferences.get({ key: SLEUTEL })
    if (value) await Preferences.remove({ key: SLEUTEL })
    return value && /^https?:\/\//i.test(value) ? value : null
  } catch (e) {
    console.error('deelknop: app group lezen', e)
    return null
  } finally {
    await Preferences.configure({ group: STANDAARD_GROEP }).catch(() => undefined)
  }
}

/** Het pad in de app voor een gedeelde link. */
export function toevoegPad(link: string): string {
  return `/toevoegen?route=link&url=${encodeURIComponent(link)}`
}
