/**
 * Taalkeuze: Nederlands (standaard) of Engels.
 *
 * De Nederlandse tekst is de sleutel: `t('Mijn recepten')`. Staat er een
 * Engelse vertaling in `EN`, dan krijg je die; anders blijft het Nederlands,
 * zodat een ontbrekende vertaling nooit een lege plek geeft. Variabelen gaan
 * met {naam}: `t('Van je {n} avonden', { n: 4 })`.
 *
 * De keuze staat in localStorage (`kookmaatje-taal`) en niet in de database:
 * zo werkt hij ook in de onboarding vóór het eerste opslaan en zonder
 * migratie. Verandert de taal, dan monteert `TaalGrens` de app opnieuw.
 */
import { useSyncExternalStore } from 'react'
import { EN } from './en'

export type Taal = 'nl' | 'en'
const SLEUTEL = 'kookmaatje-taal'
const luisteraars = new Set<() => void>()

function beginTaal(): Taal {
  // Server en tests hebben geen scherm: Nederlands.
  if (typeof window === 'undefined') return 'nl'
  try {
    const opgeslagen = window.localStorage.getItem(SLEUTEL)
    if (opgeslagen === 'nl' || opgeslagen === 'en') return opgeslagen
  } catch { /* privémodus: standaard */ }
  // Eerste keer: een toestel dat niet in het Nederlands staat krijgt Engels.
  const toestel = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? 'nl' : 'nl'
  return toestel.startsWith('nl') ? 'nl' : 'en'
}

let huidig: Taal = beginTaal()

export function taal(): Taal {
  return huidig
}

export function zetTaal(nieuw: Taal): void {
  if (nieuw === huidig) return
  huidig = nieuw
  try { window.localStorage.setItem(SLEUTEL, nieuw) } catch { /* niet erg */ }
  if (typeof document !== 'undefined') document.documentElement.lang = nieuw
  luisteraars.forEach((l) => l())
}

export function useTaal(): Taal {
  return useSyncExternalStore(
    (cb) => { luisteraars.add(cb); return () => { luisteraars.delete(cb) } },
    taal,
  )
}

type Variabelen = Record<string, string | number>

export function t(nl: string, variabelen?: Variabelen): string {
  const tekst = huidig === 'en' ? (EN[nl] ?? nl) : nl
  if (!variabelen) return tekst
  return tekst.replace(/\{(\w+)\}/g, (m, k: string) => (k in variabelen ? String(variabelen[k]) : m))
}

/** Datums en getallen in de taal van de gebruiker. */
export function locale(): string {
  return huidig === 'en' ? 'en-GB' : 'nl-NL'
}

if (typeof document !== 'undefined') document.documentElement.lang = huidig
