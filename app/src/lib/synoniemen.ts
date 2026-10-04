import { ingredientKey } from './schaal'

/**
 * Ingrediënten die in recepten anders heten maar in de winkel hetzelfde zijn.
 *
 * "knoflooktenen", "teentjes knoflook" en "knoflook, fijngehakt" zijn allemaal
 * gewoon knoflook: één regel op je lijst, en staat knoflook in je voorraadkast,
 * dan hoeft geen van drieën op de lijst.
 *
 * Dit hoort bewust niet in ingredientKey: die sleutel moet op drie plekken
 * identiek blijven (SQL, app, script) en ligt vast in opgeslagen rijen. Dit is
 * een laag erbovenop, alleen in de app.
 */
const TEEN = '(?:teen|teentje|teentjes|tenen)'
const KNOFLOOK = new RegExp(`^(?:${TEEN} )?knoflook(?:${TEEN})?(?: ${TEEN})?(?: .*)?$`)

/** Tenen en teentjes tellen op als één eenheid. */
export const TENEN = new Set(['teen', 'teentje', 'teentjes', 'tenen'])

/**
 * Een maat die in de naam is beland ("gram kurkuma", "theelepel komijn"): die
 * hoort niet bij het product.
 */
const MAAT_VOORAAN = /^(?:gram|kilo|theelepels?|eetlepels?|tl|el|snufje|mespuntje) (?=.)/

/** Kruiden die ook als "…poeder" in recepten staan maar hetzelfde potje zijn. */
const POEDER_IS_KRUID = /^(kurkuma|komijn|kaneel)poeder$/

/**
 * Kruiden die vers én gedroogd bestaan. ingredientKey haalt "gemalen" en
 * "gedroogde" weg, dus de sleutel is voor allebei "koriander" — maar een bosje
 * verse koriander en een potje gemalen koriander zijn twee producten.
 */
const VERS_KRUID = /^(basilicum|peterselie|bieslook|dille|koriander|munt|tijm|rozemarijn|salie|kervel|dragon|marjolein)$/
const DROOG = /\b(gemalen|gedroogde?)\b/

/**
 * Is dit de gedroogde versie van een kruid dat ook vers bestaat? Dan de
 * sleutel van het potje ("gemalen koriander", "gedroogde tijm"), anders null.
 * De naam beslist, want alleen daar staat het nog in.
 */
export function droogKruid(key: string, naam: string): string | null {
  if (key === 'korianderpoeder') return 'gemalen koriander'
  const droog = naam.toLowerCase().match(DROOG)
  if (!droog || !VERS_KRUID.test(key)) return null
  return `${droog[1] === 'gemalen' ? 'gemalen' : 'gedroogde'} ${key}`
}

/**
 * Hoe het recept het wil hebben, achter de naam: "ui gesnipperd", "boter op
 * kamertemperatuur", "olie om in te bakken". Dat blijft hetzelfde product.
 * "In blik" en "in pot" niet: tomaten uit blik zijn iets anders dan tomaten.
 */
export const BEREIDING = / (?:(?:fijn|grof)?(?:gesnipperd|gehakt|gesneden)|gehalveerd|gepeld|geschild|geperst|gesmolten|afgekoeld|schoongemaakt|middelgroot|koud|naar keuze|(?:op )?kamertemperatuur|in (?:\S+ )?(?:blokje|plakje|ring|reepje|stuk|part|vieren|linten|de lengte).*|(?:om|voor|plus) .+)$/

/**
 * Wat ervoor staat maar het product niet verandert: een portie ("takjes
 * dille", "scheutje melk") of een toestand ("rijpe avocado", "koude boter").
 */
const VOORAAN = /^(?:takjes?|blaadjes|bosje|stengels?|handje|handjes|scheutje|snufje|plukje|plakjes|blokjes|rijpe|jonge|middelgrote|flinke|koude|warme|zachte(?= roomboter)|gesmolten|fijne(?= (?:kristal)?suiker)) (?=.)/

/**
 * Dezelfde naam, anders gespeld: los of aan elkaar, Engels of Nederlands. De
 * waarde is de vorm die we aanhouden.
 */
const ANDERS_GESPELD: Record<string, string> = {
  'basmati rijst': 'basmatirijst', 'risotto rijst': 'risottorijst',
  'rodewijnazijn': 'rode wijnazijn', 'rode wijn azijn': 'rode wijnazijn',
  'witte wijn azijn': 'witte wijnazijn', 'wittewijnazijn': 'witte wijnazijn',
  'balsamico azijn': 'balsamicoazijn',
  'cajun kruiden': 'cajunkruiden', 'cheddar kaas': 'cheddar', 'cheddarkaas': 'cheddar',
  'diepvriesdoperwten': 'diepvries doperwten',
  'tortillawraps': 'tortilla wraps', 'volkorenwraps': 'volkoren wraps',
  'jalapeno peper': 'jalapenopeper', 'rode lombok peper': 'rode lombokpeper',
  'digestivekoekje': 'digestive koekje', 'licht bruine basterdsuiker': 'lichtbruine basterdsuiker',
  'chili olie': 'chiliolie', 'crispy chiliolie': 'crispy chili olie',
  'sugar snaps': 'sugarsnaps', 'medjouldadel': 'medjoul dadel', 'hoisin saus': 'hoisinsaus',
  'cherry tomaatje': 'cherrytomaten', 'cherry tomaten': 'cherrytomaten',
  'edamame boontje': 'edamameboontje', 'chili flake': 'chilivlokken', 'chiliflake': 'chilivlokken',
  'wit brood zonder korst': 'witbrood zonder korst', 'mini komkommer': 'minikomkommer',
  'snackkomkommer': 'snack komkommer', 'romainesla': 'romaine sla', 'pita broodje': 'pitabroodje',
  'wit zuurdesem brood': 'wit zuurdesembrood', 'zuurdesem brood': 'zuurdesembrood',
  'paddenstoelen bouillon': 'paddenstoelenbouillon',
  'lente ui': 'bosui', 'lenteui': 'bosui', 'lente uitje': 'bosui',
  'parmezaan': 'parmezaanse kaas', 'parmigiano reggiano': 'parmezaanse kaas',
  // Boter is roomboter, ongezouten, tenzij het recept iets anders zegt.
  'boter': 'roomboter', 'ongezouten boter': 'roomboter', 'ongezouten roomboter': 'roomboter',
  // Yoghurt is volle yoghurt, tenzij het recept iets anders zegt.
  'yoghurt': 'volle yoghurt', 'naturel yoghurt': 'volle yoghurt',
}

/**
 * Enkel- en meervoud en verkleinwoorden van het laatste woord, naar één vorm.
 * Een vaste lijst en geen regel: zonder woordenboek is niet te zeggen wat
 * meervoud is ("kruiden", "linzen"). Dit zijn de paren die in de recepten
 * allebei voorkomen; "rode uien" gaat mee via "uien". We houden de vorm aan
 * die het vaakst voorkomt, dus soms het meervoud ("tomaten").
 */
const EEN_VORM: Record<string, string> = {
  uien: 'ui', preien: 'prei', aardappelen: 'aardappel', aardappeltje: 'aardappel',
  citroenen: 'citroen', limoenen: 'limoen', limoentje: 'limoen',
  sjalotten: 'sjalot', sjalotje: 'sjalot', krielen: 'krieltje',
  kippendijen: 'kippendij', eiwitten: 'eiwit', sesamzaadje: 'sesamzaad',
  bosuitje: 'bosui', bosuien: 'bosui', radijsje: 'radijs',
  venkelknollen: 'venkelknol', winterpenen: 'winterpeen', wortelen: 'wortel',
  gehaktballetje: 'gehaktbal', naanbroodje: 'naanbrood',
  tomaat: 'tomaten', walnoot: 'walnoten', banaan: 'bananen', augurk: 'augurken',
  peer: 'peren', vijg: 'vijgen', biet: 'bieten', bietje: 'bieten',
  doperwtje: 'doperwten', pistachenootje: 'pistachenoten', bospeentje: 'bospenen',
  kerstomaatje: 'cherrytomaten', kerstomaten: 'cherrytomaten',
  cherrytomaatje: 'cherrytomaten', trostomaatje: 'trostomaten',
}

function eenVorm(key: string): string {
  const plek = key.lastIndexOf(' ') + 1
  // "kipdijfilet" en "kippendijfilet" zijn hetzelfde.
  const laatste = key.slice(plek).replace(/^kipdij/, 'kippendij').replace(/filets$/, 'filet')
  return key.slice(0, plek) + (EEN_VORM[laatste] ?? laatste)
}

/**
 * De sleutel van een regel op de lijst: wat in de winkel één product is,
 * krijgt één sleutel. Bovenop `canoniek`:
 *
 *  - wat achter de komma staat telt niet ("ui, gesnipperd" is ui), en een
 *    bereiding of portie eromheen ook niet;
 *  - enkel- en meervoud en andere spellingen gaan naar één vorm;
 *  - vers en gedroogd blijven juist apart: "gemalen koriander" en
 *    "korianderpoeder" zijn hetzelfde potje, "gedroogde tijm" is geen takje.
 *
 * Alleen om regels samen te voegen en met de voorraadkast te vergelijken; het
 * product zoeken gebeurt op de naam (zoekProduct).
 */
export function lijstSleutel(item: { ingredient_key: string; naam: string }): string {
  const kort = item.naam.replace(/\([^)]*\)/g, ' ').split(',')[0]
  let key = canoniek(ingredientKey(kort) || item.ingredient_key)
  const droog = droogKruid(key, item.naam)
  if (droog) return droog
  key = key.replace(BEREIDING, '').replace(VOORAAN, '')
  key = ANDERS_GESPELD[key] ?? key
  key = eenVorm(key)
  return (ANDERS_GESPELD[key] ?? key) || canoniek(item.ingredient_key)
}

export function canoniek(ruw: string): string {
  const key = ruw.replace(MAAT_VOORAAN, '').replace(POEDER_IS_KRUID, '$1')
  if (KNOFLOOK.test(key)) return 'knoflook'
  if (key === 'krop sla' || key === 'kropsla') return 'sla'
  return key
}
