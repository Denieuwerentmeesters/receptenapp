/**
 * Deelt boodschappen in op schap, in de volgorde waarin je door een
 * gemiddelde Albert Heijn loopt: eerst groente en fruit, dan de koeling, dan
 * de droge kruidenierswaren. Zo vink je de lijst van boven naar beneden af.
 *
 * We rekenen de categorie uit bij het tonen, op basis van de ingredient_key,
 * en slaan 'm niet op. Dan krijgen ook bestaande lijsten de indeling, en een
 * verbetering hier werkt meteen overal door.
 *
 * Bij twijfel valt een product in "Overig" — onderaan, maar niet kwijt.
 */

/** Looproute door de winkel. Dit is ook de volgorde op het scherm. */
export const LOOPROUTE = [
  'Groente & aardappelen',
  'Fruit',
  'Verse kruiden',
  'Vlees',
  'Vis',
  'Vega',
  'Kaas',
  'Zuivel & eieren',
  'Brood & beleg',
  'Pasta, rijst & noedels',
  'Wereldkeuken',
  'Conserven & sauzen',
  'Olie, azijn & bouillon',
  'Kruiden & specerijen',
  'Bakken & zoet',
  'Noten & zaden',
  'Deeg & diepvries',
  'Wijn & dranken',
  'Overig',
] as const

export type Schap = (typeof LOOPROUTE)[number]

/** Sleutels die de regels hieronder verkeerd zouden plaatsen. */
const UITZONDERINGEN: Record<string, Schap> = {
  'kruidenboter': 'Zuivel & eieren',
  'kruidenroomkaas': 'Kaas',
  'pindakaas': 'Brood & beleg',
  'gezouten pinda': 'Noten & zaden',
  'bloemkoolrijst': 'Groente & aardappelen',
  'citroengras': 'Groente & aardappelen',
  'gebakken uitje': 'Wereldkeuken',
  'granaatappelmelasse': 'Wereldkeuken',
  'bakpoeder': 'Bakken & zoet',
  'eekhoorntjesbrood': 'Groente & aardappelen',
  'gele curry kruidenpasta': 'Wereldkeuken',
  'tuinerwten': 'Conserven & sauzen',
  'half om half': 'Vlees',
  'dragon': 'Verse kruiden',
  'aardappelpuree': 'Overig',
  'bietensap': 'Overig',
}

/**
 * De volgorde hier is de volgorde van controleren, niet van tonen: de
 * specifieke regels eerst. "Paprikapoeder" moet bij de specerijen landen
 * voordat "paprika" 'm naar de groente trekt, "kokosmelk" bij de wereldkeuken
 * voordat "melk" 'm naar de zuivel trekt.
 */
const REGELS: [Schap, RegExp][] = [
  // Verse peulvruchten, vóór "bonen" bij de conserven.
  ['Groente & aardappelen', /sperziebon|snijbon|tuinbon|sojabon|edamame|sugar ?snap|doperwt/],
  ['Kruiden & specerijen', /poeder|kruiden|zout|peperkorrel|zwarte peper|witte peper|cayennepeper|kaneel|komijn|kurkuma|nootmuskaat|kardemom|kruidnagel|steranijs|piment|laurier|jeneverbes|karwij|mosterdzaad|korianderzaad|sumak|garam masala|chilivlok|oregano|ras el hanout|za.?atar|saffraan/],
  ['Olie, azijn & bouillon', /olie|azijn|balsamico|bouillon/],
  ['Wereldkeuken', /soja ?saus|ketjap|curry|tikka|sambal|vissaus|oestersaus|mirin|miso|gochujang|kimchi|nori|sriracha|sweet chili|teriyaki|tahin|harissa|tamarinde|trassie|seroendeng|kroepoek|ponzu|kokos|laos|gyoza|roti|tortilla|wraps?\b|naan|pita|flatbread|chutney|hot sauce|tabasco|chipotle|zeewier|trassi|nacho/],
  ['Conserven & sauzen', /passata|tomatenpuree|tomatenblok|zongedroogd|geroosterde paprika|zilveruitje|bonen|bonenmix|kikkererwt|linzen|spliterwt|olijven|kappertje|artisjok|pesto|ketchup|mayo|mosterd|saus|hummus|guacamole|worcestershire|maiskorrel|cornichon|augurk/],
  ['Kaas', /kaas|feta|mozzarella|burrata|stracciatella|brie|cheddar|parmezaan|parmigiano|pecorino|gorgonzola|halloumi|manchego|mascarpone|ricotta|cottage cheese|gruyere|boursin|comte|emmentaler|gouda/],
  ['Zuivel & eieren', /melk|yoghurt|room|creme fraiche|boter|eieren|^ei\b|eiwit|eigeel|eidooier/],
  ['Vis', /zalm|tonijn|garnaal|garnalen|gamba|ansjovis|kabeljauw|dorade|roodbaars|haring|mossel|coquille|kreeft|vis/],
  ['Vlees', /kip|gehakt|rund|varkens|spek|bacon|achterham|beenham|schouderham|parmaham|pancetta|prosciutto|chorizo|worst|biefstuk|bavette|ribeye|ossenhaas|rosbief|carpaccio|procureur|kalkoen|lams|eend|serrano|nduja|salami/],
  ['Vega', /tofu|tempeh/],
  ['Pasta, rijst & noedels', /pasta|spaghetti|penne|fusilli|farfalle|rigatoni|linguine|tagliatelle|pappardelle|orecchiette|mafaldine|macaroni|orzo|lasagne|gnocchi|tortellini|ravioli|rijst|noedel|^mie|\bramen|udon|couscous|bulgur|quinoa/],
  ['Brood & beleg', /brood|ciabatta|focaccia|crouton|jam$|stroop|ontbijtkoek|honing/],
  ['Bakken & zoet', /bloem$|meel$|havervlok|gist$|gelatine|chocolade|koekje|lange vinger|bastogne|suiker|maizena|vanille|siroop|panko|broodkruim|rozijn|dadel|sukade|cornflake/],
  ['Noten & zaden', /noten|amandel|pinda|pijnboompit|sesam|pompoenpit|cashew|walnoot|pecan|macadamia|pistache|chiazaad|lijnzaad/],
  ['Deeg & diepvries', /deeg|diepvries/],
  ['Wijn & dranken', /wijn|port$|bier$|cognac|rum$|sherry|cider/],
  ['Verse kruiden', /basilicum|peterselie|bieslook|dille|koriander|munt|tijm|rozemarijn|salie|kervel/],
  ['Fruit', /citroen|limoen|sinaasappel|(^|\s)appels?\b|aardbei|framboz|bessen|bramen|ananas|mango|perzik|nectarine|druiven|kersen|meloen|granaatappel|banaan|bananen|\bpeer\b|peren|grapefruit|cranberr/],
  ['Groente & aardappelen', /aardappel|kriel|\bui\b|uien|uitje|bosui|sjalot|knoflook|prei|wortel|peen|penen|peultje|little gem|paprika|tomaat|tomaten|courgett|aubergine|spinazie|sla\b|salade|rucola|andijvie|kool|broccoli|bimi|champignon|paddenstoel|zwam|shiitake|eekhoorntjesbrood|asperge|venkel|selderij|komkommer|radijs|biet|pompoen|peper|chili|jalapeno|gember|mais|paksoi|spruit|witlof|tauge|avocado|cavolo nero|groente|raap|pastinaak|knol/],
]

export function schapVoor(ingredientKey: string): Schap {
  const key = ingredientKey.toLowerCase().trim()
  const uitzondering = UITZONDERINGEN[key]
  if (uitzondering) return uitzondering
  for (const [schap, patroon] of REGELS) {
    if (patroon.test(key)) return schap
  }
  return 'Overig'
}
