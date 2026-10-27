import { describe, expect, test } from 'vitest'
import { cijferBetekenis, cijferTekst, gemiddeldeOpKaart, laagBeoordeeld, laatstePerRecept, type Beoordeling } from './beoordeling'

function rij(deel: Partial<Beoordeling>): Beoordeling {
  return { id: 'x', recept_id: 'a', cijfer: null, notitie: null, gekookt_op: '2026-10-20', aangemaakt_op: '2026-10-20T18:00:00Z', ...deel }
}

describe('laatstePerRecept', () => {
  test('het laatste cijfer telt, ook als de rijen door elkaar staan', () => {
    const m = laatstePerRecept([
      rij({ cijfer: 9, aangemaakt_op: '2026-10-27T18:00:00Z' }),
      rij({ cijfer: 4, aangemaakt_op: '2026-10-01T18:00:00Z' }),
    ])
    expect(m.get('a')?.cijfer).toBe(9)
  })

  test('een rij met alleen een notitie wist het cijfer niet', () => {
    const m = laatstePerRecept([
      rij({ cijfer: 7, aangemaakt_op: '2026-10-01T18:00:00Z' }),
      rij({ notitie: ' minder chili ', aangemaakt_op: '2026-10-27T18:00:00Z' }),
    ])
    expect(m.get('a')).toEqual({ cijfer: 7, notitie: 'minder chili' })
  })

  test('zonder cijfer blijft het leeg, geen stille 6', () => {
    expect(laatstePerRecept([rij({ notitie: 'lekker' })]).get('a')?.cijfer).toBeNull()
  })
})

describe('laagBeoordeeld', () => {
  test('5 of lager valt af, 6 niet', () => {
    const m = laatstePerRecept([rij({ recept_id: 'a', cijfer: 5 }), rij({ recept_id: 'b', cijfer: 6 }), rij({ recept_id: 'c' })])
    expect([...laagBeoordeeld(m)]).toEqual(['a'])
  })
})

describe('gemiddeldeOpKaart', () => {
  test('pas vanaf genoeg cijfers', () => {
    expect(gemiddeldeOpKaart({ cijfer_gemiddeld: '8.4', cijfer_aantal: 19 })).toBeNull()
    expect(gemiddeldeOpKaart({ cijfer_gemiddeld: '8.4', cijfer_aantal: 212 })).toEqual({ gemiddeld: 8.4, aantal: 212 })
    expect(gemiddeldeOpKaart({})).toBeNull()
  })
})

test('opmaak', () => {
  expect(cijferTekst(8.4)).toBe('8,4')
  expect(cijferTekst(9)).toBe('9')
  expect(cijferBetekenis(3)).toMatch(/niet lekker/i)
})
