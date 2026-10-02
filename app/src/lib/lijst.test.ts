import { describe, expect, test } from 'vitest'
import { aantalVerpakkingen, groepeerOpSchap, voegSamen } from './lijst'
import type { BoodschapItem } from './database.types'

let n = 0
function rij(ingredient_key: string, hoeveelheid: number | null, eenheid: string | null): BoodschapItem {
  n++
  return {
    id: `i${n}`, user_id: 'u', week_start_datum: '2026-09-28', naam: ingredient_key, ingredient_key,
    hoeveelheid, eenheid, categorie: null, bron_type: 'recept', bron_recept_id: `r${n}`, is_afgevinkt: false,
  } as BoodschapItem
}
const regel = (...rijen: BoodschapItem[]) => voegSamen(rijen)[0]

describe('aantalVerpakkingen', () => {
  test('blikken uit twee recepten tellen op', () => {
    expect(aantalVerpakkingen(regel(rij('tomatenblokjes', 1, 'blik'), rij('tomatenblokjes', 1, 'blik')), 'ah')).toBe(2)
  })

  test('een geschaalde anderhalf blik wordt twee', () => {
    expect(aantalVerpakkingen(regel(rij('kokosmelk', 1.5, 'blikjes')), 'jumbo')).toBe(2)
  })

  test('"blik (400 ml)" is ook een blik', () => {
    expect(aantalVerpakkingen(regel(rij('kikkererwten', 2, 'blik (400 ml)')), 'ah')).toBe(2)
  })

  test('pak, zak, fles en pot tellen ook', () => {
    expect(aantalVerpakkingen(regel(rij('passata', 1, 'pak'), rij('passata', 1, 'pak')), 'ah')).toBe(2)
    expect(aantalVerpakkingen(regel(rij('spinazie', 1, 'zak'), rij('spinazie', 2, 'zakken')), 'ah')).toBe(3)
    expect(aantalVerpakkingen(regel(rij('pesto', 1, 'potje')), 'ah')).toBe(1)
  })

  test('verpakking zonder hoeveelheid telt als één', () => {
    expect(aantalVerpakkingen(regel(rij('mais', null, 'blik'), rij('mais', 1, 'blik')), 'ah')).toBe(2)
  })

  test('grammen blijven één verpakking', () => {
    expect(aantalVerpakkingen(regel(rij('spinazie', 100, 'g'), rij('spinazie', 100, 'g')), 'ah')).toBe(1)
  })

  test('uien zijn één net', () => {
    expect(aantalVerpakkingen(regel(rij('ui', 2, null), rij('ui', 1, 'stuks')), 'jumbo')).toBe(1)
  })

  test('paprika per stuk', () => {
    expect(aantalVerpakkingen(regel(rij('paprika', 2, null), rij('paprika', 1, 'stuk')), 'ah')).toBe(3)
  })

  test('citroen per stuk alleen bij AH', () => {
    const r = regel(rij('citroen', 2, null))
    expect(aantalVerpakkingen(r, 'ah')).toBe(2)
    expect(aantalVerpakkingen(r, 'jumbo')).toBe(1)
  })
})

describe('aantalVerpakkingen met inhoud (Jumbo)', () => {
  const pak500 = { inhoud: 500, eenheid: 'g' as const }

  test('twee keer 500 g gehakt is twee pakken', () => {
    expect(aantalVerpakkingen(regel(rij('rundergehakt', 500, 'g'), rij('rundergehakt', 500, 'g')), 'jumbo', pak500)).toBe(2)
  })

  test('twee keer 100 g spinazie in een zak van 400 g is één zak', () => {
    expect(aantalVerpakkingen(regel(rij('spinazie', 100, 'g'), rij('spinazie', 100, 'g')), 'jumbo',
      { inhoud: 400, eenheid: 'g' })).toBe(1)
  })

  test('tien procent speling: 540 g is nog één pak', () => {
    expect(aantalVerpakkingen(regel(rij('kipfilet', 540, 'g')), 'jumbo', pak500)).toBe(1)
    expect(aantalVerpakkingen(regel(rij('kipfilet', 600, 'g')), 'jumbo', pak500)).toBe(2)
  })

  test('kilo en liter rekenen om', () => {
    expect(aantalVerpakkingen(regel(rij('aardappel', 1.5, 'kg')), 'jumbo', { inhoud: 1000, eenheid: 'g' })).toBe(2)
    expect(aantalVerpakkingen(regel(rij('melk', 0.5, 'l'), rij('melk', 750, 'ml')), 'jumbo', { inhoud: 1000, eenheid: 'ml' })).toBe(2)
  })

  test('uien per stuk tegen een net van 1 kg', () => {
    expect(aantalVerpakkingen(regel(rij('ui', 3, null), rij('ui', 2, 'stuks')), 'jumbo', { inhoud: 1000, eenheid: 'g' })).toBe(1)
    expect(aantalVerpakkingen(regel(rij('ui', 8, null)), 'jumbo', { inhoud: 1000, eenheid: 'g' })).toBe(2)
  })

  test('eieren tegen een doos van 10', () => {
    expect(aantalVerpakkingen(regel(rij('ei', 4, null), rij('ei', 8, null)), 'jumbo', { inhoud: 10, eenheid: 'stuks' })).toBe(2)
  })

  test('een theelepel saffraan is één potje, niet honderd', () => {
    expect(aantalVerpakkingen(regel(rij('saffraan', 1, 'tl')), 'jumbo', { inhoud: 0.05, eenheid: 'g' })).toBe(1)
  })

  test('nooit meer dan zes', () => {
    expect(aantalVerpakkingen(regel(rij('parmezaan', 2, 'kg')), 'jumbo', { inhoud: 50, eenheid: 'g' })).toBe(6)
  })

  test('blikken in het recept gaan voor de inhoud', () => {
    expect(aantalVerpakkingen(regel(rij('kokosmelk', 2, 'blik')), 'jumbo', { inhoud: 400, eenheid: 'ml' })).toBe(2)
  })
})

describe('kruiden op de lijst', () => {
  test('theelepels en grammen kurkuma worden één regel zonder hoeveelheid', () => {
    const regels = voegSamen([rij('kurkuma', 1, 'theelepel'), rij('kurkuma', 10, 'gram')])
    expect(regels).toHaveLength(1)
    expect(regels[0].label).toBe('kurkuma')
  })

  test('kurkumapoeder en een maat in de naam vallen samen met kurkuma', () => {
    const regels = voegSamen([rij('kurkuma', 1, 'tl'), rij('kurkumapoeder', 2, 'tl'), rij('gram kurkuma', 10, null)])
    expect(regels).toHaveLength(1)
    expect(regels[0].label).toBe('kurkuma')
  })

  test('paprikapoeder blijft iets anders dan paprika', () => {
    expect(voegSamen([rij('paprika', 2, null), rij('paprikapoeder', 1, 'tl')])).toHaveLength(2)
  })

  test('gewone producten houden hun hoeveelheid', () => {
    expect(regel(rij('spinazie', 100, 'g'), rij('spinazie', 100, 'g')).label).toBe('200 g spinazie')
  })
})

describe('vers en gedroogd', () => {
  const met = (naam: string, ingredient_key: string, hoeveelheid: number, eenheid: string) =>
    ({ ...rij(ingredient_key, hoeveelheid, eenheid), naam })

  test('gemalen koriander staat er zonder hoeveelheid, los van het bosje', () => {
    const regels = voegSamen([
      met('gemalen koriander', 'koriander', 1.3, 'tl'),
      met('gemalen koriander', 'koriander', 27, 'g'),
      met('korianderpoeder', 'korianderpoeder', 1, 'tl'),
      met('verse koriander', 'koriander', 15, 'g'),
    ])
    expect(regels.map((r) => r.label).sort()).toEqual(['15 g verse koriander', 'gemalen koriander'])
    expect(groepeerOpSchap(regels).map((g) => g.schap)).toEqual(['Verse kruiden', 'Kruiden & specerijen'])
  })

  test('gedroogde tijm is een potje, tijm een takje', () => {
    expect(regel(met('gedroogde tijm', 'tijm', 1.3, 'tl')).label).toBe('gedroogde tijm')
    expect(regel(met('tijm', 'tijm', 2, 'takjes')).label).toBe('2 takjes tijm')
  })
})
