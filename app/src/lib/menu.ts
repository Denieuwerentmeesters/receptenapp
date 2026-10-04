import type { Ingredient, Recept } from './database.types'

/**
 * Zelf samenstellen: een menu dat Claude op verzoek maakt (keuken, aantal
 * personen, wensen). Dit bestand heeft de vorm van zo'n menu en de controle
 * erop; de server (api/samenstellen.ts) en de app gebruiken hetzelfde.
 *
 * Houd dit bestand vrij van imports uit de app (React, db, config): de
 * serverfunctie laadt het ook.
 */

/** De keuzechips van vraag 1. "Verras me" laat Claude zelf een keuken kiezen. */
export const VERRAS_ME = 'Verras me'
export const KEUKEN_KEUZES = [
  'Italiaans', 'Midden-Oosters', 'Thais', 'Mexicaans', 'Indiaas', 'Grieks', 'Hollands', VERRAS_ME,
] as const

export const MAX_PERSONEN = 30
export const MAX_WENSEN = 500
export const MAX_GERECHTEN = 6

export interface MenuGerecht {
  /** De plek in het menu: "Hoofdgerecht", "Salade", "Bijgerecht". */
  rol: string
  titel: string
  bereidingstijd_minuten: number | null
  tags: string[]
  /** Wat je vooraf kunt doen, in een paar woorden; null als er niets is. */
  vooraf: string | null
  ingredienten: Ingredient[]
  bereiding_nl: string[]
}

export interface DraaiboekRegel {
  /** "Dag ervoor", "Ochtend", "17:45". */
  wanneer: string
  wat: string
}

export interface Menu {
  /** De keuken van het menu; bij "Verras me" wat Claude koos. */
  keuken: string
  personen: number
  /** De wensen zoals Claude ze begreep, als korte labels ("vegetarisch", "keto"). */
  begrepen: string[]
  gerechten: MenuGerecht[]
  draaiboek: DraaiboekRegel[]
  opmerking: string | null
}

export interface SamenstelVerzoek {
  keuken: string
  personen: number
  wensen: string
  allergieen: string[]
  winkel: 'ah' | 'jumbo'
  /** Bij bijsturen: het menu dat er nu staat… */
  vorig?: Menu
  /** …met wat er anders moet ("minder pittig")… */
  wijziging?: string
  /** …of het gerecht (plek in het menu) dat een ander voorstel moet krijgen. */
  vervang?: number
}

/** Wat de functie regel voor regel terugstuurt terwijl Claude schrijft. */
export type MenuGebeurtenis =
  /** `aantal`: hoeveel gerechten er komen, voor de lege kaarten tijdens het wachten. */
  | { soort: 'kop'; keuken: string; begrepen: string[]; aantal: number }
  | { soort: 'gerecht'; index: number; gerecht: MenuGerecht }
  | { soort: 'klaar'; menu: Menu; samenstellingId: string | null }
  | { soort: 'fout'; fout: string }

const tekst = (w: unknown): string => (typeof w === 'string' ? w.replace(/\s+/g, ' ').trim() : '')
const teksten = (w: unknown): string[] => (Array.isArray(w) ? w.map(tekst).filter(Boolean) : [])

function ingredient(ruw: unknown): Ingredient | null {
  if (!ruw || typeof ruw !== 'object') return null
  const o = ruw as Record<string, unknown>
  const naam = tekst(o.naam)
  if (!naam) return null
  // Het schema vraagt een getal als tekst; een model geeft soms toch een getal.
  const hoeveelheid = typeof o.hoeveelheid === 'number' ? String(o.hoeveelheid) : tekst(o.hoeveelheid)
  return { naam, hoeveelheid: hoeveelheid || null, eenheid: tekst(o.eenheid) || null }
}

/**
 * Maakt van wat het model teruggaf een gerecht waar de app op kan bouwen, of
 * null als het geen bruikbaar recept is (geen titel, ingrediënten of stappen).
 * Ook voor het vorige menu dat de app terugstuurt bij bijsturen: dat komt van
 * buiten en mag niet blind de prompt in.
 */
export function leesGerecht(ruw: unknown): MenuGerecht | null {
  if (!ruw || typeof ruw !== 'object') return null
  const o = ruw as Record<string, unknown>
  const titel = tekst(o.titel)
  const ingredienten = (Array.isArray(o.ingredienten) ? o.ingredienten : [])
    .map(ingredient).filter((i): i is Ingredient => i !== null)
  const bereiding_nl = teksten(o.bereiding_nl)
  if (!titel || ingredienten.length === 0 || bereiding_nl.length === 0) return null
  const tijd = Number(o.bereidingstijd_minuten)
  return {
    rol: tekst(o.rol) || 'Gerecht',
    titel,
    bereidingstijd_minuten: Number.isFinite(tijd) && tijd > 0 ? Math.round(tijd) : null,
    tags: teksten(o.tags).map((t) => t.toLowerCase()),
    vooraf: tekst(o.vooraf) || null,
    ingredienten,
    bereiding_nl,
  }
}

export function leesDraaiboek(ruw: unknown): DraaiboekRegel[] {
  if (!Array.isArray(ruw)) return []
  return ruw.flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const wanneer = tekst(o.wanneer)
    const wat = tekst(o.wat)
    return wanneer && wat ? [{ wanneer, wat }] : []
  })
}

/** Eén regel uit het plan dat Claude maakt voordat het de recepten schrijft. */
export interface PlanRegel {
  rol: string
  titel: string
}

export function leesPlan(ruw: unknown): PlanRegel[] {
  if (!Array.isArray(ruw)) return []
  return ruw.flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const titel = tekst(o.titel)
    return titel ? [{ rol: tekst(o.rol) || 'Gerecht', titel }] : []
  }).slice(0, MAX_GERECHTEN)
}

const zelfde = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Wat wel in het plan staat maar niet is uitgeschreven. Alleen als er ook
 * echt te weinig gerechten zijn: een gerecht dat onderweg een iets andere
 * naam kreeg ontbreekt niet.
 */
export function ontbrekend(plan: PlanRegel[], gerechten: MenuGerecht[]): PlanRegel[] {
  const tekort = plan.length - gerechten.length
  if (tekort <= 0) return []
  return plan.filter((p) => !gerechten.some((g) => zelfde(g.titel, p.titel))).slice(0, tekort)
}

/**
 * Zet nagekomen gerechten op hun plek uit het plan (het hoofdgerecht vooraan,
 * niet achteraan omdat het later kwam). Wat nergens bij past sluit achteraan.
 */
export function inPlanVolgorde(plan: PlanRegel[], gerechten: MenuGerecht[], nagekomen: MenuGerecht[]): MenuGerecht[] {
  const over = [...gerechten]
  const later = [...nagekomen]
  const uit: MenuGerecht[] = []
  for (const p of plan) {
    const i = over.findIndex((g) => zelfde(g.titel, p.titel))
    if (i >= 0) uit.push(...over.splice(i, 1))
    else {
      const j = later.findIndex((g) => zelfde(g.titel, p.titel))
      if (j >= 0) uit.push(...later.splice(j, 1))
      else if (later.length > 0 && !gerechten.some((g) => zelfde(g.titel, p.titel))) {
        // Het nagekomen gerecht heet net anders: neem het eerste met dezelfde rol, of gewoon het eerste.
        const k = Math.max(0, later.findIndex((g) => zelfde(g.rol, p.rol)))
        uit.push(...later.splice(k, 1))
      }
    }
  }
  return [...uit, ...over, ...later].slice(0, MAX_GERECHTEN)
}

/** Een heel menu nalopen; null als er geen enkel bruikbaar gerecht in zit. */
export function leesMenu(ruw: unknown, personen: number, keuken: string): Menu | null {
  if (!ruw || typeof ruw !== 'object') return null
  const o = ruw as Record<string, unknown>
  const gerechten = (Array.isArray(o.gerechten) ? o.gerechten : [])
    .map(leesGerecht).filter((g): g is MenuGerecht => g !== null).slice(0, MAX_GERECHTEN)
  if (gerechten.length === 0) return null
  return {
    keuken: tekst(o.keuken) || keuken,
    personen,
    begrepen: teksten(o.begrepen).slice(0, 8),
    gerechten,
    draaiboek: leesDraaiboek(o.draaiboek),
    opmerking: tekst(o.opmerking) || null,
  }
}

/** "Midden-Oosters voor 10": de naam van het menu, in de app en op de lijst. */
export function menuNaam(menu: Pick<Menu, 'keuken' | 'personen'>): string {
  return `${menu.keuken} voor ${menu.personen}`
}

/**
 * Voor hoeveel personen een recept standaard getoond wordt en op de lijst
 * gaat. Een samengesteld menu is voor het aantal dat je erbij opgaf (tien
 * gasten), niet voor je huishouden.
 */
export function standaardPersonen(
  recept: Pick<Recept, 'bron_type' | 'personen'> | undefined,
  voorkeur: number,
): number {
  return recept?.bron_type === 'samengesteld' ? recept.personen : voorkeur
}
