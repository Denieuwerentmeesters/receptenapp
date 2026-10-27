import { describe, expect, test } from 'vitest'
import { verdeelFases } from './fases'
import type { WeekRecept } from './queries'

let n = 0
function r(deel: Partial<WeekRecept> = {}): WeekRecept {
  n++
  return {
    id: `r${n}`, titel: `Gerecht ${n}`, titel_nl: null, positie: n, gekozen: false, aantal: 0, opLijst: false,
    gekooktOp: null, besteldOp: null, opgeruimdOp: null, allergenen_vast: [], ...deel,
  } as WeekRecept
}

describe('verdeelFases', () => {
  test('besteld en niet gekookt is Te koken, ook in komende week', () => {
    const a = r({ gekozen: true, besteldOp: '2026-10-10T10:00:00Z' })
    const b = r({ gekozen: true, besteldOp: '2026-10-10T10:00:00Z' })
    const f = verdeelFases('2026-10-05', [a], [b])
    expect(f.teKoken.map((x) => x.id)).toEqual([a.id, b.id])
    expect(f.teKoken[1].week).toBe('2026-10-12')
  })

  test('gekozen maar niet besteld is Nog bestellen; gekookt staat nergens', () => {
    const a = r({ gekozen: true, opLijst: true })
    const g = r({ gekozen: true, besteldOp: '2026-10-10T10:00:00Z', gekooktOp: '2026-10-11T18:00:00Z' })
    const f = verdeelFases('2026-10-05', [a, g], [])
    expect(f.nogBestellen.map((x) => x.id)).toEqual([a.id])
    expect(f.teKoken).toEqual([])
  })

  test('suggesties komen uit komende week zodra deze week besteld is', () => {
    const besteld = r({ gekozen: true, besteldOp: '2026-10-10T10:00:00Z' })
    const dezeSuggestie = r()
    const komendeSuggestie = r()
    const f = verdeelFases('2026-10-05', [besteld, dezeSuggestie], [komendeSuggestie])
    expect(f.bestelWeek).toBe('2026-10-12')
    expect(f.suggesties.map((x) => x.id)).toEqual([komendeSuggestie.id])
  })

  test('zonder bestelling zijn de suggesties van deze week', () => {
    const s = r()
    const f = verdeelFases('2026-10-05', [s], [r()])
    expect(f.bestelWeek).toBe('2026-10-05')
    expect(f.suggesties.map((x) => x.id)).toEqual([s.id])
  })

  test('een suggestie met jouw allergeen zonder vervanger valt weg', () => {
    const s = r({ allergenen_vast: ['pinda'] })
    expect(verdeelFases('2026-10-05', [s], [], ['pinda']).suggesties).toEqual([])
  })

  test('een suggestie met een 5 of lager valt af; wat je zelf koos blijft', () => {
    const laag = r({ id: 'laag' })
    const gekozen = r({ id: 'gekozen', gekozen: true })
    const ok = r({ id: 'ok' })
    const f = verdeelFases('2026-10-05', [laag, gekozen, ok], [], [], new Set(['laag', 'gekozen']))
    expect(f.suggesties.map((x) => x.id)).toEqual(['ok'])
    expect(f.nogBestellen.map((x) => x.id)).toEqual(['gekozen'])
  })
})
