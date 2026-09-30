import { describe, expect, test } from 'vitest'
import { eersteBezorgdag, isoDatum, totTekst } from './bonus'

const dag = (iso: string) => new Date(`${iso}T09:00:00`)

describe('eersteBezorgdag', () => {
  test.each([
    ['2026-09-28', '2026-09-29'], // maandag → dinsdag
    ['2026-09-30', '2026-10-01'], // woensdag → donderdag
    ['2026-10-02', '2026-10-03'], // vrijdag → zaterdag
    ['2026-10-03', '2026-10-05'], // zaterdag → maandag (zondag wordt niet bezorgd)
    ['2026-10-04', '2026-10-05'], // zondag → maandag
  ])('%s → %s', (vandaag, verwacht) => {
    expect(isoDatum(eersteBezorgdag(dag(vandaag)))).toBe(verwacht)
  })

  test('laat in de avond nog steeds morgen', () => {
    expect(isoDatum(eersteBezorgdag(new Date('2026-09-30T23:30:00')))).toBe('2026-10-01')
  })
})

describe('totTekst', () => {
  test('binnen een week de dag', () => {
    expect(totTekst('2026-10-04', dag('2026-09-30'))).toBe('t/m zondag')
  })
  test('verder weg de datum', () => {
    expect(totTekst('2026-10-20', dag('2026-09-30'))).toBe('t/m 20 oktober')
  })
})
