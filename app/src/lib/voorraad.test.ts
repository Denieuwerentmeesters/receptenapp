import { describe, expect, test } from 'vitest'
import { inVoorraad } from './voorraad'
import { ingredientKey } from './schaal'

// De sleutels zoals de voorraadkast ze opslaat (Voorraadkast.tsx, STANDAARD).
const kast = new Set(['Uien', 'Azijn', 'Boter', 'Mosterd', 'Rijst', 'Knoflook'].map(ingredientKey))
const thuis = (naam: string) => inVoorraad(ingredientKey(naam), kast)

describe('inVoorraad', () => {
  test.each(['ui', 'uien', 'rode ui', 'grote ui', 'ui, gesnipperd', 'uien, in ringen gesneden', 'ui (fijngesnipperd)'])(
    '%s is uien', (naam) => { expect(thuis(naam)).toBe(true) },
  )

  test.each(['lente-ui', 'lente ui', 'bosui', 'bosuitjes', 'gebakken uitjes', 'uienpoeder'])(
    '%s is geen uien', (naam) => { expect(thuis(naam)).toBe(false) },
  )

  test.each(['azijn', 'witte wijnazijn', 'rode wijnazijn', 'rodewijnazijn', 'witte wijn azijn', 'appelazijn'])(
    '%s is azijn', (naam) => { expect(thuis(naam)).toBe(true) },
  )

  test.each(['rijstazijn', 'balsamicoazijn', 'sushi-azijn', 'witte balsamico azijn'])(
    '%s is een andere fles', (naam) => { expect(thuis(naam)).toBe(false) },
  )

  test.each(['boter', 'roomboter', 'ongezouten roomboter', 'boter, op kamertemperatuur', 'gesmolten boter'])(
    '%s is boter', (naam) => { expect(thuis(naam)).toBe(true) },
  )

  test.each(['kruidenboter', 'pindakaas', 'rijstazijn', 'rijstnoedels', 'mosterdzaad'])(
    '%s staat er niet', (naam) => { expect(thuis(naam)).toBe(false) },
  )

  test('balsamico hoort bij balsamicoazijn, niet bij azijn', () => {
    const metBalsamico = new Set(['azijn', 'balsamicoazijn'])
    expect(inVoorraad(ingredientKey('balsamico-azijn'), metBalsamico)).toBe(true)
    expect(inVoorraad(ingredientKey('donkere balsamicoazijn'), metBalsamico)).toBe(true)
    expect(inVoorraad(ingredientKey('sushi-azijn'), metBalsamico)).toBe(false)
  })

  test.each(['eetbare bloemen', 'ingelegde rode ui'])('%s is iets anders', (naam) => {
    expect(inVoorraad(ingredientKey(naam), new Set(['bloem', 'uien']))).toBe(false)
  })

  test('wat al werkte blijft werken', () => {
    expect(thuis('grove mosterd')).toBe(true)
    expect(thuis('knoflooktenen')).toBe(true)
    expect(inVoorraad('preien', new Set(['prei']))).toBe(true)
    expect(inVoorraad('ui', new Set())).toBe(false)
  })
})
