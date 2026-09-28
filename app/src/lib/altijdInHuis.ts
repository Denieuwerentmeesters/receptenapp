/**
 * Wat iedereen in huis heeft: water, peper en zout, suiker, bouillon. Die
 * komen nooit op de boodschappenlijst — "1 l kokendheet water" of "peper en
 * zout" tussen je boodschappen is ruis. In het recept zelf blijven ze staan.
 *
 * We kijken naar de ingredient_key (lib/schaal.ts), dus na het weghalen van
 * accenten, "naar smaak", haakjes en de meervouds-s. Een sleutel telt alleen
 * mee als élk woord erin bij één groep hoort en er minstens één kernwoord in
 * zit. Zo valt "peper en zout" eraf, maar "rode peper", "watermeloen" en
 * "poedersuiker" niet.
 */
const GROEPEN: { kern: string[]; bijwoorden: string[] }[] = [
  {
    kern: ['water'],
    bijwoorden: ['kokend', 'kokendheet', 'heet', 'hete', 'warm', 'warme', 'lauw', 'lauwwarm',
      'lauwwarme', 'gekookt', 'koud', 'koude', 'ijskoud', 'ijskoude', 'kraanwater', 'of'],
  },
  {
    kern: ['zout', 'peper', 'zeezout', 'zeezoutvlok', 'zeezoutvlokken', 'zoutvlok', 'zoutvlokken'],
    bijwoorden: ['en', 'of', 'zwarte', 'witte', 'grof', 'grove', 'fijn', 'fijne', 'snuf', 'snufje',
      'versgemalen', 'maldon', 'mespunt', 'uit', 'de', 'molen', 'wat', 'beetje'],
  },
  {
    kern: ['suiker', 'kristalsuiker'],
    bijwoorden: ['fijn', 'fijne', 'witte', 'wat', 'beetje', 'snufje'],
  },
  {
    kern: ['bouillon', 'kippenbouillon', 'groentebouillon', 'runderbouillon', 'visbouillon',
      'bouillonblokje', 'kippenbouillonblokje', 'groentebouillonblokje', 'runderbouillonblokje',
      'bouillonpoeder', 'bouillontablet', 'groentenbouillon', 'kruidenbouillon',
      'tuinkruidenbouillon', 'rundervleesbouillon', 'kippenbouillontablet', 'groentebouillontablet'],
    bijwoorden: ['kippen', 'groente', 'runder', 'of', 'en', 'heet', 'hete', 'warm', 'warme',
      'blokje', 'blokjes', 'tablet', 'sterke', 'verkruimeld'],
  },
]

export function altijdInHuis(ingredientKey: string): boolean {
  const woorden = ingredientKey.split(' ').filter(Boolean)
  if (woorden.length === 0) return false
  return GROEPEN.some(({ kern, bijwoorden }) =>
    woorden.some((w) => kern.includes(w))
    && woorden.every((w) => kern.includes(w) || bijwoorden.includes(w)))
}
