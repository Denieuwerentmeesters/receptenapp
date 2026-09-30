/**
 * Configuratie uit .env.local, met een nette Nederlandse fout als er iets mist.
 *
 * Belangrijk: dit gooit pas als je de waarden opvraagt, niet bij het importeren
 * van de module. Zou het bij import gooien, dan valt de hele bundle om en zie je
 * een wit scherm in plaats van het foutscherm dat vertelt wát er mist.
 */

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
    neonAuthUrl: authViaEigenDomein() ? `${window.location.origin}/api/auth` : import.meta.env.VITE_NEON_AUTH_URL,
  }
  return gecached
}

/**
 * Op de website loopt inloggen via /api/auth op het eigen domein (api/auth.ts).
 * Neon Auth zit op een ander domein, en Safari gooit een cookie van een ander
 * domein weg — in een app op het beginscherm altijd. Dan leek inloggen te
 * lukken en stond je meteen weer op het inlogscherm.
 *
 * Niet in de iOS-app (daar is het domein capacitor://localhost en is er geen
 * /api) en niet lokaal met `npm run dev` (daar draaien de functies niet).
 */
function authViaEigenDomein(): boolean {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  return protocol === 'https:' && hostname !== 'localhost'
}
