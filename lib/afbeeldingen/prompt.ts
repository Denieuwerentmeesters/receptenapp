/**
 * Bouwt de foodfotografie-prompt voor één recept.
 *
 * Het sjabloon staat in docs/foodfotografie-prompt.md: een vaste kern die nooit
 * verandert, plus variabelen (hoek, compositie, vaatwerk, ondergrond, rekwisieten,
 * garnering) die per recept anders uitpakken. Die keuze is deterministisch: hij
 * volgt uit het recept-id. Twee keer dezelfde prompt voor hetzelfde recept, en
 * de verdeling over de hele pool is vooraf te controleren zonder één afbeelding
 * te betalen (`--dry-run --telling` in scripts/genereer_afbeeldingen.ts).
 *
 * Er zit geen taalmodel tussen. Het beeldmodel snapt een ingrediëntenlijst prima.
 */

export interface ReceptVoorPrompt {
  id: string
  titel: string
  titel_nl: string | null
  keuken: string | null
  tags: string[]
  ingredienten: { naam: string; hoeveelheid?: string | null; eenheid?: string | null }[]
}

export interface PromptKeuzes {
  hoek: string
  compositie: string
  vaatwerk: string
  ondergrond: string
  rekwisieten: string[]
  garnering: string[]
}

export const VASTE_KERN =
  'Professionele redactionele foodfotografie, fotorealistisch, hoge resolutie, vierkant 1:1. ' +
  'Zacht diffuus daglicht van opzij, natuurlijke zachte schaduwen, geen flits, geen harde highlights. ' +
  'Realistische verzadiging, natuurlijk kleurpalet, warme aardetinten met frisse groene accenten. ' +
  'Het eten is het onderwerp en volledig goed zichtbaar: scherp, herkenbaar, appetijtelijk, ' +
  'met zichtbare textuur zoals glans van saus, korstjes, damp, kruimels en spatjes. ' +
  'Een "gebruikt" detail in beeld: bestek dat in het gerecht ligt, een geschepte hap, een druppel saus op de rand. ' +
  'Geen tekst, geen logo\'s, geen watermerk, geen mensen of handen in beeld.'

// ------------------------------------------------------------- de lijsten

const HOEKEN = {
  topdown: 'Recht van boven (90° top-down) genomen foto',
  schuin: '45° schuin van voren genomen foto met ondiepe scherptediepte en zachte achtergrond',
  laag: 'Laag, op ongeveer 30° en bijna op ooghoogte van het bord genomen foto',
  decentraal: 'Recht van boven genomen foto, het bord bewust uit het midden en aan één zijde door de beeldrand gesneden',
} as const

const COMPOSITIES = {
  centraal: 'Eén bord centraal in beeld',
  tweeBorden: 'Twee borden, het tweede valt half buiten beeld',
  pan: 'De hele pan of ovenschaal in beeld, met één portie er al uit geschept',
  schaalEnBord: 'De ovenschaal in beeld, met ernaast een bord met een opgeschepte portie',
  zonderBord: 'Het gerecht ligt direct op de ondergrond, zonder bord',
  closeup: 'Close-up: het beeld gevuld met het gerecht, de ondergrond nauwelijks zichtbaar',
} as const

const VAATWERK = {
  bord: [
    'een rustiek gespikkeld keramieken bord in grijsblauw',
    'een mat gebroken wit aardewerken bord',
    'een strak wit porseleinen bord met brede rand',
  ],
  kom: [
    'een diepe gebroken witte keramieken kom',
    'een rustiek gespikkelde keramieken kom in grijs',
    'een diepe houten kom',
  ],
  pan: [
    'een gietijzeren koekenpan met crèmewitte steel',
    'een grijze steengoed pan met oren',
    'een rode geglazuurde braadpan',
  ],
  ovenschaal: [
    'een geëmailleerde ovenschaal in mintgroen',
    'een geëmailleerde ovenschaal in lichtblauw',
    'een geëmailleerde ovenschaal in zacht geel',
  ],
  plank: ['een olijfhouten snijplank', 'een eenvoudige metalen bakplaat', 'een bamboe dienblad'],
  tagine: ['een rode geglazuurde tagine'],
} as const

const ONDERGRONDEN = {
  beton: 'een lichtgrijze verweerde betonnen ondergrond',
  marmer: 'een wit-grijs marmeren blad met fijne adering',
  lichtHout: 'een verweerd licht houten tafelblad',
  donkerHout: 'een donker geolied eikenhouten tafelblad',
  jute: 'een grofgeweven jute placemat',
  linnenLoper: 'een gestreepte linnen loper',
  linnenKleed: 'een gekreukt linnen tafelkleed in ecru',
  linnenBlauw: 'een gekreukt linnen tafelkleed in grijsblauw',
  bamboe: 'een bamboe placemat op een lichte ondergrond',
  rooster: 'een metalen taartrooster op een linnen doek',
  bakpapier: 'bakpapier op een betonnen blad',
  leisteen: 'een mat zwarte leisteen plaat',
} as const

type OndergrondSleutel = keyof typeof ONDERGRONDEN

// Sfeer per keuken (sjabloon §5): jute en bamboe bij Aziatisch, linnen en marmer
// bij Italiaans, hout en gietijzer bij stoof, beton bij alles wat fris moet ogen.
const ONDERGROND_PER_SFEER: Record<string, OndergrondSleutel[]> = {
  aziatisch: ['bamboe', 'jute', 'leisteen', 'donkerHout', 'beton'],
  italiaans: ['marmer', 'linnenKleed', 'linnenLoper', 'lichtHout', 'beton'],
  mediterraan: ['marmer', 'linnenKleed', 'lichtHout', 'beton', 'linnenBlauw'],
  mexicaans: ['donkerHout', 'linnenLoper', 'beton', 'leisteen', 'lichtHout'],
  frans: ['marmer', 'linnenKleed', 'lichtHout', 'beton'],
  stoof: ['donkerHout', 'lichtHout', 'linnenKleed', 'beton', 'jute'],
  fris: ['beton', 'marmer', 'linnenBlauw', 'lichtHout', 'leisteen'],
  oven: ['bakpapier', 'rooster', 'donkerHout', 'linnenKleed', 'beton'],
  neutraal: ['beton', 'lichtHout', 'linnenKleed', 'marmer', 'linnenLoper', 'donkerHout'],
}

// Garnering die bij de keuken past als het recept er zelf geen noemt.
const GARNERING_PER_SFEER: Record<string, string[]> = {
  aziatisch: ['verse koriander', 'in ringen gesneden lente-ui', 'sesamzaad', 'chiliringetjes', 'een limoenpartje'],
  italiaans: ['verse basilicumblaadjes', 'geschaafde Parmezaan', 'versgemalen zwarte peper', 'platte peterselie'],
  mediterraan: ['platte peterselie', 'een citroenpartje', 'versgemalen zwarte peper', 'verse basilicumblaadjes'],
  mexicaans: ['verse koriander', 'een limoenpartje', 'chiliringetjes'],
  frans: ['platte peterselie', 'versgemalen zwarte peper', 'verse tijm'],
  stoof: ['platte peterselie', 'verse tijm', 'versgemalen zwarte peper'],
  fris: ['verse basilicumblaadjes', 'een citroenpartje', 'dille'],
  oven: ['platte peterselie', 'versgemalen zwarte peper', 'geraspte kaas'],
  neutraal: ['platte peterselie', 'versgemalen zwarte peper', 'een citroenpartje'],
}

// Rekwisieten die alleen mogen als het recept er aanleiding toe geeft (sjabloon §2E).
// Volgorde: [zoekwoord in ingrediënten of titel, rekwisiet].
const REKWISIETEN_OP_INGREDIENT: [RegExp, string][] = [
  [/citroen/i, 'citroenpartjes naast het bord'],
  [/limoen/i, 'limoenpartjes naast het bord'],
  [/parmezaan|pecorino|grana/i, 'een stuk Parmezaan met een rasp'],
  [/olijfolie/i, 'een klein kannetje olijfolie'],
  [/wijn/i, 'een glas wijn, half buiten beeld'],
  [/knoflook/i, 'een losse knoflookbol'],
  [/\bui(en)?\b/i, 'een hele ui op tafel'],
  [/chili|rode peper|spaanse peper|sambal|rawit|jalape/i, 'een schaaltje chiliringetjes'],
  [/basilicum|koriander|peterselie|dille|bieslook|munt|tijm|rozemarijn|salie/i, 'losse verse kruiden naast het bord'],
  [/yoghurt|dressing|saus|pesto|tzatziki|aioli|raita/i, 'een schaaltje saus met een lepeltje'],
  [/sojasaus|ketjap|vissaus/i, 'een schaaltje sojasaus'],
  [/pinda|cashew|amandel|walnoot|pijnboompit|sesam/i, 'een schaaltje noten of zaden'],
  [/tortilla|taco|wrap/i, 'een stapeltje tortilla\'s onder een linnen doek'],
  [/brood|stokbrood|ciabatta|naan|pita/i, 'een afgebroken stuk brood'],
]

const ALGEMENE_REKWISIETEN = [
  'een schaaltje grof zeezout',
  'een pepermolen',
  'een gekreukte linnen theedoek',
  'een glas water, half buiten beeld',
  'een mes met houten heft',
]

// Garnering uit het recept zelf gaat voor op de keuken-standaard.
const GARNERING_UIT_RECEPT: [RegExp, string][] = [
  [/basilicum/i, 'verse basilicumblaadjes'],
  [/koriander/i, 'verse koriander'],
  [/peterselie/i, 'platte peterselie'],
  [/dille/i, 'dille'],
  [/bieslook/i, 'fijngesneden bieslook'],
  [/lente-?ui|bosui/i, 'in ringen gesneden lente-ui'],
  [/sesam/i, 'sesamzaad'],
  [/amandel/i, 'geschaafde amandelen'],
  [/pijnboompit/i, 'pijnboompitten'],
  [/chili|rawit|rode peper|spaanse peper|jalape/i, 'chiliringetjes'],
  [/limoen/i, 'een limoenpartje'],
  [/citroen/i, 'een citroenpartje'],
  [/parmezaan|pecorino|grana/i, 'geschaafde Parmezaan'],
  [/pesto/i, 'een streep pesto'],
  [/munt/i, 'verse muntblaadjes'],
  [/feta/i, 'verkruimelde feta'],
  [/yoghurt/i, 'een lepel yoghurt'],
]

// Ingrediënten die op een foto niets toevoegen: vetten, vloeistoffen, poeders,
// smaakmakers. Getest als woorddeel, dus ook "ongezouten boter" en "currypasta".
const VOORRAADKAST =
  /boter|olie|melk|room\b|slagroom|azijn|bouillon|mosterd|paneermeel|panko|bloem|maizena|suiker|zout|peper\b|poeder|kruiden|specerij|pasta\b.*curry|currypasta|kerriepasta|sambal|sojasaus|ketjap|vissaus|oestersaus|tomatenpuree|honing|siroop|water|wijn|gist|bakpoeder|vanille|kaneel|komijn|kurkuma|koriander(zaad|poeder)|nootmuskaat|laurier|extract|bakpapier|sesamolie|kokosmelk|stroop|marinade/i

// Toevoegingen die de inkoop beschrijven, niet het gerecht.
const INKOOP = /diepvries|\b(in|uit) (blik|pot|glas)\b|\b(gedroogde|oude?|gekookte|rauwe|kant-en-klare)\b|\b(zonder|met) vel\b|\bzonder bot\b|\bvan goede kwaliteit\b|\bbiologisch(e)?\b|\bvers(e)?\b/gi

// ------------------------------------------------------------ hulpfuncties

/** FNV-1a op het recept-id; stabiel, geen dependency nodig. */
function hash(tekst: string, zout: string): number {
  let h = 2166136261
  const s = `${tekst}:${zout}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

function kies<T>(lijst: readonly T[], id: string, zout: string): T {
  return lijst[hash(id, zout) % lijst.length]
}

function kansOnder(id: string, zout: string, drempel: number): boolean {
  return hash(id, zout) % 100 < drempel * 100
}

function sfeerVan(recept: ReceptVoorPrompt): string {
  const keuken = (recept.keuken ?? '').toLowerCase()
  const tekst = `${recept.titel_nl ?? ''} ${recept.titel} ${recept.tags.join(' ')}`.toLowerCase()

  if (/stoof|stew|tagine|goulash|ragout|braad/.test(tekst)) return 'stoof'
  if (/aziat|thai|indon|indisch|india|japan|chin|korea|vietnam/.test(keuken)) return 'aziatisch'
  if (/itali/.test(keuken)) return 'italiaans'
  if (/mediterr|grieks|spaans|turks|marokk|libane|midden-oost/.test(keuken)) return 'mediterraan'
  if (/mexic|zuid-amerik|peru/.test(keuken)) return 'mexicaans'
  if (/frans/.test(keuken)) return 'frans'
  if (/ovenschotel|traybake|uit de oven|gratin|lasagne|plaattaart/.test(tekst)) return 'oven'
  if (/salade|bowl|poke|zomer|fris|ceviche/.test(tekst)) return 'fris'
  return 'neutraal'
}

type Vorm = 'plat' | 'hoog' | 'diep' | 'pan' | 'ovenschaal' | 'plank' | 'tagine'

/** Hoe het gerecht op tafel staat; bepaalt hoek, vaatwerk en compositie. */
function vormVan(recept: ReceptVoorPrompt): Vorm {
  const tekst = `${recept.titel_nl ?? ''} ${recept.titel} ${recept.tags.join(' ')}`.toLowerCase()
  if (/tagine/.test(tekst)) return 'tagine'
  if (/soep|ramen|pho|laksa|noedelsoep|bouillabaisse/.test(tekst)) return 'diep'
  if (/ovenschotel|lasagne|gratin|traybake|uit de oven|moussaka|enchilada|cannelloni|parmigiana/.test(tekst)) return 'ovenschaal'
  if (/eenpans|één pan|one-pot|shakshuka|paella|risotto|roerbak|wok|nasi|bami|jambalaya|frittata/.test(tekst)) return 'pan'
  if (/stoof|stew|goulash|ragout|curry|dal|chili con|rendang|smoor|tikka|korma|chakalaka/.test(tekst)) return 'hoog'
  if (/plaattaart|pizza|flammkuchen|focaccia|tortilla|quesadilla|wrap|taco|burger|broodje|sandwich|spies|spiesen|saté|kebab|schnitzel|wellington|beenham/.test(tekst)) return 'plank'
  return 'plat'
}

function belangrijksteIngredienten(recept: ReceptVoorPrompt, maximum = 6): string[] {
  const gezien = new Set<string>()
  const uitkomst: string[] = []
  for (const ingr of recept.ingredienten) {
    const naam = ingr.naam
      .replace(/\(.*?\)/g, '')
      .replace(/,.*$/, '')
      .replace(INKOOP, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    if (!naam || VOORRAADKAST.test(naam) || gezien.has(naam)) continue
    gezien.add(naam)
    uitkomst.push(naam)
    if (uitkomst.length >= maximum) break
  }
  return uitkomst
}

// ---------------------------------------------------------------- keuzes

export function bepaalKeuzes(recept: ReceptVoorPrompt): PromptKeuzes {
  const id = recept.id
  const sfeer = sfeerVan(recept)
  const vorm = vormVan(recept)
  const tekst = `${recept.titel_nl ?? ''} ${recept.titel} ${recept.ingredienten.map((i) => i.naam).join(' ')}`

  // Hoek: platte gerechten van boven, hoogte schuin, diepe kommen laag.
  // Doel over de hele pool: ongeveer half top-down, half schuin (sjabloon §5).
  let hoek: string
  switch (vorm) {
    case 'diep':
      hoek = kies([HOEKEN.laag, HOEKEN.laag, HOEKEN.schuin], id, 'hoek')
      break
    case 'hoog':
    case 'tagine':
      hoek = kies([HOEKEN.schuin, HOEKEN.schuin, HOEKEN.laag, HOEKEN.topdown], id, 'hoek')
      break
    case 'pan':
    case 'ovenschaal':
      hoek = kies([HOEKEN.topdown, HOEKEN.schuin, HOEKEN.decentraal], id, 'hoek')
      break
    case 'plank':
      hoek = kies([HOEKEN.schuin, HOEKEN.topdown, HOEKEN.laag, HOEKEN.decentraal], id, 'hoek')
      break
    default:
      hoek = kies([HOEKEN.topdown, HOEKEN.topdown, HOEKEN.decentraal, HOEKEN.schuin, HOEKEN.schuin], id, 'hoek')
  }

  // Vaatwerk volgt de vorm.
  let vaatwerk: string
  let compositie: string
  switch (vorm) {
    case 'diep':
      vaatwerk = kies(VAATWERK.kom, id, 'vaatwerk')
      compositie = kies([COMPOSITIES.centraal, COMPOSITIES.tweeBorden, COMPOSITIES.closeup], id, 'compositie')
      break
    case 'hoog':
      vaatwerk = kies([...VAATWERK.kom, ...VAATWERK.bord, VAATWERK.pan[1]], id, 'vaatwerk')
      compositie = kies([COMPOSITIES.centraal, COMPOSITIES.tweeBorden, COMPOSITIES.pan, COMPOSITIES.closeup], id, 'compositie')
      break
    case 'tagine':
      vaatwerk = VAATWERK.tagine[0]
      compositie = COMPOSITIES.pan
      break
    case 'pan':
      vaatwerk = kies(VAATWERK.pan, id, 'vaatwerk')
      compositie = kies([COMPOSITIES.pan, COMPOSITIES.pan, COMPOSITIES.closeup], id, 'compositie')
      break
    case 'ovenschaal':
      vaatwerk = kies(VAATWERK.ovenschaal, id, 'vaatwerk')
      compositie = kies([COMPOSITIES.pan, COMPOSITIES.pan, COMPOSITIES.schaalEnBord], id, 'compositie')
      break
    case 'plank':
      vaatwerk = kies([...VAATWERK.plank, ...VAATWERK.bord], id, 'vaatwerk')
      compositie = kies([COMPOSITIES.zonderBord, COMPOSITIES.centraal, COMPOSITIES.closeup, COMPOSITIES.tweeBorden], id, 'compositie')
      break
    default:
      vaatwerk = kies(VAATWERK.bord, id, 'vaatwerk')
      compositie = kies([COMPOSITIES.centraal, COMPOSITIES.centraal, COMPOSITIES.tweeBorden, COMPOSITIES.closeup], id, 'compositie')
  }
  // Een decentraal bord kan niet tegelijk "centraal in beeld" zijn.
  if (hoek === HOEKEN.decentraal && compositie === COMPOSITIES.centraal) compositie = COMPOSITIES.tweeBorden
  // "Zonder bord" kan alleen op een plank of bakpapier.
  if (compositie === COMPOSITIES.zonderBord && !VAATWERK.plank.includes(vaatwerk as (typeof VAATWERK.plank)[number])) {
    vaatwerk = kies(VAATWERK.plank, id, 'plank')
  }

  const ondergrond = ONDERGRONDEN[kies(ONDERGROND_PER_SFEER[sfeer], id, 'ondergrond')]

  // Garnering: eerst wat het recept zelf noemt, aangevuld tot minimaal één.
  const garnering: string[] = []
  for (const [patroon, omschrijving] of GARNERING_UIT_RECEPT) {
    if (patroon.test(tekst) && !garnering.includes(omschrijving)) garnering.push(omschrijving)
    if (garnering.length >= 2) break
  }
  if (garnering.length === 0) garnering.push(kies(GARNERING_PER_SFEER[sfeer], id, 'garnering'))

  // Rekwisieten: ongeveer een derde helemaal leeg (sjabloon §5), anders 1 tot 3,
  // en alleen wat in het recept voorkomt of er logisch bij hoort.
  const rekwisieten: string[] = []
  if (!kansOnder(id, 'leeg', 0.34)) {
    const passend = REKWISIETEN_OP_INGREDIENT.filter(([patroon]) => patroon.test(tekst)).map(([, r]) => r)
    const aantal = 1 + (hash(id, 'aantal') % 3) // 1, 2 of 3
    // Deterministisch door elkaar: begin op een vast punt in de lijst.
    const start = passend.length ? hash(id, 'start') % passend.length : 0
    for (let i = 0; i < passend.length && rekwisieten.length < aantal; i++) {
      rekwisieten.push(passend[(start + i) % passend.length])
    }
    if (rekwisieten.length < aantal && rekwisieten.length < 2) {
      rekwisieten.push(kies(ALGEMENE_REKWISIETEN, id, 'algemeen'))
    }
  }

  return { hoek, compositie, vaatwerk, ondergrond, rekwisieten, garnering }
}

// ---------------------------------------------------------------- prompt

function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen.join('')
  return `${delen.slice(0, -1).join(', ')} en ${delen[delen.length - 1]}`
}

export function bouwPrompt(recept: ReceptVoorPrompt): { prompt: string; keuzes: PromptKeuzes } {
  const keuzes = bepaalKeuzes(recept)
  const gerecht = (recept.titel_nl ?? recept.titel).trim()
  const ingredienten = belangrijksteIngredienten(recept)

  const zonderBord = keuzes.compositie === COMPOSITIES.zonderBord
  const inVaatwerk = /kom|pan|schaal|tagine/.test(keuzes.vaatwerk)
  const waar = zonderBord
    ? `liggend op ${keuzes.vaatwerk}`
    : `geserveerd ${inVaatwerk ? 'in' : 'op'} ${keuzes.vaatwerk}`

  const regels = [
    `${keuzes.hoek} van ${gerecht}, ${waar}, op ${keuzes.ondergrond}.`,
    `${keuzes.compositie}.`,
    `Het gerecht is genereus en natuurlijk-rommelig opgemaakt` +
      (ingredienten.length ? `: goed zichtbaar zijn ${opsomming(ingredienten)}` : '') +
      `, afgewerkt met ${opsomming(keuzes.garnering)}.`,
    keuzes.rekwisieten.length
      ? `In beeld: ${opsomming(keuzes.rekwisieten)}.`
      : 'In beeld verder alleen het gerecht en het bestek.',
    VASTE_KERN,
  ]

  return { prompt: regels.join(' '), keuzes }
}
