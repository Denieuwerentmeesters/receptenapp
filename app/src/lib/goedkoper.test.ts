import { describe, expect, test } from 'vitest'
import { alternatieven, goedkoperOpties, metGoedkoperKeuze } from './goedkoper'
import { voegSamen } from './lijst'
import type { Winkel } from './winkel'
import { ingredientKey } from './schaal'
import type { BoodschapItem } from './database.types'

const P: Record<string, { prijs: number; inhoud: number }> = {
  parmezaan: { prijs: 6.39, inhoud: 165 },
  'grana padano': { prijs: 3.49, inhoud: 200 },
  'parmezaan zakje': { prijs: 1.99, inhoud: 40 },
}
const winkel = {
  naam: 'AH',
  productVoor: (i: { ingredient_key: string }) => (P[i.ingredient_key] ? i.ingredient_key : null),
  verpakkingVoor: (i: { ingredient_key: string }) => P[i.ingredient_key] && { inhoud: P[i.ingredient_key].inhoud, eenheid: 'g' as const },
  prijsVoor: (i: { ingredient_key: string }) => P[i.ingredient_key]?.prijs,
} as unknown as Winkel
const regel = (g: number) => voegSamen([{
  id: '1', user_id: '', week_start_datum: '', naam: 'parmezaan', ingredient_key: ingredientKey('parmezaan'),
  hoeveelheid: g, eenheid: 'g', categorie: null, bron_type: 'recept', bron_recept_id: null, is_afgevinkt: false, aangemaakt_op: '',
} as BoodschapItem])[0]

describe('goedkoper alternatief', () => {
  test('parmezaan heeft alternatieven, een ander product niet', () => {
    expect(alternatieven('parmezaan').length).toBe(2)
    expect(alternatieven('kipfilet')).toEqual([])
  })
  test('100 g: Grana scheelt € 2,90, drie zakjes (€ 5,97) zijn duurder en komen er niet in', () => {
    const o = goedkoperOpties(regel(100), winkel)
    expect(o.map((x) => x.key)).toEqual(['grana padano'])
    expect(o[0].scheelt).toBe(2.9)
  })
  test('30 g: het zakje (€ 1,99) scheelt het meest', () => {
    expect(goedkoperOpties(regel(30), winkel)[0].key).toBe('parmezaan zakje')
  })
  test('de keuze verandert de sleutel van de rij', () => {
    const r = regel(100).voorbeeld
    expect(metGoedkoperKeuze(r, 'grana padano').ingredient_key).toBe('grana padano')
    expect(metGoedkoperKeuze(r, 'recept')).toBe(r)
  })
})
