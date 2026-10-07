import { describe, expect, test } from 'vitest'
import { enkelvoudVormen, zoekProduct } from './ah'
import { ingredientKey } from './schaal'

const MAPPING: Record<string, string> = {
  cherrytomaten: 'AH Cherrytomaten', worst: 'Worst', aardappel: 'Aardappelen', bol: 'Bol',
  kappertjes: 'Kappertjes', 'rode ui': 'Rode ui',
}
const vind = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, MAPPING)

describe('verkleinwoorden', () => {
  test.each([
    ['cherrytomaatjes', 'AH Cherrytomaten'], ['rijpe cherrytomaatjes', 'AH Cherrytomaten'],
    ['worstjes', 'Worst'], ['aardappeltjes', 'Aardappelen'], ['bolletje', 'Bol'],
  ])('%s → %s', (naam, product) => { expect(vind(naam)).toBe(product) })

  test('geen verkleinwoord, geen extra vormen', () => {
    expect(enkelvoudVormen('ui')).toEqual([])
  })
})

describe('keuze in het recept: de eerste telt', () => {
  const KEUZE: Record<string, string> = {
    pitabroodje: 'Pita', wraps: 'Wraps', sojasaus: 'Sojasaus', groentebouillon: 'Groentebouillon',
    doperwten: 'Doperwten', winterwortel: 'Winterwortel',
  }
  const kies = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, KEUZE)

  test.each([
    ['wraps of pitabroodjes', 'Wraps'],
    ['pitabroodjes of wraps', 'Pita'],
    // De eerste staat niet in de mapping: dan de tweede.
    ['tamari of sojasaus', 'Sojasaus'],
    // Gedeeld woorddeel of geen product voor de "of": zoeken op de hele naam.
    ['kippen- of groentebouillon', 'Groentebouillon'],
    ['verse of diepvries doperwten', 'Doperwten'],
    ['winterwortel, in blokjes of plakjes', 'Winterwortel'],
  ])('%s → %s', (naam, product) => { expect(kies(naam)).toBe(product) })
})

describe('gedroogd kruid krijgt niet het verse product', () => {
  const KRUID: Record<string, string> = { koriander: 'Bosje koriander', korianderpoeder: 'Potje koriander', tijm: 'Takjes tijm' }
  const kies = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, KRUID)

  test.each([
    ['verse koriander', 'Bosje koriander'], ['koriander', 'Bosje koriander'],
    ['gemalen koriander', 'Potje koriander'], ['korianderpoeder', 'Potje koriander'],
    ['tijm', 'Takjes tijm'], ['gedroogde tijm', undefined],
  ])('%s → %s', (naam, product) => { expect(kies(naam)).toBe(product) })
})

describe('de deelmatch laat alleen vallen wat het product niet verandert', () => {
  const M: Record<string, string> = {
    sambal: 'Sambal oelek', paprikapoeder: 'Paprikapoeder mild', ui: 'Uien', bosui: 'Bosui', bloem: 'Tarwebloem',
    'witte wijn': 'Witte wijn', 'witte wijnazijn': 'Witte wijnazijn', kikkererwten: 'Kikkererwten', tomaten: 'Tomaten',
    tomatenpuree: 'Tomatenpuree', cashewnoten: 'Cashewnoten', paprika: 'Paprika', guacamole: 'Guacamole',
    'zure room': 'Sour cream', sojasaus: 'Sojasaus', tijm: 'Tijm', zalmfilet: 'Zalmfilet',
  }
  const kies = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, M)

  test.each([
    ['sambal badjak', undefined], ['pittige paprikapoeder', undefined], ['gerookte paprikapoeder', undefined],
    ['eetbare bloemen', undefined], ['tomaten in blik', undefined], ['geroosterde paprika', undefined],
    ['lente-uien, in ringetjes', 'Bosui'], ['witte wijn azijn', 'Witte wijnazijn'], ['gele uien, gehalveerd', 'Uien'],
    ['ui, fijngesnipperd', 'Uien'], ['kikkererwten uit blik, uitgelekt', 'Kikkererwten'],
    ['klein blikje tomatenpuree (70 g)', 'Tomatenpuree'], ['geroosterde cashewnoten', 'Cashewnoten'],
    ['zalmfilet, zonder huid', 'Zalmfilet'], ['tijm, blad gehakt', 'Tijm'],
    ['guacamole, zure room of tomatensalsa (optioneel)', 'Guacamole'], ['tamari of sojasaus', 'Sojasaus'],
  ])('%s → %s', (naam, product) => { expect(kies(naam)).toBe(product) })
})

describe('keuze tussen haakjes: de eerste telt, met de bereiding ervoor', () => {
  const HAAKJES: Record<string, string> = {
    'geraspte cheddar': 'Geraspte cheddar', cheddar: 'Cheddar plakken', 'geraspte kaas': 'Geraspte kaas',
    'parmezaanse kaas': 'Parmezaan', stilton: 'Stilton', paprika: 'Paprika',
    fusilli: 'Fusilli', penne: 'Penne', snijbiet: 'Snijbiet',
    rundergehakt: 'Rundergehakt', 'vegetarisch gehakt': 'Vegagehakt', vegagehakt: 'Vegagehakt',
    mais: 'Mais', tortilla: 'Tortilla', rucola: 'Rucola', 'gemengde sla': 'Gemengde sla',
  }
  const kies = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, HAAKJES)

  test.each([
    ['geraspte kaas (cheddar of jong belegen)', 'Geraspte cheddar'],
    ['grof geraspte kaas (cheddar of belegen)', 'Geraspte cheddar'],
    // Geen van de keuzes bekend: dan de hele naam.
    ['geraspte kaas (zoals Appenzeller, Gruyère of Emmentaler)', 'Geraspte kaas'],
    ['paprika (rood of groen)', 'Paprika'],
    // Het soortwoord valt weg: niet "blauwe stilton".
    ['blauwe kaas (stilton of roquefort)', 'Stilton'],
    ['pasta (fusilli of penne)', 'Fusilli'],
    ['bladgroente (bijv. snijbiet of Chinese kool), in reepjes', 'Snijbiet'],
    // "(of …)": eerst het ingrediënt zelf, dan het alternatief.
    ['rundergehakt (of vegetarisch gehakt)', 'Rundergehakt'],
    ['vegagehakt (of gehakt)', 'Vegagehakt'],
    ['Grana Padano (of Parmezaanse kaas)', 'Parmezaan'],
    // Een eigenschap vervangt het product niet: geen pak mais.
    ["kleine zachte tortilla's (mais of tarwe)", 'Tortilla'],
    // Een mix is geen keuze.
    ['gemengde sla (rucola, mosterdblad, bietenblad of veldsla)', 'Gemengde sla'],
  ])('%s → %s', (naam, product) => { expect(kies(naam)).toBe(product) })
})

describe('gedroogd en geraspt zijn een eigen product', () => {
  const M: Record<string, { weergavenaam: string }> = {
    paddenstoelen: { weergavenaam: 'ah witte champignons' }, 'gedroogde tomaten': { weergavenaam: 'ah gedroogde tomaten' },
    tomaten: { weergavenaam: 'ah tomaten' }, oregano: { weergavenaam: 'ah oregano' },
    kaas: { weergavenaam: 'ah goudse jong 48 plakken' }, cheddar: { weergavenaam: 'ah smeltkaas met cheddar plakken' },
    'geraspte cheddar': { weergavenaam: 'ah cheddar geraspte kaas' }, 'parmezaanse kaas': { weergavenaam: 'ah parmigiano reggiano' },
    gember: { weergavenaam: 'ah gember' },
  }
  const kies = (naam: string) => zoekProduct({ ingredient_key: ingredientKey(naam), naam }, M)?.weergavenaam

  test.each([
    ['gedroogde paddenstoelen', undefined], ['paddenstoelen', 'ah witte champignons'],
    ['gedroogde tomaten', 'ah gedroogde tomaten'], ['gedroogde oregano', 'ah oregano'],
    ['geraspte kaas', undefined], ['grof geraspte kaas', undefined], ['kaas', 'ah goudse jong 48 plakken'],
    ['geraspte cheddar', 'ah cheddar geraspte kaas'], ['cheddar', 'ah smeltkaas met cheddar plakken'],
    ['geraspte Parmezaanse kaas', 'ah parmigiano reggiano'], ['gember, geraspt', 'ah gember'],
  ])('%s → %s', (naam, product) => { expect(kies(naam)).toBe(product) })
})
