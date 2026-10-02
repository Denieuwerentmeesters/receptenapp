/**
 * Configuratie uit .env.local, met een nette Nederlandse fout als er iets mist.
 *
 * Belangrijk: dit gooit pas als je de waarden opvraagt, niet bij het importeren
 * van de module. Zou het bij import gooien, dan valt de hele bundle om en zie je
 * een wit scherm in plaats van het foutscherm dat vertelt wát er mist.
 */

import { Capacitor } from '@capacitor/core'

/** Waar de website draait; de iOS-app heeft zelf geen https-adres. */
export const WEBSITE = 'https://receptenapp.vercel.app'

/** Openbare pagina's in app/public; App Store Connect verwijst naar dezelfde adressen. */
export const PRIVACY_URL = `${WEBSITE}/privacy.html`
export const VOORWAARDEN_URL = `${WEBSITE}/voorwaarden.html`
export const SUPPORT_URL = `${WEBSITE}/support.html`

interface Config {
  neonDataApiUrl: string
  neonAuthUrl: string
}

const VELDEN = {
  VITE_NEON_DATA_API_URL: 'de Data API-URL van je Neon-branch (Connect → Data API)',
  VITE_NEON_AUTH_URL: 'de Auth URL van je Neon-branch (Connect → Auth)',
} as const

let gecached: Config | null = null

export function config(): Config {
  if (gecached) return gecached

  const ontbreekt = Object.entries(VELDEN)
    .filter(([sleutel]) => !import.meta.env[sleutel])
    .map(([sleutel, omschrijving]) => `${sleutel} — ${omschrijving}`)

  if (ontbreekt.length > 0) {
    throw new Error(
      `Er ontbreken waarden in app/.env.local:\n\n${ontbreekt.join('\n')}\n\n` +
      'Zie docs/setup.md.',
    )
  }

  gecached = {
    neonDataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL,
    neonAuthUrl: authBasis(),
  }
  return gecached
}

/**
 * Op de website loopt inloggen via /api/auth op het eigen domein (api/auth.ts).
 * Neon Auth zit op een ander domein, en Safari gooit een cookie van een ander
 * domein weg — in een app op het beginscherm altijd. Dan leek inloggen te
 * lukken en stond je meteen weer op het inlogscherm.
 *
 * De iOS-app gaat langs hetzelfde doorgeefluik, op het adres van de website.
 * Rechtstreeks naar Neon Auth lukt daar niet: die weigert de origin
 * capacitor://localhost ("Invalid origin"), en de webview gooit de cookie
 * net als Safari weg. Daarom staat CapacitorHttp aan (capacitor.config.ts):
 * verzoeken lopen dan via iOS zelf, met een eigen cookiepot en zonder CORS.
 *
 * Lokaal met `npm run dev` draaien de functies niet; daar gaat het
 * rechtstreeks naar Neon Auth.
 */
function authBasis(): string {
  if (Capacitor.isNativePlatform()) return `${WEBSITE}/api/auth`
  if (typeof window === 'undefined') return import.meta.env.VITE_NEON_AUTH_URL
  const { protocol, hostname, origin } = window.location
  if (protocol === 'https:' && hostname !== 'localhost') return `${origin}/api/auth`
  return import.meta.env.VITE_NEON_AUTH_URL
}
