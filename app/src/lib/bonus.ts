import { useQuery } from '@tanstack/react-query'
import { db } from './db'
import { zoekProduct } from './ah'
import { altijdInHuis } from './altijdInHuis'
import { isDroogKruid } from './kruiden'
import { schatIngredient } from './prijsschatting'
import { ingredientKey } from './schaal'
import { canoniek } from './synoniemen'
import { schapVoor } from './winkelindeling'
import { useVoorkeuren } from './queries'
import type { Ingredient } from './database.types'

/**
 * Bonus en aanbiedingen (plan "gemak en bonus", onderdeel 5). De acties komen
 * elke nacht uit PrijsProfeet in bonus_actie (api/bonus.ts), al gekoppeld aan
 * een ingredient_key.
 *
 * Of een actie telt, hangt af van de bezorgdag, niet van vandaag: AH en Jumbo
 * rekenen de bonus van de week waarin bezorgd wordt. Op dezelfde dag en op
 * zondag wordt niet bezorgd, dus de peildatum is morgen, of maandag als
 * morgen zondag is. Op zaterdag en zondag zie je daardoor al de bonus van
 * volgende week.
 */

/** Bronvermelding: verplicht onder alle bonusinformatie (PrijsProfeet, API-voorwaarden art. 6). */
export const BONUS_BRON = {
  kort: 'Aanbiedingen via PrijsProfeet',
  url: 'https://www.prijsprofeet.nl',
  uitleg: 'Bonus en aanbiedingen komen van PrijsProfeet. Prijzen zijn indicatief; de prijs in je mandje bij AH of Jumbo is leidend.',
}

export interface BonusActie {
  ingredient_key: string
  titel: string
  prijs_nu: number | null
  prijs_was: number | null
  mechanisme: string | null
  geldig_van: string
  geldig_tot: string
}

/** Per ingredient_key de acties die op de bezorgdag gelden. */
export type BonusMap = Record<string, BonusActie[]>

/** Eerste mogelijke bezorgdag: morgen, en valt morgen op zondag, dan maandag. */
export function eersteBezorgdag(vandaag: Date = new Date()): Date {
  const d = new Date(vandaag)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return d
}

/** 2026-10-01, in lokale tijd (toISOString zou om middernacht een dag verspringen). */
export function isoDatum(d: Date): string {
  const tw = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${tw(d.getMonth() + 1)}-${tw(d.getDate())}`
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

/** "t/m zondag" binnen een week, anders "t/m 12 oktober". */
export function totTekst(geldigTot: string, vandaag: Date = new Date()): string {
  const tot = new Date(`${geldigTot}T12:00:00`)
  const dagen = Math.round((tot.getTime() - vandaag.getTime()) / 86_400_000)
  if (dagen >= 0 && dagen < 7) return `t/m ${DAGEN[tot.getDay()]}`
  return `t/m ${tot.getDate()} ${tot.toLocaleDateString('nl-NL', { month: 'long' })}`
}

/** Bonus voor de winkel uit je voorkeuren, op de eerste bezorgdag. */
export function useBonus() {
  const voorkeuren = useVoorkeuren()
  const winkel = voorkeuren.data?.voorkeurswinkel ?? 'ah'
  const peil = isoDatum(eersteBezorgdag())
  return useQuery({
    queryKey: ['bonus', winkel, peil],
    enabled: Boolean(voorkeuren.data),
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<BonusMap> => {
      const { data, error } = await db.from('bonus_actie')
        .select('ingredient_key, titel, prijs_nu, prijs_was, mechanisme, geldig_van, geldig_tot')
        .eq('winkel', winkel).lte('geldig_van', peil).gte('geldig_tot', peil)
      if (error) throw error
      const uit: BonusMap = {}
      for (const rij of data as BonusActie[]) {
        const key = canoniek(rij.ingredient_key)
        ;(uit[key] ??= []).push({ ...rij, prijs_nu: rij.prijs_nu === null ? null : Number(rij.prijs_nu), prijs_was: rij.prijs_was === null ? null : Number(rij.prijs_was) })
      }
      return uit
    },
  })
}

/** De acties voor één ingrediënt, met dezelfde zoekregels als de mandjelink. */
export function bonusVoor(naam: string, bonus: BonusMap | undefined, key = ingredientKey(naam)): BonusActie[] | undefined {
  if (!bonus) return undefined
  return zoekProduct({ ingredient_key: key, naam }, bonus)
}

/** Het ingrediënt waar een recept om draait: vlees of vis, anders het duurste. */
export function hoofdingredient(ingredienten: Ingredient[]): Ingredient | null {
  let beste: Ingredient | null = null
  let besteScore = -1
  for (const ing of ingredienten) {
    const key = canoniek(ingredientKey(ing.naam))
    if (!key || altijdInHuis(key) || isDroogKruid(key)) continue
    const schap = schapVoor(key)
    const score = (schap === 'Vlees' || schap === 'Vis' ? 1000 : 0) + (schatIngredient(ing) ?? 0)
    if (score > besteScore) { beste = ing; besteScore = score }
  }
  return beste
}

/** Is het hoofdingrediënt van dit recept in de bonus? Dan het ingrediënt en de acties. */
export function receptBonus(ingredienten: Ingredient[], bonus: BonusMap | undefined): { naam: string; acties: BonusActie[] } | null {
  const hoofd = hoofdingredient(ingredienten)
  if (!hoofd) return null
  const acties = bonusVoor(hoofd.naam, bonus)
  return acties?.length ? { naam: hoofd.naam, acties } : null
}

/** "Kipfilet 1 kg · 2e halve prijs t/m zondag · € 4,99 (was € 6,49)" */
export function actieTekst(a: BonusActie): string {
  const prijs = a.prijs_nu !== null
    ? ` · € ${a.prijs_nu.toFixed(2).replace('.', ',')}${a.prijs_was !== null && a.prijs_was > a.prijs_nu ? ` (was € ${a.prijs_was.toFixed(2).replace('.', ',')})` : ''}`
    : ''
  return `${a.titel}${a.mechanisme ? ` · ${a.mechanisme}` : ''} ${totTekst(a.geldig_tot)}${prijs}`
}
