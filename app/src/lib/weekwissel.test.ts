import { describe, expect, it } from 'vitest'
import { doelWeek, watGaatMee, weekVoorbij, type Keuze } from './weekwissel'

const keuze = (recept_id: string, over: Partial<Keuze> = {}): Keuze => ({
  recept_id, aantal: 1, van_lijst_op: '2026-10-02T10:00:00Z', gekookt_op: null, besteld_op: '2026-10-02T10:00:00Z', ...over,
})

describe('doelWeek', () => {
  it('is de volgende week, ook als die nog moet beginnen', () => {
    expect(doelWeek('2026-10-05', new Date('2026-10-07T12:00:00'))).toBe('2026-10-12')
  })

  it('slaat weken over die al voorbij zijn', () => {
    expect(doelWeek('2026-09-07', new Date('2026-10-07T12:00:00'))).toBe('2026-10-05')
  })
})

describe('watGaatMee', () => {
  it('neemt mee wat je aanwees en wat nog op je lijst staat, nooit wat gekookt is', () => {
    const keuzes = [
      keuze('aangewezen'),
      keuze('niet-aangewezen'),
      keuze('op-lijst', { van_lijst_op: null, besteld_op: null }),
      keuze('gekookt', { gekookt_op: '2026-10-04T18:00:00Z' }),
    ]
    expect(watGaatMee(keuzes, ['aangewezen', 'gekookt']).map((k) => k.recept_id)).toEqual(['aangewezen', 'op-lijst'])
  })
})

describe('weekVoorbij', () => {
  const nu = new Date('2026-10-09T12:00:00Z').getTime()

  it('is waar als er een week na het bestellen nog iets te koken valt', () => {
    expect(weekVoorbij([{ besteldOp: '2026-10-02T10:00:00Z', gekooktOp: null }], nu)).toBe(true)
    expect(weekVoorbij([{ besteldOp: '2026-10-05T10:00:00Z', gekooktOp: null }], nu)).toBe(false)
  })

  it('vraagt niets als alles gekookt is of er niets besteld is', () => {
    expect(weekVoorbij([{ besteldOp: '2026-10-01T10:00:00Z', gekooktOp: '2026-10-03T18:00:00Z' }], nu)).toBe(false)
    expect(weekVoorbij([{ besteldOp: null, gekooktOp: null }], nu)).toBe(false)
  })
})
