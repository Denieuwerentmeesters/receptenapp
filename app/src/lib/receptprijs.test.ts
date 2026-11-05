import { describe, expect, test } from 'vitest'
import { receptPrijs, type PrijsBron } from './receptprijs'
import { ingredientKey } from './schaal'

// Een kleine winkel: sleutel → product met prijs en inhoud.
const WINKEL: Record<string, { prijs: number; inhoud: number; eenheid: 'g' | 'ml' | 'stuks' }> = {
  rijst: { prijs: 2.0, inhoud: 500, eenheid: 'g' },
  kipfilet: { prijs: 6.0, inhoud: 400, eenheid: 'g' },
  ui: { prijs: 1.2, inhoud: 1000, eenheid: 'g' },
  prei: { prijs: 0.59, inhoud: 1, eenheid: 'stuks' },
  misopasta: { prijs: 3.99, inhoud: 200, eenheid: 'g' },
  'verse lasagnebladen': { prijs: 1.75, inhoud: 500, eenheid: 'g' },
  gorgonzola: { prijs: 2.69, inhoud: 200, eenheid: 'g' },
}
const bron: PrijsBron = {
  productVoor: (i) => (WINKEL[i.ingredient_key] ? i.ingredient_key : null),
  verpakkingVoor: (i) => WINKEL[i.ingredient_key],
  prijsVoor: (i) => WINKEL[i.ingredient_key]?.prijs,
}
const regel = (naam: string, geschaald: number | null, eenheid: string | null) => ({ naam, geschaald, eenheid })

describe('receptPrijs: wat het mandje kost', () => {
  test('een heel pak, ook als het recept er maar een deel van gebruikt', () => {
    // 200 g uit 500 g rijst: het pak van € 2 gaat in het mandje. Twee personen: € 1 p.p.
    const p = receptPrijs([regel('rijst', 200, 'g')], 2, bron)
    expect(p.totaal).toBe(2)
    expect(p.perPersoon).toBe(1)
    expect(p.opPrijs).toBe(1)
    expect(p.geschat).toBe(0)
  })

  test('wat je bewaart (miso) telt naar gebruik: twee eetlepels van een pot van 200 g', () => {
    // 30 g van 200 g = 15% van € 3,99.
    expect(receptPrijs([regel('misopasta', 2, 'el')], 4, bron).totaal).toBe(0.6)
  })

  test('bewaarbaar, maar meer dan een pot: dan gewoon hele potten', () => {
    expect(receptPrijs([regel('misopasta', 300, 'g')], 4, bron).totaal).toBe(7.98)
  })

  test('bewaarbaar zonder te kunnen omrekenen blijft een hele pot', () => {
    expect(receptPrijs([regel('misopasta', null, null)], 4, bron).totaal).toBe(3.99)
  })

  test('meer dan een pak, met een kwart speling', () => {
    // 500 g kip uit 400 g: 1,25 pak telt als één, 520 g als twee.
    expect(receptPrijs([regel('kipfilet', 500, 'g')], 1, bron).totaal).toBe(6)
    expect(receptPrijs([regel('kipfilet', 520, 'g')], 1, bron).totaal).toBe(12)
  })

  test('prei per stuk: vier preien, vier keer de stukprijs', () => {
    expect(receptPrijs([regel('prei', 4, 'st')], 4, bron).totaal).toBe(2.36)
  })

  test('wat in de voorraadkast staat kost niets: gorgonzola in huis scheelt het pak', () => {
    const regels = [regel('rijst', 200, 'g'), regel('gorgonzola', 200, 'g')]
    const zonder = receptPrijs(regels, 4, bron)
    const met = receptPrijs(regels, 4, bron, new Set([ingredientKey('gorgonzola')]))
    expect(zonder.totaal).toBe(4.69)
    expect(met.totaal).toBe(2)
    expect(zonder.perPersoon - met.perPersoon).toBeCloseTo(0.67, 2)
    expect(met.inHuis).toBe(1)
  })

  test('twee regels uit één pak vragen samen één pak', () => {
    expect(receptPrijs([regel('rijst', 200, 'g'), regel('rijst', 100, 'g')], 1, bron).totaal).toBe(2)
  })

  test('basisvoorraad en olie tellen niet', () => {
    const p = receptPrijs([regel('zout', null, null), regel('olijfolie', 2, 'el'), regel('water', 500, 'ml')], 2, bron)
    expect(p.totaal).toBe(0)
  })

  test('zonder prijs of product valt het terug op de klassenschatting', () => {
    const p = receptPrijs([regel('sojasaus', 2, 'el'), regel('limoenblaadjes', 3, 'st')], 1, bron)
    expect(p.opPrijs).toBe(0)
    expect(p.geschat).toBe(2)
    expect(p.totaal).toBeGreaterThan(0)
  })

  test('het aantal personen deelt het totaal', () => {
    expect(receptPrijs([regel('kipfilet', 800, 'g')], 4, bron).perPersoon).toBe(3)
  })
})

describe('kruidenpotjes zonder inhoud', () => {
  test('een halve eetlepel kurkuma kost een stukje van het potje, niet het hele potje', () => {
    const kruidBron: PrijsBron = {
      productVoor: () => 'x', verpakkingVoor: () => undefined, prijsVoor: () => 3.29,
    }
    const p = receptPrijs([regel('kurkuma', 0.5, 'el')], 4, kruidBron)
    expect(p.totaal).toBeGreaterThan(0.2)
    expect(p.totaal).toBeLessThan(0.5)
  })
})
