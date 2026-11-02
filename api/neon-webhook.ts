/**
 * Verstuurt de mails van het inlogsysteem onder onze eigen naam.
 *
 * Neon Auth stuurt zijn eigen mail (Neon-huisstijl, afzender van Neon) en
 * laat de inhoud niet aanpassen. Zet je in de Neon-console onder Auth →
 * Configuration → Webhooks het event `send.magic_link` aan, dan slaat Neon
 * die mail over en roept deze functie aan. Wij sturen dan de mail van
 * Kookmaatje, via Resend, vanaf kookmaatje.eu.
 *
 * Dit is geen vrij toegankelijke route: elk verzoek heeft een handtekening
 * van Neon (Ed25519, detached JWS) die we tegen Neon's publieke sleutels
 * controleren. Zonder geldige handtekening gebeurt er niets.
 *
 * Alleen de herstelmail ("forget-password") is vormgegeven. Andere typen
 * (inloggen met een link, e-mail bevestigen) gebruikt de app niet; die geven
 * we een 200 zonder mail, zodat Neon niet blijft herhalen.
 *
 * Als dit faalt, mislukt "Wachtwoord vergeten" voor de gebruiker. Daarom 5xx
 * bij een fout van Resend (Neon probeert het dan nog twee keer).
 *
 * Omgevingsvariabelen op Vercel: RESEND_API_KEY, MAIL_AFZENDER (standaard
 * "Kookmaatje <noreply@kookmaatje.eu>"), NEON_AUTH_URL of VITE_NEON_AUTH_URL.
 * Het domein kookmaatje.eu moet bij Resend geverifieerd zijn (SPF/DKIM).
 */

import { createPublicKey, verify, type JsonWebKey as NodeJwk } from 'node:crypto'
import { wachtwoordMail } from '../lib/mail/wachtwoordmail.js'

/** Waar de herstellink heen gaat: de website, die ?token=… oppikt (Inloggen.tsx). */
const SITE = 'https://kookmaatje.eu'

interface Gebeurtenis {
  event_type?: string
  event_data?: { link_type?: string; token?: string; expires_at?: string }
  user?: { email?: string }
}

async function controleerHandtekening(ruw: string, headers: Headers, basis: string): Promise<void> {
  const handtekening = headers.get('x-neon-signature')
  const kid = headers.get('x-neon-signature-kid')
  const tijd = headers.get('x-neon-timestamp')
  if (!handtekening || !kid || !tijd) throw new Error('Handtekeningkoppen ontbreken')

  const jwks = (await (await fetch(`${basis.replace(/\/$/, '')}/.well-known/jwks.json`)).json()) as { keys: (JsonWebKey & { kid?: string })[] }
  const jwk = jwks.keys.find((k) => k.kid === kid)
  if (!jwk) throw new Error('Onbekende sleutel')

  const [kop, leeg, sig] = handtekening.split('.')
  if (leeg !== '' || !kop || !sig) throw new Error('Geen detached JWS')
  const lading = Buffer.from(ruw, 'utf8').toString('base64url')
  const invoer = `${kop}.${Buffer.from(`${tijd}.${lading}`, 'utf8').toString('base64url')}`
  const geldig = verify(null, Buffer.from(invoer), createPublicKey({ key: jwk as NodeJwk, format: 'jwk' }), Buffer.from(sig, 'base64url'))
  if (!geldig) throw new Error('Handtekening klopt niet')

  if (Math.abs(Date.now() - parseInt(tijd, 10)) > 5 * 60 * 1000) throw new Error('Verzoek is te oud')
}

export async function POST(request: Request): Promise<Response> {
  const basis = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL
  const sleutel = process.env.RESEND_API_KEY
  if (!basis || !sleutel) return new Response('Mail is niet ingesteld.', { status: 500 })

  const ruw = await request.text()
  try {
    await controleerHandtekening(ruw, request.headers, basis)
  } catch {
    return new Response('Ongeldige handtekening', { status: 401 })
  }

  const gebeurtenis = JSON.parse(ruw) as Gebeurtenis
  const { event_type: soort, event_data: data, user } = gebeurtenis
  if (soort !== 'send.magic_link' || data?.link_type !== 'forget-password' || !data.token || !user?.email) {
    return new Response('Niets te versturen', { status: 200 })
  }

  const verloopt = data.expires_at ? Math.round((Date.parse(data.expires_at) - Date.now()) / 60000) : 60
  const mail = wachtwoordMail(`${SITE}/?token=${encodeURIComponent(data.token)}`, Math.min(Math.max(verloopt, 1), 24 * 60))

  const antwoord = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${sleutel}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_AFZENDER ?? 'Kookmaatje <noreply@kookmaatje.eu>',
      to: user.email,
      subject: mail.onderwerp,
      html: mail.html,
      text: mail.tekst,
    }),
  })
  if (!antwoord.ok) {
    console.error('Resend weigerde de mail', antwoord.status, await antwoord.text())
    return new Response('Mail versturen mislukt', { status: 502 })
  }
  return new Response('ok', { status: 200 })
}
