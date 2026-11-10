/**
 * Welke ingrediënten noemt een bereidingsstap? De kookmodus toont die als chips
 * onder de stap, met de hoeveelheid erbij.
 *
 * Eerder keek de kookmodus of het eerste woord van de ingrediëntnaam ergens in
 * de tekst voorkwam. Dat gaf twee soorten fouten:
 *  - "tomaten" stond als chip bij een stap over "tomatenpuree" (een ander
 *    product dat toevallig met dezelfde letters begint);
 *  - "kidneybonen" ontbrak bij een stap die "de bonen" noemt, en "ui" kwam
 *    nooit voor omdat woorden korter dan vier letters niet meetelden.
 *
 * Nu vergelijken we hele woorden: gelijk (op enkel- of meervoud na), of de
 * naam in de stap is het laatste deel van een samenstelling uit de lijst
 * ("bonen" bij "kidneybonen"). Een woord dat alleen begint met de naam
 * ("tomatenpuree" bij "tomaten") telt niet.
 */

/** Woorden in een ingrediëntnaam die zelf geen product zijn. */
const GEEN_PRODUCT = new Set([
  'en', 'of', 'de', 'het', 'een', 'met', 'zonder', 'voor', 'om', 'te', 'in', 'op', 'naar', 'uit', 'van', 'plus', 'bv', 'zoals',
  'fijn', 'fijne', 'grof', 'grove', 'zwarte', 'bruine', 'donkere', 'losse', 'smaak', 'blik', 'blikje', 'blikken', 'pot', 'zak', 'zakje', 'pak', 'pakje', 'spray', 'vel', 'huid', 'extra', 'vierge', 'optioneel',
  'lichte', 'milde', 'zoete', 'hete', 'scherpe', 'dikke', 'dunne', 'zachte', 'verse', 'vers', 'gedroogde', 'gedroogd', 'gemalen', 'gehakte', 'gesnipperde', 'gesneden', 'fijngehakte', 'geraspte',
  'grote', 'kleine', 'middelgrote', 'rijpe', 'jonge', 'flinke', 'halfvolle', 'volle', 'magere', 'rode', 'witte', 'gele', 'groene',
  'kleine', 'handvol', 'handje', 'takjes', 'takje', 'bosje', 'blaadjes', 'teentjes', 'teen', 'tenen', 'stuks', 'stuk', 'snufje',
  'scheutje', 'beetje', 'paar', 'wat', 'naturel', 'diepvries', 'biologische', 'ongezouten', 'gezouten', 'zachte', 'harde',
  'to', 'and', 'or', 'the', 'of', 'with', 'for', 'fresh', 'dried', 'ground', 'chopped', 'large', 'small', 'medium', 'sprigs', 'handful',
])

/** "gepelde", "gekookte", "geroosterde", "ongekookt": een toestand, geen product. */
const VOLTOOID_DEELWOORD = /^(?:\w*ge\w{3,}(?:te|de)|ongekookt|ongebakken)$/

/** Algemene woorden waar een stap niet het ingrediënt mee bedoelt: "de saus" is niet per se sojasaus. */
const TE_ALGEMEEN_ALS_STAART = new Set(['saus', 'melk', 'pasta', 'soep', 'mix', 'puree', 'poeder', 'blokjes', 'plakjes', 'stukjes', 'vlokken', 'blaadjes', 'zaad'])

export function woorden(tekst: string): string[] {
  return tekst
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]s\b/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean)
}

/** Enkel- en meervoud op één lijn: "bonen" en "boon", "uien" en "ui", "avocado's" en "avocado". */
const VASTE_STAM: Record<string, string> = {
  uien: 'ui', uitje: 'ui', uitjes: 'ui', eieren: 'ei', eitje: 'ei', eitjes: 'ei', tomaat: 'tomat', boon: 'bon',
  peren: 'peer', appels: 'appel',
}

export function stam(woord: string): string {
  if (VASTE_STAM[woord]) return VASTE_STAM[woord]
  let w = woord
  if (w.length > 5 && w.endsWith('tjes')) w = w.slice(0, -4)
  else if (w.length > 6 && w.endsWith('jes')) w = w.slice(0, -3)
  // "citroen", "limoen" en "pompoen" zijn enkelvoud; "citroenen" niet.
  else if (w.length > 4 && w.endsWith('en') && !/[oe]en$/.test(w.replace(/enen$/, 'XX'))) {
    w = w.slice(0, -2)
    // "sjalotten" -> "sjalot", "kippen" -> "kip".
    if (w.length > 3 && w.at(-1) === w.at(-2)) w = w.slice(0, -1)
  } else if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  // "aubergines" en "aubergine", "courgettes" en "courgette": ook de laatste e laten we vallen.
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1)
  if (w.length > 3 && w.at(-1) === w.at(-2) && w.endsWith('t')) w = w.slice(0, -1)
  return w
}

/** De productwoorden van een ingrediëntnaam: haakjes en wat na de komma staat vallen weg. */
export function productWoorden(naam: string): string[] {
  const kort = naam.replace(/\([^)]*\)/g, ' ').split(',')[0]
  return woorden(kort).filter((w) => w.length >= 2 && !GEEN_PRODUCT.has(w) && !VOLTOOID_DEELWOORD.test(w))
}

/** Wat achter een productnaam kan staan zonder dat het een ander product wordt: "citroensap", "knoflookteentjes". */
const ONSCHULDIGE_STAART = /^(?:sap|rasp|schil|blaadjes|blad|partjes|plakjes|plakken|ringen|blokjes|reepjes|snippers|zaadjes|teentjes|teen|tenen|teentje|filet|filets|steeltjes|steel|stelen|mengsel|roosjes|stuk|stukken|sneetjes|bladeren|wortel|knol|knollen|blokje|blokjes|tablet|vlokken|stukjes|schijfjes|takjes|sprieten|bolletjes)$/

/**
 * Algemene woorden die een stap voor een soort gebruikt: "schep de kip terug"
 * bij ingrediënt kipfilet of kippendij, "de kaas" bij geraspte kaas.
 */
const ALGEMEEN = new Set(['kip', 'kaas', 'noten'])

/**
 * Gewone woorden uit een bereidingstekst die toevallig het einde zijn van een
 * ingrediëntnaam: "zijn" in "rijstazijn", "een" in "winterpeen", "folie" in
 * "olijfolie". Zonder deze lijst kreeg je chips voor producten die de stap
 * helemaal niet noemt.
 */
const STAP_WOORD_GEEN_PRODUCT = new Set([
  'zijn', 'een', 'ook', 'andere', 'aan', 'uit', 'pel', 'vel', 'vorm', 'folie', 'bak', 'vet', 'kruid', 'kruiden', 'vulling',
  'groenten', 'wortel', 'wortels', 'peper', 'sap', 'blokjes', 'plakjes', 'stukjes', 'mengsel', 'saus', 'deeg',
  'door', 'over', 'naar', 'kant', 'laat', 'heel', 'hele', 'goed', 'klaar', 'nodig', 'extra', 'kleine', 'grote', 'zacht',
])

/** Bij deze producten is het poeder hetzelfde als het product zelf in de stap ("komijn" bij komijnpoeder). */
const POEDER_IS_HETZELFDE = new Set(['komijn', 'koriander', 'kaneel', 'cacao', 'kurkuma', 'nootmuskaat', 'curry', 'kardemom'])

/** Noemt dit woord uit de stap dit ingrediëntwoord? */
export function zelfdeWoord(stapWoord: string, naamWoord: string): boolean {
  const s = stam(stapWoord)
  const n = stam(naamWoord)
  if (s === n) return true
  // "olie" in de stap is geen sesamolie.
  if (s === 'olie' && /sesam|chili/.test(naamWoord)) return false
  if (ALGEMEEN.has(s) && n.length > s.length && n.startsWith(s) && !/bouillon|blokje|saus|poeder|smaak/.test(naamWoord)) return true
  // Een alledaags woord uit de stap ("zijn", "een") is nooit het einde van een productnaam.
  if (stapWoord.length < 4 || STAP_WOORD_GEEN_PRODUCT.has(stapWoord) || STAP_WOORD_GEEN_PRODUCT.has(s)) return false
  // De stap zegt "bonen" of "wortel", het ingrediënt is "kidneybonen" of "winterwortels".
  if (s.length >= 3 && !TE_ALGEMEEN_ALS_STAART.has(s) && n.length > s.length + 2 && (n.endsWith(s) || naamWoord.endsWith(stapWoord))) return true
  // "citroensap" in de stap bij ingrediënt "citroen" (of andersom), maar niet "tomatenpuree" bij "tomaten".
  const [kort, lang] = s.length <= n.length ? [s, n] : [n, s]
  const langRuw = s.length <= n.length ? naamWoord : stapWoord
  const onschuldig = (ruw: string, begin: string) =>
    begin.length >= 3 && ruw.startsWith(begin) && (
      ONSCHULDIGE_STAART.test(ruw.slice(begin.length))
      || (ruw.slice(begin.length) === 'poeder' && POEDER_IS_HETZELFDE.has(begin)))
  if (onschuldig(langRuw, kort) || onschuldig(lang, kort)) return true
  return false
}

/**
 * Welke woorden van een ingrediënt de stap kan noemen: alle productwoorden
 * ("zwarte bonen in blik" → zwarte, bonen; "rode ui" → ui). Bijvoeglijke
 * naamwoorden en verpakkingen staan in GEEN_PRODUCT.
 */
export function zoekWoorden(naam: string): string[] {
  return [...new Set(productWoorden(naam))]
}

export function noemtIngredient(stapTekst: string, naam: string): boolean {
  const tekst = woorden(stapTekst)
  return zoekWoorden(naam).some((z) => tekst.some((s) => zelfdeWoord(s, z)))
}
