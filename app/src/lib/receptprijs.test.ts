import { describe, expect, test } from 'vitest'
import { receptPrijs, type PrijsBron } from './receptprijs'
import { ingredientKey } from './schaal'

// Een kleine winkel: sleutel → product met prijs en inhoud.
const WINKEL: Record<string, { prijs: number; inhoud: number; eenheid: 'g' | 'ml' | 'stuks' }> = {
  rijst: { prijs: 2.0, inhoud: 500, eenheid: 'g' },
  kipfilet: { prijs: 6.0, inhoud: 400, eenheid: 'g' },
  bloemkool: { prijs: 2.0, inhoud: 1, eenheid: 'stuks' },
  ui: { prijs: 1.2, inhoud: 1000, eenheid: 'g' },
}
const bron: PrijsBron = {
  productVoor: (i) => (WINKEL[i.ingredient_key] ? i.ingredient_key : null),
  verpakkingVoor: (i) => WINKEL[i.ingredient_key],
  prijsVoor: (i) => WINKEL[i.ingredient_key]?.prijs,
}
const regel = (naam: string, geschaald: number | null, eenheid: string | null) => ({ naam, geschaald, eenheid })

describe('receptPrijs', () => {
  test('rekent het aandeel van de pakprijs, niet het hele pak', () => {
    // 200 g uit 500 g rijst van € 2 = € 0,80; voor twee personen € 0,40 p.p.
    const p = receptPrijs([regel('rijst', 200, 'g')], 2, bron)
    expect(p.totaal).toBe(0.8)
    expect(p.perPersoon).toBe(0.4)
    expect(p.opPrijs).toBe(1)
    expect(p.geschat).toBe(0)
  })

  test('kilo en gram gaan goed om', () => {
    expect(receptPrijs([regel('kipfilet', 0.4, 'kg')], 1, bron).totaal).toBe(6)
  })

  test('wat in de voorraadkast staat kost niets', () => {
    const thuis = new Set([ingredientKey('rijst')])
    const p = receptPrijs([regel('rijst', 200, 'g'), regel('kipfilet', 200, 'g')], 1, bron, thuis)
    expect(p.totaal).toBe(3)
    expect(p.inHuis).toBe(1)
  })

  test('basisvoorraad en olie tellen niet', () => {
    const p = receptPrijs([regel('zout', null, null), regel('olijfolie', 2, 'el'), regel('water', 500, 'ml')], 2, bron)
    expect(p.totaal).toBe(0)
    expect(p.inHuis).toBe(0)
  })

  test('een prijs per stuk met gewicht in het recept gaat via het stukgewicht', () => {
    // Een bloemkool weegt 800 g: 400 g is een halve.
    expect(receptPrijs([regel('bloemkool', 400, 'g')], 1, bron).totaal).toBe(1)
  })

  test('stuks tegenover een pak in gram gaat via het stukgewicht', () => {
    // 2 uien = 300 g van 1 kg à € 1,20 = € 0,36.
    expect(receptPrijs([regel('ui', 2, null)], 1, bron).totaal).toBe(0.36)
  })

  test('zonder prijs of met een eetlepel valt het terug op de klassenschatting', () => {
    const p = receptPrijs([regel('sojasaus', 2, 'el'), regel('kipfilet', 3, 'el')], 1, bron)
    expect(p.opPrijs).toBe(0)
    expect(p.geschat).toBe(2)
    expect(p.totaal).toBeGreaterThan(0)
  })

  test('het aantal personen deelt het totaal', () => {
    expect(receptPrijs([regel('kipfilet', 800, 'g')], 4, bron).perPersoon).toBe(3)
  })
})
