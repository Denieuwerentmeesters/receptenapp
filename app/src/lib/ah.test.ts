import { describe, expect, test } from 'vitest'
import { enkelvoudVormen, zoekProduct } from './ah'
import { ingredientKey } from './schaal'

const MAPPING: Record<string, string> = {
  cherrytomaten: 'AH Cherrytomaten', worst: 'Worst', aardappel: 'Aardappelen', bol: 'Bol',
  kappertjes: 'Kappertjes', 'rode ui': 'Rode ui',
}
const vind = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, MAPPING)

describe('verkleinwoorden', () => {
  test.each([
    ['cherrytomaatjes', 'AH Cherrytomaten'], ['rijpe cherrytomaatjes', 'AH Cherrytomaten'],
    ['worstjes', 'Worst'], ['aardappeltjes', 'Aardappelen'], ['bolletje', 'Bol'],
  ])('%s → %s', (naam, product) => { expect(vind(naam)).toBe(product) })

  test('geen verkleinwoord, geen extra vormen', () => {
    expect(enkelvoudVormen('ui')).toEqual([])
  })
})

describe('keuze in het recept: de eerste telt', () => {
  const KEUZE: Record<string, string> = {
    pitabroodje: 'Pita', wraps: 'Wraps', sojasaus: 'Sojasaus', groentebouillon: 'Groentebouillon',
    doperwten: 'Doperwten', winterwortel: 'Winterwortel',
  }
  const kies = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, KEUZE)

  test.each([
    ['wraps of pitabroodjes', 'Wraps'],
    ['pitabroodjes of wraps', 'Pita'],
    // De eerste staat niet in de mapping: dan de tweede.
    ['tamari of sojasaus', 'Sojasaus'],
    // Gedeeld woorddeel of geen product voor de "of": zoeken op de hele naam.
    ['kippen- of groentebouillon', 'Groentebouillon'],
    ['verse of diepvries doperwten', 'Doperwten'],
    ['winterwortel, in blokjes of plakjes', 'Winterwortel'],
  ])('%s → %s', (naam, product) => { expect(kies(naam)).toBe(product) })
})
