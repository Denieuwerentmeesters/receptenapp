import { describe, expect, test } from 'vitest'
import { isBijzonderKruid, isDroogKruid } from './kruiden'
import { ingredientKey } from './schaal'

const key = (naam: string) => ingredientKey(naam)

describe('isDroogKruid', () => {
  test.each(['paprikapoeder', 'gerookte paprikapoeder', 'komijnzaad', 'kaneel', 'laurierblaadje',
    'nootmuskaat', 'italiaanse kruiden', 'chilivlokken', 'currypoeder', 'zwarte peper'])(
    '%s staat in het kruidenrek', (naam) => { expect(isDroogKruid(key(naam))).toBe(true) },
  )

  test.each(['gezouten roomboter', 'ongezouten boter', 'gezouten cashewnoten', 'poedersuiker',
    'zoute sojasaus', 'zelfrijzend bakmeel', 'cacaopoeder', 'kurkumawortel', 'blokjes tuinkruidenbouillon'])(
    '%s is geen droog kruid', (naam) => { expect(isDroogKruid(key(naam))).toBe(false) },
  )

  test('bijzondere kruiden vallen er niet onder', () => {
    expect(isDroogKruid(key('sumak'))).toBe(false)
    expect(isDroogKruid(key('kardemompeulen'))).toBe(false)
  })
})

describe('isBijzonderKruid', () => {
  test.each(['sumak', "za'atar", 'ras el hanout', 'kardemompeulen', 'steranijs', 'saffraan',
    'Chinees vijfkruidenpoeder', 'karwijzaad', 'Mexicaanse oregano', 'jeneverbessen, gekneusd'])(
    '%s vragen we na', (naam) => { expect(isBijzonderKruid(key(naam))).toBe(true) },
  )

  test.each(['paprikapoeder', 'oregano', 'komijn', 'kaneel'])(
    '%s is gewoon', (naam) => { expect(isBijzonderKruid(key(naam))).toBe(false) },
  )
})
