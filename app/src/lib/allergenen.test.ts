import { describe, expect, test } from 'vitest'
import { allergeenTekst, opsomming, receptAllergie, treffers, vervangerVoor } from './allergenen'
import type { AllergeenRegel } from './database.types'
import migratie from '../../../db/migrations/20260930233000_allergieen.sql?raw'

/**
 * De echte regels, uit de migratie gelezen: zo testen we ook dat elk patroon
 * in JavaScript hetzelfde doet als in Postgres (en überhaupt compileert).
 */
function leesRegels(): AllergeenRegel[] {
  const sql = migratie
  const tekst = String.raw`'((?:[^']|'')*)'`
  const waarde = String.raw`(null|${tekst})`
  const rij = new RegExp(String.raw`^  \(${tekst}, ${tekst}, ${waarde}, ${tekst}, ${waarde}\),?;?$`, 'gm')
  const los = (s: string | undefined) => (s === undefined ? null : s.replace(/''/g, "'"))
  return [...sql.matchAll(rij)].map((m, i) => ({
    id: i + 1,
    allergeen: m[1],
    patroon: los(m[2])!,
    uitzondering: m[3] === 'null' ? null : los(m[4]),
    zekerheid: m[5] as 'bevat' | 'mogelijk',
    vervanger: m[6] === 'null' ? null : los(m[7]),
  }))
}

const regels = leesRegels()
const allergenenIn = (naam: string) => treffers(naam, regels).filter((t) => t.zeker).map((t) => t.allergeen).sort()

describe('regels uit de migratie', () => {
  test('ze zijn allemaal gelezen en compileren', () => {
    expect(regels.length).toBeGreaterThan(40)
    for (const r of regels) {
      expect(() => new RegExp(r.patroon)).not.toThrow()
      const uitzondering = r.uitzondering
      if (uitzondering) expect(() => new RegExp(uitzondering)).not.toThrow()
    }
  })
})

describe('allergeenTekst', () => {
  test('accenten weg, toelichting weg, vastgeplakte haakjes blijven', () => {
    expect(allergeenTekst('Crème fraîche')).toBe('creme fraiche')
    expect(allergeenTekst('(rijst)noedels')).toBe('rijstnoedels')
    expect(allergeenTekst('rosbief (of gerookte zalm als alternatief)')).toBe('rosbief')
  })
})

describe('treffers', () => {
  test('zekere allergenen', () => {
    expect(allergenenIn('cashewnoten')).toEqual(['noten'])
    expect(allergenenIn("pinda's")).toEqual(['pinda'])
    expect(allergenenIn('sojasaus')).toEqual(['gluten', 'soja'])
    expect(allergenenIn('eieren')).toEqual(['ei'])
    expect(allergenenIn('tagliatelle')).toEqual(['ei', 'gluten'])
    expect(allergenenIn('parmezaanse kaas')).toEqual(['koemelk'])
  })

  test('valse vrienden', () => {
    expect(allergenenIn('bloemkool')).toEqual([])
    expect(allergenenIn('kokosmelk')).toEqual([])
    expect(allergenenIn('nootmuskaat')).toEqual([])
    expect(allergenenIn('mierikswortel')).toEqual([])
    expect(allergenenIn('groene bakbanaan')).toEqual([])
    expect(allergenenIn('boter, op kamertemperatuur')).toEqual(['koemelk'])
    expect(allergenenIn('tamarindepasta')).toEqual([])
    expect(allergenenIn('(rijst)noedels')).toEqual([])
    expect(allergenenIn('zalmeitjes')).toEqual(['vis'])
  })

  test('mogelijk: het etiket beslist', () => {
    const bouillon = treffers('kippenbouillon', regels)
    expect(bouillon).toEqual([{ allergeen: 'gluten', zeker: false, vervanger: null }])
    const curry = treffers('rode currypasta', regels).map((t) => t.allergeen).sort()
    expect(curry).toEqual(['schaaldieren', 'vis'])
  })
})

describe('vervangerVoor', () => {
  test('gluten en koemelk hebben vervangers', () => {
    expect(vervangerVoor('spaghetti', regels, ['gluten'])).toBe('glutenvrije pasta')
    expect(vervangerVoor('bloem', regels, ['gluten'])).toBe('glutenvrije bloem')
    expect(vervangerVoor('melk', regels, ['koemelk'])).toBe('havermelk')
    expect(vervangerVoor('zure room', regels, ['koemelk'])).toBe('plantaardige creme fraiche')
  })

  test('geen vervanger als één van je allergieën niet te vervangen is', () => {
    expect(vervangerVoor('tagliatelle', regels, ['gluten'])).toBe('glutenvrije pasta')
    expect(vervangerVoor('tagliatelle', regels, ['gluten', 'ei'])).toBeUndefined()
    expect(vervangerVoor('ricotta', regels, ['koemelk'])).toBeUndefined()
  })

  test('niet voor allergieën die je niet hebt', () => {
    expect(vervangerVoor('spaghetti', regels, ['koemelk'])).toBeUndefined()
  })
})

describe('receptAllergie', () => {
  test('bevat, vervangen en etiket', () => {
    const blok = receptAllergie(['spaghetti', 'cashewnoten', 'kippenbouillon', 'ui'], regels, ['gluten', 'noten'])
    expect(blok.vervangen).toEqual([{ naam: 'spaghetti', vervanger: 'glutenvrije pasta' }])
    expect(blok.bevat).toEqual([{ naam: 'cashewnoten', allergenen: ['noten'] }])
    expect(blok.etiket).toEqual([{ naam: 'kippenbouillon', allergenen: ['gluten'] }])
  })
})

describe('opsomming', () => {
  test('met "en" voor de laatste', () => {
    expect(opsomming(['gluten'])).toBe('gluten')
    expect(opsomming(['gluten', 'noten'])).toBe('gluten en noten')
    expect(opsomming(['gluten', 'ei', 'pinda'])).toBe("gluten, ei en pinda's")
  })
})
