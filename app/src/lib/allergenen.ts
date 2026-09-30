import { useQuery } from '@tanstack/react-query'
import { db } from './db'
import { ingredientKey } from './schaal'
import { useVoorkeuren } from './queries'
import type { AllergeenRegel, BoodschapItem } from './database.types'

/**
 * Allergieën (migratie 20260930230000_allergieen.sql). Je stelt ze één keer in
 * bij Instellingen; daarna gelden ze overal:
 *
 * - Weekmenu, Ontdekken, Vul mijn week en Ruil laten recepten weg met een
 *   allergeen zonder vervanger (recepten.allergenen_vast, bijgehouden door een
 *   trigger in de database).
 * - Het receptscherm zegt wat erin zit, wat vervangen wordt en van welke
 *   producten je het etiket moet checken.
 * - De boodschappenlijst krijgt de vervanger, zoals bij vega: per regel terug
 *   te zetten naar wat het recept vraagt.
 *
 * De regels staan in de database (allergeen_regel), zodat de trigger en de app
 * precies dezelfde patronen gebruiken.
 */

export const ALLERGENEN = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'koemelk', label: 'Koemelk' },
  { id: 'ei', label: 'Ei' },
  { id: 'noten', label: 'Noten' },
  { id: 'pinda', label: "Pinda's" },
  { id: 'vis', label: 'Vis' },
  { id: 'schaaldieren', label: 'Schaaldieren' },
  { id: 'soja', label: 'Soja' },
  { id: 'sesam', label: 'Sesam' },
] as const

export type Allergeen = (typeof ALLERGENEN)[number]['id']

/** "gluten", "koemelk", "pinda's" — klein, voor midden in een zin. */
export function allergeenNaam(id: string): string {
  return (ALLERGENEN.find((a) => a.id === id)?.label ?? id).toLowerCase()
}

/** "gluten", "gluten en noten", "gluten, ei en noten". */
export function opsomming(ids: readonly string[]): string {
  const namen = ids.map(allergeenNaam)
  return namen.length <= 1
    ? namen.join('')
    : `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`
}

/** Welke van jouw allergieën dit recept vast bevat (zonder vervanger). */
export function vastVoorJou(recept: { allergenen_vast?: string[] | null }, allergieen: readonly string[]): string[] {
  return (recept.allergenen_vast ?? []).filter((a) => allergieen.includes(a))
}

/**
 * Spiegel van public.allergeen_tekst: kleine letters, zonder accenten.
 * "(rijst)noedels" wordt "rijstnoedels"; een losse toelichting tussen haakjes
 * ("(of groentebouillon)") valt weg.
 */
export function allergeenTekst(naam: string): string {
  return naam
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(([a-z]+)\)([a-z])/g, '$1$2')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Treffer {
  allergeen: string
  /** Zeker erin, of alleen misschien (het etiket beslist). */
  zeker: boolean
  /** Wat er op de lijst kan komen; null als er geen vervanger is. */
  vervanger: string | null
}

/**
 * Welke allergenen er in één ingrediënt zitten. Zelfde logica als de trigger:
 * één zekere regel zonder vervanger maakt het allergeen vast; anders de
 * vervanger van de eerste zekere regel.
 */
export function treffers(naam: string, regels: readonly AllergeenRegel[]): Treffer[] {
  const tekst = allergeenTekst(naam)
  const perAllergeen = new Map<string, Treffer & { vast: boolean }>()
  for (const regel of regels) {
    if (!new RegExp(regel.patroon).test(tekst)) continue
    if (regel.uitzondering && new RegExp(regel.uitzondering).test(tekst)) continue
    const t = perAllergeen.get(regel.allergeen) ?? { allergeen: regel.allergeen, zeker: false, vervanger: null, vast: false }
    if (regel.zekerheid === 'bevat') {
      t.zeker = true
      if (!regel.vervanger) t.vast = true
      else if (!t.vervanger) t.vervanger = regel.vervanger
    }
    perAllergeen.set(regel.allergeen, t)
  }
  return [...perAllergeen.values()].map(({ allergeen, zeker, vervanger, vast }) => ({
    allergeen, zeker, vervanger: vast || !zeker ? null : vervanger,
  }))
}

/**
 * De vervanger voor jouw allergieën, of undefined. Alleen als élk van jouw
 * allergenen in dit ingrediënt te vervangen is: glutenvrije pasta helpt niet
 * als het om verse eierpasta gaat en je ook geen ei mag.
 */
export function vervangerVoor(
  naam: string,
  regels: readonly AllergeenRegel[],
  allergieen: readonly string[],
): string | undefined {
  const mijn = treffers(naam, regels).filter((t) => t.zeker && allergieen.includes(t.allergeen))
  if (mijn.length === 0 || mijn.some((t) => !t.vervanger)) return undefined
  return mijn[0].vervanger ?? undefined
}

export interface ReceptAllergie {
  /** Zit erin en is niet te vervangen. */
  bevat: { naam: string; allergenen: string[] }[]
  /** Gaat als vervanger op je lijst. */
  vervangen: { naam: string; vervanger: string }[]
  /** Samengesteld product: het etiket beslist. */
  etiket: { naam: string; allergenen: string[] }[]
}

/** Het blok op het receptscherm: alleen over jouw allergieën. */
export function receptAllergie(
  namen: readonly string[],
  regels: readonly AllergeenRegel[],
  allergieen: readonly string[],
): ReceptAllergie {
  const uit: ReceptAllergie = { bevat: [], vervangen: [], etiket: [] }
  for (const naam of namen) {
    const mijn = treffers(naam, regels).filter((t) => allergieen.includes(t.allergeen))
    const zeker = mijn.filter((t) => t.zeker)
    const vervanger = vervangerVoor(naam, regels, allergieen)
    if (vervanger) uit.vervangen.push({ naam, vervanger })
    else if (zeker.length > 0) uit.bevat.push({ naam, allergenen: zeker.map((t) => t.allergeen) })
    const twijfel = mijn.filter((t) => !t.zeker).map((t) => t.allergeen)
    if (twijfel.length > 0) uit.etiket.push({ naam, allergenen: twijfel })
  }
  return uit
}

export type AllergieKeuze = 'vervanger' | 'recept'

/** De rij die naar de winkel gaat: bij 'vervanger' de vervanger, verder ongewijzigd. */
export function metAllergieKeuze(
  item: BoodschapItem,
  keuze: AllergieKeuze,
  regels: readonly AllergeenRegel[],
  allergieen: readonly string[],
): BoodschapItem {
  const vervanger = keuze === 'vervanger' ? vervangerVoor(item.naam, regels, allergieen) : undefined
  if (!vervanger) return item
  return { ...item, naam: vervanger, ingredient_key: ingredientKey(vervanger) }
}

const OPSLAG = 'allergie-keuze'

export function leesAllergieKeuzes(): Record<string, AllergieKeuze> {
  try {
    return JSON.parse(localStorage.getItem(OPSLAG) ?? '{}') as Record<string, AllergieKeuze>
  } catch {
    return {}
  }
}

export function bewaarAllergieKeuzes(keuzes: Record<string, AllergieKeuze>): void {
  try {
    localStorage.setItem(OPSLAG, JSON.stringify(keuzes))
  } catch {
    // Privémodus of geblokkeerde opslag: dan geldt de keuze alleen deze sessie.
  }
}

/** Jouw allergieën; leeg zolang de voorkeuren laden of de kolom er nog niet is. */
const GEEN: string[] = []

export function useAllergieen(): string[] {
  return useVoorkeuren().data?.allergieen ?? GEEN
}

/** De regels uit de database. Veranderen alleen met een migratie. */
export function useAllergeenRegels(aan = true) {
  return useQuery({
    queryKey: ['allergeen-regels'],
    enabled: aan,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<AllergeenRegel[]> => {
      const { data, error } = await db.from('allergeen_regel').select('*').order('id')
      if (error) throw error
      return data as AllergeenRegel[]
    },
  })
}
