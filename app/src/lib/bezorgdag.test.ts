import { describe, expect, test } from 'vitest'
import { bepaalPeildatum, bezorgdagen, dagLabel } from './bezorgdag'
import { bonusOp } from './bonus'

const woensdag = new Date('2026-09-30T10:00:00')
const zaterdag = new Date('2026-10-03T10:00:00')

describe('bepaalPeildatum', () => {
  test('zonder keuze de eerste bezorgdag', () => {
    expect(bepaalPeildatum(woensdag, false, null)).toMatchObject({ peil: '2026-10-01', gekozen: false })
  })
  test('zelf halen: vandaag', () => {
    expect(bepaalPeildatum(zaterdag, true, '2026-10-06')).toMatchObject({ peil: '2026-10-03', zelfHalen: true })
  })
  test('een gekozen latere dag telt', () => {
    expect(bepaalPeildatum(woensdag, false, '2026-10-05')).toMatchObject({ peil: '2026-10-05', gekozen: true })
  })
  test('een gekozen dag die al voorbij is, telt niet meer', () => {
    expect(bepaalPeildatum(zaterdag, false, '2026-10-01')).toMatchObject({ peil: '2026-10-05', gekozen: false })
  })
})

describe('bezorgdagen', () => {
  test('een week vooruit, zonder zondag en zonder vandaag', () => {
    expect(bezorgdagen(zaterdag, 3)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07'])
  })
})

describe('dagLabel', () => {
  test.each([['2026-09-30', 'vandaag'], ['2026-10-01', 'morgen'], ['2026-10-05', 'maandag 5 oktober']])(
    '%s → %s', (iso, verwacht) => { expect(dagLabel(iso, woensdag)).toBe(verwacht) },
  )
})

describe('bonusOp', () => {
  const actie = (van: string, tot: string) => ({
    ingredient_key: 'kipfilet', titel: 'AH Kipfilet', prijs_nu: 5, prijs_was: 7, mechanisme: null, geldig_van: van, geldig_tot: tot,
  })
  test('alleen wat op die dag geldt', () => {
    const acties = [actie('2026-09-28', '2026-10-04'), actie('2026-10-05', '2026-10-11')]
    expect(bonusOp(acties, '2026-10-01').kipfilet).toHaveLength(1)
    expect(bonusOp(acties, '2026-10-05').kipfilet?.[0].geldig_van).toBe('2026-10-05')
    expect(bonusOp(acties, '2026-10-12').kipfilet).toBeUndefined()
  })
})
