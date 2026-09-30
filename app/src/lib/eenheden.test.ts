import { describe, expect, test } from 'vitest'
import { inhoudTekst, naarEenheid } from './eenheden'

describe('naarEenheid', () => {
  test.each([
    [250, 'g', 'g', 250], [1.5, 'kg', 'g', 1500], [2, 'dl', 'ml', 200], [1, 'l', 'ml', 1000],
    [200, 'ml', 'g', 200], [3, null, 'stuks', 3], [2, 'stuks', 'stuks', 2],
  ] as const)('%s %s naar %s', (h, e, doel, verwacht) => {
    expect(naarEenheid(h, e, 'iets', doel)).toBe(verwacht)
  })

  test('stuks naar gram alleen met een bekend stukgewicht', () => {
    expect(naarEenheid(2, null, 'ui', 'g')).toBe(300)
    expect(naarEenheid(2, null, 'uien', 'g')).toBe(300)
    expect(naarEenheid(2, null, 'kipfilet', 'g')).toBeNull()
  })

  test('el, tl en snufjes rekenen we niet om', () => {
    expect(naarEenheid(2, 'el', 'olijfolie', 'ml')).toBeNull()
    expect(naarEenheid(1, 'snufje', 'zout', 'g')).toBeNull()
    expect(naarEenheid(null, 'g', 'kaas', 'g')).toBeNull()
  })

  test('gram naar stuks raden we niet', () => {
    expect(naarEenheid(200, 'g', 'ei', 'stuks')).toBeNull()
  })
})

describe('inhoudTekst', () => {
  test.each([
    [{ inhoud: 500, eenheid: 'g' }, '500 g'], [{ inhoud: 1000, eenheid: 'g' }, '1 kg'],
    [{ inhoud: 1500, eenheid: 'ml' }, '1,5 l'], [{ inhoud: 10, eenheid: 'stuks' }, '10 stuks'],
    [{ inhoud: 1, eenheid: 'stuks' }, '1 stuk'],
  ] as const)('%o → %s', (v, verwacht) => { expect(inhoudTekst(v)).toBe(verwacht) })
})
