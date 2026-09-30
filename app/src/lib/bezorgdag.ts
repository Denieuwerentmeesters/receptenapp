import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useVoorkeuren } from './queries'
import { eersteBezorgdag, isoDatum } from './bonusRegels'

/**
 * Op welke dag je boodschappen er zijn: de peildatum voor alles rond bonus
 * (label, filterchip, lijst, Vul mijn week).
 *
 * - Zelf halen (Instellingen): vandaag.
 * - Anders de dag die je bij de mandjeknop koos, als die nog kan.
 * - Anders de eerste bezorgdag: morgen, of maandag als morgen zondag is.
 *
 * De gekozen dag bewaren we op dit toestel; de app weet niet wat je bij AH
 * of Jumbo kiest, dat gebeurt na de mandjeknop in hun eigen app.
 */

interface Bezorgkeuze {
  gekozen: string | null
  kies: (dag: string | null) => void
}

export const useBezorgkeuze = create<Bezorgkeuze>()(persist(
  (set) => ({ gekozen: null, kies: (dag) => set({ gekozen: dag }) }),
  { name: 'receptenapp-bezorgdag', storage: createJSONStorage(() => localStorage) },
))

export interface Peildatum {
  /** De dag waarop de bonus moet gelden (JJJJ-MM-DD). */
  peil: string
  /** De vroegst mogelijke bezorgdag. */
  eerste: string
  zelfHalen: boolean
  /** Koos je zelf een latere dag? */
  gekozen: boolean
}

export function bepaalPeildatum(vandaag: Date, zelfHalen: boolean, gekozen: string | null): Peildatum {
  const eerste = isoDatum(eersteBezorgdag(vandaag))
  if (zelfHalen) return { peil: isoDatum(vandaag), eerste, zelfHalen, gekozen: false }
  const geldig = gekozen !== null && gekozen >= eerste
  return { peil: geldig ? gekozen : eerste, eerste, zelfHalen, gekozen: geldig && gekozen !== eerste }
}

export function usePeildatum(): Peildatum {
  const voorkeuren = useVoorkeuren()
  const gekozen = useBezorgkeuze((s) => s.gekozen)
  return bepaalPeildatum(new Date(), voorkeuren.data?.zelf_halen ?? false, gekozen)
}

/** De dagen die je bij de mandjeknop kunt kiezen: de komende week, zonder zondag. */
export function bezorgdagen(vandaag: Date = new Date(), aantal = 7): string[] {
  const uit: string[] = []
  const d = eersteBezorgdag(vandaag)
  while (uit.length < aantal) {
    if (d.getDay() !== 0) uit.push(isoDatum(d))
    d.setDate(d.getDate() + 1)
  }
  return uit
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

/** "vandaag", "morgen" of "maandag 5 oktober". */
export function dagLabel(iso: string, vandaag: Date = new Date()): string {
  const d = new Date(`${iso}T12:00:00`)
  if (iso === isoDatum(vandaag)) return 'vandaag'
  const morgen = new Date(vandaag)
  morgen.setDate(morgen.getDate() + 1)
  if (iso === isoDatum(morgen)) return 'morgen'
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('nl-NL', { month: 'long' })}`
}
