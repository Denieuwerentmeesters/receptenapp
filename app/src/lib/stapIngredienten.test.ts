import { describe, expect, test } from 'vitest'
import { noemtIngredient } from './stapIngredienten'

const TACO =
  'Bak de ui 2 tot 3 minuten in wat olie, voeg de kruidenmix toe en bak 1 minuut mee, roer dan de tomatenpuree erdoor en bak nog 2 minuten. ' +
  'Schep de bonen erbij en laat ze op middelhoog vuur 10 minuten zachtjes stoven. Breng op smaak met zout en peper.'

describe('noemtIngredient', () => {
  test('tomaten staan niet bij een stap over tomatenpuree', () => {
    expect(noemtIngredient(TACO, 'tomaten')).toBe(false)
    expect(noemtIngredient(TACO, 'tomatenpuree')).toBe(true)
  })

  test('bonen in de stap horen bij kidneybonen in de lijst', () => {
    expect(noemtIngredient(TACO, 'kidneybonen')).toBe(true)
    expect(noemtIngredient(TACO, 'zwarte bonen in blik')).toBe(true)
  })

  test('korte namen als ui tellen mee, ook als de lijst "rode ui" zegt', () => {
    expect(noemtIngredient(TACO, 'ui')).toBe(true)
    expect(noemtIngredient(TACO, 'rode ui')).toBe(true)
    expect(noemtIngredient(TACO, 'uien (middelgroot)')).toBe(true)
  })

  test('peper en zout', () => {
    expect(noemtIngredient(TACO, 'peper en zout')).toBe(true)
  })

  test('enkel- en meervoud', () => {
    expect(noemtIngredient('Snijd de sjalot fijn.', 'sjalotten')).toBe(true)
    expect(noemtIngredient('Pers het sap van de citroenen.', 'citroen')).toBe(true)
    expect(noemtIngredient('Halveer de avocado.', "avocado's")).toBe(true)
  })

  test('samenstellingen met een onschuldig deel erachter', () => {
    expect(noemtIngredient('Rasp de schil van de citroen en pers het citroensap erbij.', 'citroenen')).toBe(true)
    expect(noemtIngredient('Fruit de knoflook.', 'knoflooktenen')).toBe(true)
  })

  test('aubergine, courgette, sesamzaad, gember en venkel in de stap bij de vorm in de lijst', () => {
    expect(noemtIngredient('Bak de aubergine bruin.', 'aubergines')).toBe(true)
    expect(noemtIngredient('Snijd de courgette in stukken.', 'courgettes')).toBe(true)
    expect(noemtIngredient('Bestrooi met sesamzaad.', 'sesamzaadjes')).toBe(true)
    expect(noemtIngredient('Fruit de gember.', 'gemberwortel, geraspt')).toBe(true)
    expect(noemtIngredient('Snijd de venkel fijn.', 'venkelknollen')).toBe(true)
  })

  test('een ander product dat met dezelfde letters begint telt niet', () => {
    expect(noemtIngredient('Roer de kaasazijn erdoor.', 'kaas')).toBe(false)
    expect(noemtIngredient('Meng de komijnpoeder erdoor.', 'komijn')).toBe(true)
    expect(noemtIngredient('Voeg de rijstazijn toe.', 'rijst')).toBe(false)
  })

  test('de kip uit de stap is de kipfilet uit de lijst', () => {
    expect(noemtIngredient('Schep de kip terug in de pan.', 'kipfilet zonder vel (4 stuks)')).toBe(true)
  })

  test('niet genoemd is niet genoemd', () => {
    expect(noemtIngredient(TACO, 'knoflook')).toBe(false)
    expect(noemtIngredient(TACO, 'olijfolie')).toBe(true) // "olie" in de stap
  })
})

describe('woorden uit de stap die geen product zijn', () => {
  const STAP = 'Snijd de kipfilet in lange repen, bestrijk met sesamolie en bestrooi met zout en peper. Bak 3 minuten per kant tot ze gaar zijn.'
  test('"zijn" is niet rijstazijn', () => {
    expect(noemtIngredient(STAP, 'rijstazijn')).toBe(false)
    expect(noemtIngredient(STAP, 'wijnazijn')).toBe(false)
  })
  test('wat de stap wel noemt blijft staan', () => {
    expect(noemtIngredient(STAP, 'kipfilet')).toBe(true)
    expect(noemtIngredient(STAP, 'geroosterde sesamolie')).toBe(true)
  })
  test('"een", "ook" en "folie" zijn geen winterpeen, knoflook of olijfolie', () => {
    expect(noemtIngredient('Pak een bakplaat en leg er folie op. Voeg ook wat toe.', 'winterpeen')).toBe(false)
    expect(noemtIngredient('Pak een bakplaat en leg er folie op. Voeg ook wat toe.', 'knoflook')).toBe(false)
    expect(noemtIngredient('Pak een bakplaat en leg er folie op.', 'olijfolie')).toBe(false)
  })
  test('kip in de stap is geen kippenbouillon, paprika geen paprikapoeder', () => {
    expect(noemtIngredient('Schep de kip terug in de pan.', 'kippenbouillon')).toBe(false)
    expect(noemtIngredient('Snijd de paprika in reepjes.', 'paprikapoeder')).toBe(false)
  })
})
