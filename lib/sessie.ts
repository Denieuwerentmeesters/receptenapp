/**
 * Wie er ingelogd is, voor serverless functies die met DATABASE_URL of een
 * betaalde sleutel werken en dus zelf moeten weten voor wie.
 *
 * Het user-id komt alleen uit de sessie die Neon Auth bevestigt, nooit uit het
 * verzoek zelf.
 */

/** Vraagt Neon Auth wie er bij deze cookie hoort. Null als er geen geldige sessie is. */
export async function sessieUserId(basis: string, cookie: string | null, origin: string): Promise<string | null> {
  if (!cookie) return null
  const respons = await fetch(`${basis.replace(/\/$/, '')}/get-session`, { headers: { cookie, origin } })
  if (!respons.ok) return null
  const sessie = (await respons.json().catch(() => null)) as { user?: { id?: string } } | null
  return sessie?.user?.id ?? null
}
