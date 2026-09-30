import { describe, expect, test } from 'vitest'
import { eersteBezorgdag, isoDatum, totTekst } from './bonus'
import { bonusVoordeel, minimaalAantal } from './bonusRegels'

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


describe('minimaalAantal', () => {
  test.each([['1 + 1 gratis', 2], ['5 + 1 gratis', 6], ['2e halve prijs', 2], ['3 voor 4.99', 3], ['25% korting', 1], [null, 1]])(
    '%s → %i', (m, verwacht) => { expect(minimaalAantal(m)).toBe(verwacht) },
  )
})

describe('bonusVoordeel', () => {
  const actie = (mechanisme: string, nu: number, was: number) => ({
    ingredient_key: 'x', titel: 'x', mechanisme, prijs_nu: nu, prijs_was: was, geldig_van: '2026-09-28', geldig_tot: '2026-10-04',
  })
  test('percentage: per stuk', () => { expect(bonusVoordeel(actie('25% korting', 3, 4), 1)).toBe(1) })
  test('1 + 1 gratis met één stuk: niets', () => { expect(bonusVoordeel(actie('1 + 1 gratis', 1, 2), 1)).toBe(0) })
  test('1 + 1 gratis met twee: twee keer het verschil', () => { expect(bonusVoordeel(actie('1 + 1 gratis', 1, 2), 2)).toBe(2) })
  test('3 voor … met vier: alleen het setje van drie', () => { expect(bonusVoordeel(actie('3 voor 4.99', 1.66, 2.29), 4)).toBe(1.89) })
  test('zonder was-prijs: niets', () => { expect(bonusVoordeel({ ...actie('25% korting', 3, 4), prijs_was: null }, 2)).toBe(0) })
})
