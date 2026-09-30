import { describe, expect, test } from 'vitest'
import { kiesWeek, vegaDoel, type Kandidaat } from './weekvullen'

let n = 0
function recept(deel: Partial<Kandidaat> & { ingr?: string[] } = {}): Kandidaat {
  n++
  return {
    id: deel.id ?? `r${n}`,
    positie: deel.positie ?? n,
    keuken: deel.keuken ?? `keuken${n}`,
    tags: deel.tags ?? [],
    inBonus: deel.inBonus,
    ingredienten: (deel.ingr ?? []).map((naam) => ({ naam, hoeveelheid: null, eenheid: null })),
  } as Kandidaat
}
const vega = { tags: ['vegetarisch'] }

describe('vegaDoel', () => {
  test('rekent "x van de 10" om naar je kookavonden', () => {
    expect(vegaDoel({ vega_minimum: 5, kookavonden: 4 })).toBe(2)
    expect(vegaDoel({ vega_minimum: 3, kookavonden: 4 })).toBe(1)
    expect(vegaDoel({ vega_minimum: 10, kookavonden: 3 })).toBe(3)
    expect(vegaDoel({ vega_minimum: 0, kookavonden: 7 })).toBe(0)
  })
})

describe('kiesWeek', () => {
  test('vult aan tot het aantal kookavonden, in volgorde van positie', () => {
    const s = [recept({ id: 'a', positie: 1 }), recept({ id: 'b', positie: 2 }), recept({ id: 'c', positie: 3 })]
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [])).toEqual(['a', 'b'])
  })

  test('telt wat al op de lijst staat mee', () => {
    const s = [recept({ id: 'a' }), recept({ id: 'b' })]
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [recept()])).toEqual(['a'])
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [recept(), recept()])).toEqual([])
  })

  test('haalt de vega-verhouding', () => {
    const s = [recept({ id: 'vlees1' }), recept({ id: 'vlees2' }), recept({ id: 'vlees3' }),
      recept({ id: 'groen1', ...vega }), recept({ id: 'groen2', ...vega })]
    const keuze = kiesWeek(s, { vega_minimum: 5, kookavonden: 4 }, [])
    expect(keuze).toHaveLength(4)
    expect(keuze.filter((id) => id.startsWith('groen'))).toHaveLength(2)
  })

  test('niet twee keer dezelfde keuken als het anders kan', () => {
    const s = [recept({ id: 'it1', keuken: 'Italiaans' }), recept({ id: 'it2', keuken: 'Italiaans' }),
      recept({ id: 'th', keuken: 'Thais' })]
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [])).toEqual(['it1', 'th'])
  })

  test('wel dezelfde keuken als er niets anders is', () => {
    const s = [recept({ id: 'it1', keuken: 'Italiaans' }), recept({ id: 'it2', keuken: 'Italiaans' })]
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [])).toEqual(['it1', 'it2'])
  })

  test('liefst recepten die ingrediënten delen, maar zout en olie tellen niet', () => {
    const al = recept({ id: 'al', ingr: ['spinazie', 'feta', 'zout', 'olijfolie'] })
    const s = [
      recept({ id: 'zout', positie: 1, ingr: ['zout', 'olijfolie', 'kip'] }),
      recept({ id: 'spinazie', positie: 2, ingr: ['spinazie', 'rijst'] }),
    ]
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [al])).toEqual(['spinazie'])
  })

  test('wat je in huis hebt telt niet als gedeeld ingrediënt', () => {
    const al = recept({ id: 'al', ingr: ['rijst'] })
    const s = [recept({ id: 'eerst', positie: 1 }), recept({ id: 'rijst', positie: 2, ingr: ['rijst'] })]
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [al], new Set(['rijst']))).toEqual(['eerst'])
  })

  test('bonus gaat voor gedeelde ingrediënten, niet voor de keuken', () => {
    const al = recept({ id: 'al', keuken: 'Thais', ingr: ['spinazie'] })
    const s = [
      recept({ id: 'delen', positie: 1, keuken: 'Grieks', ingr: ['spinazie'] }),
      recept({ id: 'bonus', positie: 2, keuken: 'Italiaans', inBonus: true } as Partial<Kandidaat>),
      recept({ id: 'thais-bonus', positie: 3, keuken: 'Thais', inBonus: true } as Partial<Kandidaat>),
    ]
    expect(kiesWeek(s, { vega_minimum: 0, kookavonden: 2 }, [al])).toEqual(['bonus'])
  })

  test('stopt als de suggesties op zijn', () => {
    expect(kiesWeek([recept({ id: 'a' })], { vega_minimum: 0, kookavonden: 5 }, [])).toEqual(['a'])
  })
})
