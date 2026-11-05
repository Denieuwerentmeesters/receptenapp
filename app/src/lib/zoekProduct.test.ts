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

describe('keuze met streep of schuine streep', () => {
  const mapping = { broccoli: { id: 'B' }, kip: { id: 'K' } }
  const zoek = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, mapping)
  test('broccoli/romanesco pakt broccoli', () => expect(zoek('broccoli/romanesco')).toEqual({ id: 'B' }))
  test('broccoli of romanesco pakt broccoli', () => expect(zoek('Broccoli of romanesco')).toEqual({ id: 'B' }))
  test('broccoli- of romanescoroosjes pakt broccoli', () => expect(zoek('broccoli- of romanescoroosjes')).toEqual({ id: 'B' }))
  test('kippen- of groentebouillon wordt geen kip', () => expect(zoek('kippen- of groentebouillon')).toBeUndefined())
})

describe('bijvoeglijke naamwoorden vallen weg', () => {
  const mapping = { ricotta: { id: 'R' }, appel: { id: 'A' }, boter: { id: 'B' } }
  const zoek = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, mapping)
  test('gezouten ricotta is ricotta', () => expect(zoek('gezouten ricotta')).toEqual({ id: 'R' }))
  test('grote stevige appel is appel', () => expect(zoek('grote stevige appel')).toEqual({ id: 'A' }))
  test('gezouten boter blijft een ander product', () => expect(zoek('gezouten boter')).toBeUndefined())
})
