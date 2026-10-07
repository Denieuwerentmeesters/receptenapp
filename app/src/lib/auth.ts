import { createAuthClient, type VanillaBetterAuthClient } from '@neondatabase/auth'
import { Capacitor } from '@capacitor/core'
import { WEBSITE, config } from './config'

/**
 * Identiteit via Neon Auth — dezelfde dienst als de database, geen tweede account.
 *
 * E-mail en wachtwoord. Neon Auth biedt in de managed variant geen anonieme
 * aanmelding en geen e-mailcode; wat er wel is, is magic link en e-mail met
 * wachtwoord. Magic link zou op de telefoon Universal Links vragen — de link uit
 * je mail moet de app kunnen openen, en dat vereist een configuratiebestand op
 * een eigen domein. Een wachtwoord werkt overal meteen, ook in de webview.
 *
 * Je logt één keer per toestel in; daarna onthoudt de client de sessie.
 *
 * Waarom niet anoniem, zoals tech-stack §3 voorstelde: dat kan Neon Auth niet,
 * en het alternatief was een tweede dienst erbij halen puur voor het uitgeven
 * van een token. Eén keer inloggen is goedkoper — en het lost meteen twee dingen
 * op die het plan zelf als risico noemde (§3.5): je raakt je geschiedenis niet
 * kwijt als je de app verwijdert, en je telefoon en laptop zijn dezelfde
 * gebruiker.
 *
 * De user-id komt als `sub` in de JWT terecht en is in Postgres te lezen als
 * auth.user_id(); daar hangt alle RLS aan.
 */

// createAuthClient geeft een unie terug over alle adapters. Wij gebruiken de
// standaard (vanilla Better Auth), dus pinnen we het type vast.
type Client = VanillaBetterAuthClient & { getJWTToken?: () => Promise<string | null> }

let client: Client | null = null

/** Lui, zodat een ontbrekende config een nette foutmelding wordt in plaats van een wit scherm. */
function authClient(): Client {
  client ??= createAuthClient(config().neonAuthUrl) as Client
  return client
}

export interface Sessie {
  userId: string
  email: string
}

/** De huidige sessie, of null als je nog niet bent ingelogd. */
export async function huidigeSessie(): Promise<Sessie | null> {
  const { data } = await authClient().getSession()
  if (!data?.user) return null
  return { userId: data.user.id, email: data.user.email }
}

/** Logt in met een bestaand account. */
export async function logIn(email: string, wachtwoord: string): Promise<Sessie> {
  const { data, error } = await authClient().signIn.email({
    email: email.trim().toLowerCase(),
    password: wachtwoord,
  })
  if (error || !data?.user) {
    throw new Error(vertaal(error?.message) ?? 'Inloggen lukte niet.')
  }
  return { userId: data.user.id, email: data.user.email }
}

/** Maakt een nieuw account aan en logt meteen in. */
export async function maakAccount(email: string, wachtwoord: string): Promise<Sessie> {
  const schoon = email.trim().toLowerCase()
  const { data, error } = await authClient().signUp.email({
    email: schoon,
    password: wachtwoord,
    // Better Auth wil een naam; die vraagt de app niet, dus leiden we 'm af.
    name: schoon.split('@')[0],
  })
  if (error || !data?.user) {
    throw new Error(vertaal(error?.message) ?? 'Account aanmaken lukte niet.')
  }
  return { userId: data.user.id, email: data.user.email }
}

/** Better Auth antwoordt in het Engels; de bekende gevallen vertalen we. */
function vertaal(bericht: string | undefined): string | undefined {
  if (!bericht) return undefined
  const l = bericht.toLowerCase()
  if (l.includes('invalid') && l.includes('password')) return 'E-mailadres of wachtwoord klopt niet.'
  if (l.includes('user not found')) return 'Er is nog geen account met dit e-mailadres.'
  if (l.includes('already exists')) return 'Er bestaat al een account met dit e-mailadres.'
  if (l.includes('password') && l.includes('short')) return 'Kies een wachtwoord van minstens 8 tekens.'
  return bericht
}

export async function logUit(): Promise<void> {
  await authClient().signOut()
  client = null
  tokenCache = null
  // Alles op dit toestel hoort bij jou, niet bij wie hierna inlogt: het menu
  // dat je aan het samenstellen was, en de kopie van je voorkeuren en je week
  // waarmee de app snel opent. Blijft die kopie staan, dan ziet een nieuw
  // account even jouw voorkeuren en slaat het daardoor de onboarding over.
  try { localStorage.clear() } catch { /* geen opslag: niets op te ruimen */ }
}

/**
 * Verwijdert je account en alles wat erbij hoort (api/account-verwijderen.ts).
 * Daarna is ook de sessie weg; de opslag op dit toestel ruimen we zelf op,
 * anders staat je weekmenu nog in de cache van de volgende gebruiker.
 */
export async function verwijderAccount(): Promise<void> {
  const endpoint = Capacitor.isNativePlatform() ? `${WEBSITE}/api/account-verwijderen` : '/api/account-verwijderen'
  const respons = await fetch(endpoint, { method: 'POST', credentials: 'include' })
  if (!respons.ok) {
    const { fout } = (await respons.json().catch(() => ({}))) as { fout?: string }
    throw new Error(fout ?? 'Verwijderen lukte niet. Probeer het later opnieuw.')
  }
  await authClient().signOut().catch(() => undefined)
  client = null
  tokenCache = null
  try { localStorage.clear() } catch { /* geen opslag: niets op te ruimen */ }
}

let tokenCache: { token: string; verlooptOp: number } | null = null

/**
 * Token-provider voor de Neon Data API.
 *
 * Bewust een eigen fetch in plaats van client.getJWTToken(): die methode uit
 * @neondatabase/auth (beta) faalt met `user_not_found`, terwijl hetzelfde
 * /token-endpoint met dezelfde sessiecookie wél een geldige JWT teruggeeft.
 * Zodra dat in de package gerepareerd is kan dit terug naar getJWTToken().
 *
 * credentials: 'include' is essentieel — de auth-server staat op een ander
 * domein dan de app, dus zonder dat gaat de sessiecookie niet mee.
 *
 * De JWT's van Neon leven ongeveer 15 minuten; we hergebruiken 'm tot een halve
 * minuut voor het einde en halen anders een verse op.
 */
export async function haalToken(): Promise<string | null> {
  const nu = Date.now()
  if (tokenCache && tokenCache.verlooptOp - 30_000 > nu) return tokenCache.token

  const antwoord = await fetch(`${config().neonAuthUrl}/token`, { credentials: 'include' })
  if (!antwoord.ok) return null

  const { token } = (await antwoord.json()) as { token?: string }
  if (!token) return null

  // exp uit de payload; kan die niet gelezen worden, dan vertrouwen we op 5 minuten.
  let verlooptOp = nu + 5 * 60_000
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
    if (payload.exp) verlooptOp = payload.exp * 1000
  } catch {
    /* standaardwaarde blijft staan */
  }

  tokenCache = { token, verlooptOp }
  return token
}

export async function huidigeUserId(): Promise<string> {
  const sessie = await huidigeSessie()
  if (!sessie) throw new Error('Niet ingelogd.')
  return sessie.userId
}
