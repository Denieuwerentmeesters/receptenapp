import { expect, test } from 'vitest'
import { altijdInHuis } from './altijdInHuis'
import { ingredientKey } from './schaal'

test.each(['keukentouw', 'springvorm (24 cm)', 'ronde taartvorm', 'ovenbestendige stoofpan', 'slowcooker',
  'bakplaat', 'eventueel een spuitzak en grof spuitmondje', 'pot met deksel van 500 ml'])(
  '%s is keukengerei, geen boodschap', (naam) => { expect(altijdInHuis(ingredientKey(naam))).toBe(true) },
)

test.each(['potje pesto', 'pompoen', 'taartdeeg', 'stoofvlees'])('%s blijft een boodschap', (naam) => {
  expect(altijdInHuis(ingredientKey(naam))).toBe(false)
})
