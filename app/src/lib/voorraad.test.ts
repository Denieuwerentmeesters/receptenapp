import { describe, expect, test } from 'vitest'
import { inVoorraad, VOORRAAD_SUGGESTIES, voorraadNaam } from './voorraad'
import { ingredientKey } from './schaal'

// De sleutels zoals de voorraadkast ze opslaat (Voorraadkast.tsx, STANDAARD).
const kast = new Set(['Uien', 'Azijn', 'Boter', 'Mosterd', 'Rijst', 'Knoflook'].map(ingredientKey))
const thuis = (naam: string) => inVoorraad(ingredientKey(naam), kast)

describe('inVoorraad', () => {
  test.each(['ui', 'uien', 'rode ui', 'grote ui', 'ui, gesnipperd', 'uien, in ringen gesneden', 'ui (fijngesnipperd)'])(
    '%s is uien', (naam) => { expect(thuis(naam)).toBe(true) },
  )

  test.each(['lente-ui', 'lente ui', 'bosui', 'bosuitjes', 'gebakken uitjes', 'uienpoeder'])(
    '%s is geen uien', (naam) => { expect(thuis(naam)).toBe(false) },
  )

  test.each(['azijn', 'witte wijnazijn', 'rode wijnazijn', 'rodewijnazijn', 'witte wijn azijn', 'appelazijn'])(
    '%s is azijn', (naam) => { expect(thuis(naam)).toBe(true) },
  )

  test.each(['rijstazijn', 'balsamicoazijn', 'sushi-azijn', 'witte balsamico azijn'])(
    '%s is een andere fles', (naam) => { expect(thuis(naam)).toBe(false) },
  )

  test.each(['boter', 'roomboter', 'ongezouten roomboter', 'boter, op kamertemperatuur', 'gesmolten boter'])(
    '%s is boter', (naam) => { expect(thuis(naam)).toBe(true) },
  )

  test.each(['kruidenboter', 'pindakaas', 'rijstazijn', 'rijstnoedels', 'mosterdzaad'])(
    '%s staat er niet', (naam) => { expect(thuis(naam)).toBe(false) },
  )

  test('balsamico hoort bij balsamicoazijn, niet bij azijn', () => {
    const metBalsamico = new Set(['azijn', 'balsamicoazijn'])
    expect(inVoorraad(ingredientKey('balsamico-azijn'), metBalsamico)).toBe(true)
    expect(inVoorraad(ingredientKey('donkere balsamicoazijn'), metBalsamico)).toBe(true)
    expect(inVoorraad(ingredientKey('sushi-azijn'), metBalsamico)).toBe(false)
  })

  test.each(['eetbare bloemen', 'ingelegde rode ui'])('%s is iets anders', (naam) => {
    expect(inVoorraad(ingredientKey(naam), new Set(['bloem', 'uien']))).toBe(false)
  })

  test('wat al werkte blijft werken', () => {
    expect(thuis('grove mosterd')).toBe(true)
    expect(thuis('knoflooktenen')).toBe(true)
    expect(inVoorraad('preien', new Set(['prei']))).toBe(true)
    expect(inVoorraad('ui', new Set())).toBe(false)
  })
})

describe('VOORRAAD_SUGGESTIES', () => {
  test('elk product staat er één keer in', () => {
    const keys = VOORRAAD_SUGGESTIES.map(ingredientKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  // De naam in de lijst moet het ingrediënt uit het recept afdekken, anders
  // staat het in je kast en toch op je lijst.
  test.each([
    ['Misopasta', 'witte misopasta'], ['Chipotlesaus', 'milde chipotlesaus'], ['Currypasta', 'rode currypasta'],
    ['Parmezaanse kaas', 'geraspte parmezaanse kaas'], ['Ketjap manis', 'ketjap manis'],
    ['Tomatenblokjes', 'tomatenblokjes (blik)'], ["Tortilla's", "tortilla's"], ['Sesamzaadjes', 'sesamzaadjes'],
  ])('%s in de kast dekt %s', (kastNaam, recept) => {
    expect(inVoorraad(ingredientKey(recept), new Set([ingredientKey(kastNaam)]))).toBe(true)
  })
})

describe('voorraadNaam', () => {
  test('neemt de naam uit de lijst als die past', () => {
    expect(voorraadNaam('miso')).toBe('Misopasta')
    expect(voorraadNaam(' Chipotle ')).toBe('Chipotlesaus')
    expect(voorraadNaam('rijst')).toBe('Rijst')
    expect(voorraadNaam('sojasaus')).toBe('Sojasaus')
  })

  test('laat staan wat er niet in staat, met een hoofdletter', () => {
    expect(voorraadNaam('truffelolie')).toBe('Truffelolie')
    expect(voorraadNaam('ui')).toBe('Ui')
    expect(voorraadNaam('   ')).toBe('')
  })
})
