import type { Recept } from './database.types'
import { t } from './taal'

/**
 * Dieetfilters. Vegetarisch is de tag op het recept; de andere vier leidt de
 * database af uit de ingrediënten (recepten.dieet, zie migratie
 * 20261001200000_dieet.sql). Koolhydraatarm en keto zijn een schatting: tot
 * 25 en tot 12 gram koolhydraten per persoon.
 */
export type Dieet = 'vegetarisch' | 'vegan' | 'pescotarisch' | 'koolhydraatarm' | 'keto'

/**
 * Binnen een groep kies je er één: vegan is al vegetarisch, keto is al
 * koolhydraatarm. Tussen de groepen combineer je: vegetarisch én koolhydraatarm.
 */
// `label` is een getter: de taal kan wisselen, dus de vertaling gebeurt bij het lezen.
export const DIETEN: { id: Dieet; label: string; groep: 'dierlijk' | 'koolhydraten' }[] = [
  { id: 'vegetarisch', get label() { return t('Vegetarisch') }, groep: 'dierlijk' },
  { id: 'vegan', get label() { return t('Vegan') }, groep: 'dierlijk' },
  { id: 'pescotarisch', get label() { return t('Pescotarisch') }, groep: 'dierlijk' },
  { id: 'koolhydraatarm', get label() { return t('Koolhydraatarm') }, groep: 'koolhydraten' },
  { id: 'keto', get label() { return t('Keto') }, groep: 'koolhydraten' },
]

export function pastBijDieet(recept: Pick<Recept, 'tags' | 'dieet'>, dieet: Dieet): boolean {
  return dieet === 'vegetarisch'
    ? recept.tags.includes('vegetarisch')
    : (recept.dieet ?? []).includes(dieet)
}

/** Zet een dieet aan of uit; aanzetten haalt de andere uit dezelfde groep weg. */
export function wisselDieet(gekozen: Dieet[], dieet: Dieet): Dieet[] {
  if (gekozen.includes(dieet)) return gekozen.filter((d) => d !== dieet)
  const groep = DIETEN.find((d) => d.id === dieet)?.groep
  return [...gekozen.filter((d) => DIETEN.find((x) => x.id === d)?.groep !== groep), dieet]
}

/**
 * Wat je achter de keuken zet: het strengste label per groep. Pescotarisch
 * noemen we niet — dat is elk vegetarisch recept ook.
 */
export function dieetLabels(recept: Pick<Recept, 'tags' | 'dieet'>): string[] {
  const dieet = recept.dieet ?? []
  return [
    dieet.includes('vegan') ? 'vegan' : recept.tags.includes('vegetarisch') ? 'vegetarisch' : null,
    dieet.includes('keto') ? 'keto' : dieet.includes('koolhydraatarm') ? 'koolhydraatarm' : null,
  ].filter((l): l is string => l !== null)
}
