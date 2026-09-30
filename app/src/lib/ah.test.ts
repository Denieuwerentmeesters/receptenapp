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
