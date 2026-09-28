import { altijdInHuis } from './altijdInHuis'
import { ingredientKey } from './schaal'
import type { Ingredient } from './database.types'

/**
 * Ruwe prijsschatting per recept — genoeg om goedkoop van duur te scheiden,
 * níét om een exact bedrag in een advertentie te zetten. Daarvoor zijn echte
 * AH-prijzen nodig (plan: prijzen per AH-product, zie CLAUDE.md "Wat er nog
 * niet is").
 *
 * Per ingrediënt kijken we in welke klasse het valt. Staat er een gewicht of
 * volume bij, dan rekenen we gram × kiloprijs; anders (stuks, eetlepels,
 * "naar smaak") een vaste schatting voor de hoeveelheid in een recept.
 * Basisvoorraad (lib/altijdInHuis.ts) en olie tellen niet mee — die heb je al.
 *
 * Wordt gebruikt door scripts/prijsschatting.ts (de bestaande recepten) en bij
 * het opslaan van een eigen recept. Pas je de klassen aan, draai dan het
 * script opnieuw zodat de database meeloopt.
 */

/** Tot dit bedrag per persoon heet een recept "budget". */
export const BUDGET_PER_PERSOON = 2.5

interface Klasse {
  naam: string
  patroon: RegExp
  /** Schatting voor de hoeveelheid in een recept voor 4, zonder gewicht erbij. */
  vast: number
  /** Kiloprijs (of literprijs) als het recept wél een gewicht of volume geeft. */
  perKg: number
}

// Volgorde telt: de eerste klasse die past wint. Najaar 2026, supermarktprijzen.
const KLASSEN: Klasse[] = [
  {
    naam: 'vis', vast: 7, perKg: 22,
    patroon: /zalm|tonijnsteak|garnal|gamba|scampi|kabeljauw|zeebaars|dorade|mossel|coquille|kreeft|krab|pangasius|koolvis|heilbot|forel|visfilet|witvis/,
  },
  {
    naam: 'rood vlees', vast: 8, perKg: 25,
    patroon: /biefstuk|entrecote|ossenhaas|lams|kalfs|eend|rundvlees|runderlap|sucade|spareribs|varkenshaas|rosbief|steak|riblap|hertenbiefstuk|kwartel|konijn|wild|buikspek|beenham|procureur|varkensschouder|pulled/,
  },
  {
    naam: 'kip en gehakt', vast: 5, perKg: 11,
    patroon: /kip|gehakt|varkens|schnitzel|slavink|hamburger|shoarma|kalkoen/,
  },
  {
    naam: 'vleeswaren', vast: 2.5, perKg: 16,
    patroon: /chorizo|spek|pancetta|ham\b|serrano|prosciutto|parmaham|salami|worst|bacon/,
  },
  {
    naam: 'dure extra', vast: 2.5, perKg: 20,
    patroon: /pijnboompit|burrata|truffel|saffraan|cashew|walnot|amandel|pistache|hazelnot|pecan|macadamia|avocado|asperge|pesto/,
  },
  {
    naam: 'kaas en zuivel', vast: 1.5, perKg: 9,
    patroon: /kaas|parmezaan|parmigiano|pecorino|mozzarella|feta|halloumi|ricotta|mascarpone|gorgonzola|brie|room|creme fraiche|kokosmelk|yoghurt|kwark|boter|melk/,
  },
  {
    naam: 'groente en overig', vast: 1.2, perKg: 4,
    patroon: /tofu|tempeh|paddenstoel|champignon|oesterzwam|shiitake|spinazie|broccoli|courgette|aubergine|paprika|bloemkool|sperzieboon|boontje|pompoen|zoete aardappel|venkel|olijf|kappertje|zongedroogd|noedel|mie|gnocchi|tortilla|wrap|brood|pita|naan|bladerdeeg|filodeeg|rucola|sla|komkommer|spitskool|paksoi|tauge|mais/,
  },
  {
    naam: 'kruiden en smaakmakers', vast: 0.5, perKg: 0,
    patroon: /koriander|basilicum|peterselie|munt|dragon|bieslook|dille|tijm|rozemarijn|salie|limoen|citroen|gember|chili|peper|currypasta|curry|sojasaus|vissaus|miso|tahin|harissa|sambal|ketjap|azijn|mosterd|honing|paprikapoeder|komijn|kurkuma|kaneel|kerrie|garam|oregano|laurier|nootmuskaat|sesam|pinda|ras el|za atar|sumak|chipotle/,
  },
  {
    naam: 'basis', vast: 0.6, perKg: 2.2,
    patroon: /pasta|spaghetti|penne|macaroni|fusilli|tagliatelle|linguine|orzo|rigatoni|lasagne|rijst|couscous|bulgur|quinoa|linzen|kikkererwt|bonen|kidney|ei\b|eieren|eidooier|aardappel|ui\b|uien|sjalot|knoflook|wortel|kool|prei|tomaat|tomaten|passata|tomatenpuree|bloem|havermout|erwt|diepvries|selderij|biet|pastinaak/,
  },
]
const ONBEKEND: Klasse = { naam: 'onbekend', patroon: /./, vast: 1.2, perKg: 5 }

const PER_EENHEID: Record<string, number> = {
  g: 0.001, gr: 0.001, gram: 0.001, kg: 1, ml: 0.001, cl: 0.01, dl: 0.1, l: 1, liter: 1,
}

function klasseVan(key: string): Klasse | null {
  // "fijngehakt" is geen gehakt; bouillon hoort bij de basisvoorraad, ook als
  // er "kip- of groentebouillon" staat.
  const schoon = key.replace(/\b(fijn|grof)gehakt\b/g, '').trim()
  if (/bouillon|fond\b/.test(schoon)) return null
  return KLASSEN.find((k) => k.patroon.test(schoon)) ?? ONBEKEND
}

function kostenVan(ing: Ingredient, klasse: Klasse): number {
  const hoeveelheid = Number.parseFloat(String(ing.hoeveelheid ?? '').replace(',', '.'))
  const factor = PER_EENHEID[String(ing.eenheid ?? '').toLowerCase().trim()]
  return Number.isFinite(hoeveelheid) && factor && klasse.perKg > 0
    ? hoeveelheid * factor * klasse.perKg
    : klasse.vast
}

/** Valt dit recept in "budget"? Zonder schatting: nee — liever te voorzichtig. */
export function isBudget(recept: { prijs_pp_schatting: number | null }): boolean {
  return recept.prijs_pp_schatting !== null && Number(recept.prijs_pp_schatting) <= BUDGET_PER_PERSOON
}

/** Geschatte prijs per persoon in euro's, afgerond op centen; null zonder ingrediënten. */
export function schatPrijsPerPersoon(recept: { ingredienten: Ingredient[]; personen: number }): number | null {
  let totaal = 0
  let geteld = 0
  for (const ing of recept.ingredienten) {
    const key = ingredientKey(ing.naam ?? '')
    if (!key || altijdInHuis(key) || /olie/.test(key)) continue
    const klasse = klasseVan(key)
    if (!klasse) continue
    totaal += kostenVan(ing, klasse)
    geteld++
  }
  if (geteld === 0) return null
  // De vaste schattingen gaan uit van een recept voor 4; gewichten staan al
  // in de hoeveelheid van het recept zelf.
  const personen = recept.personen > 0 ? recept.personen : 4
  return Math.round((totaal / personen) * 100) / 100
}
