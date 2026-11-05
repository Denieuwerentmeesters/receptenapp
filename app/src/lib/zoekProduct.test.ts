import { describe, expect, test } from 'vitest'
import { zoekProduct } from './zoekProduct'
import { ingredientKey } from './schaal'

describe('dure snit uit een keuze', () => {
  const mapping = { ossenhaas: { id: 1 }, ribeye: { id: 2 }, steak: { id: 3 } }
  const zoek = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, mapping)
  test('"ossenhaas of runderlende" geeft geen ossenhaas', () => {
    expect(zoek('carpaccio vlees (ossenhaas of runderlende)')).toBeUndefined()
    expect(zoek('ossenhaaspuntjes of biefstukpuntjes')).toBeUndefined()
  })
  test('ossenhaas alleen genoemd blijft ossenhaas', () => {
    expect(zoek('ossenhaas')).toEqual({ id: 1 })
  })
  test('een gewone keuze naast een dure snit pakt de gewone', () => {
    expect(zoek('steak of ossenhaas')).toEqual({ id: 3 })
  })
})
