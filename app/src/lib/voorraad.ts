import { enkelvoudVormen } from './ah'
import { BEREIDING, canoniek } from './synoniemen'
import { DROGE_KRUIDEN } from './kruiden'
import { ingredientKey } from './schaal'

/**
 * Wat mensen standaard in huis hebben, van vaak naar zelden: eerst wat in
 * bijna elke keuken staat, dan de voorraadkast van wie vaak kookt, dan wat je
 * alleen hebt als je een bepaalde keuken kookt (miso, chipotle, sumak).
 *
 * De voorraadkast toont er steeds een paar (voeg je er een toe, dan schuift de
 * volgende door). De onboarding begint met de eerste rij en zet er bij elke
 * tik de volgende bij; via het zoekveld vind je ze allemaal.
 *
 * - De namen volgen de recepten, want daar wordt mee vergeleken (inVoorraad):
 *   "Misopasta" en niet "Miso", "Chipotlesaus" en niet "Chipotle".
 * - Geen losse droge kruiden: die vallen onder "Droge kruiden". Bijzondere
 *   kruiden (sumak, saffraan) wel, die horen daar niet bij (lib/kruiden.ts).
 * - Geen verse groente en geen vlees: dat heb je niet "standaard" in huis.
 * - Zout, peper, suiker en bouillon staan er niet bij: die komen sowieso
 *   nooit op de lijst (altijdInHuis).
 */
export const VOORRAAD_SUGGESTIES = [
  // In bijna elke keuken
  DROGE_KRUIDEN, 'Olijfolie', 'Uien', 'Knoflook', 'Rijst', 'Pasta', 'Eieren', 'Boter',
  'Zonnebloemolie', 'Bloem', 'Melk', 'Mosterd', 'Mayonaise', 'Ketchup', 'Honing', 'Azijn',
  // Wie regelmatig kookt
  'Tomatenpuree', 'Sojasaus', 'Tomatenblokjes', 'Spaghetti', 'Paneermeel', 'Maizena',
  'Parmezaanse kaas', 'Passata', 'Sambal', 'Ketjap manis', 'Pindakaas', 'Kokosmelk',
  'Balsamicoazijn', 'Bakpoeder', 'Penne', 'Couscous', 'Basterdsuiker', 'Poedersuiker',
  // De goed gevulde kast
  'Sesamolie', 'Pesto', 'Kappertjes', 'Vissaus', 'Pijnboompitten', 'Basmatirijst',
  'Dijonmosterd', 'Kikkererwten', 'Zongedroogde tomaten', 'Olijven', 'Currypasta',
  'Sesamzaadjes', 'Noedels', 'Linzen', 'Rijstazijn', 'Worcestershiresaus', 'Walnoten',
  'Rozijnen', 'Cashewnoten', 'Tabasco', 'Panko', 'Risottorijst', 'Orzo', "Tortilla's",
  'Ansjovis', 'Kokosolie', 'Vanille-extract', 'Cacaopoeder', 'Pure chocolade',
  'Ahornsiroop', 'Havermout', 'Zelfrijzend bakmeel',
  // Voor een bepaalde keuken
  'Misopasta', 'Hoisinsaus', 'Oestersaus', 'Chipotlesaus', 'Sriracha', 'Tahin',
  'Harissa', 'Gochujang', 'Mirin', 'Sumak', 'Ras el hanout', 'Kokosrasp',
  'Pistachenoten', 'Amandelmeel', 'Tamarindepasta', 'Saffraan', "Za'atar", 'Nori',
  'Gedroogde gist',
]

/**
 * Wat iemand in het open veld typt, als product. Staat het in de lijst, dan
 * de naam uit de lijst: "miso" wordt "Misopasta", want zo heet het in de
 * recepten. Anders wat er getypt is, met een hoofdletter.
 */
export function voorraadNaam(invoer: string): string {
  const schoon = invoer.trim().replace(/\s+/g, ' ')
  const key = ingredientKey(schoon)
  if (!key) return ''
  const precies = VOORRAAD_SUGGESTIES.find((s) => ingredientKey(s) === key)
  if (precies) return precies
  // Pas vanaf drie letters raden: "ui" is geen "uien", "ri" is geen "rijst".
  const begin = key.length >= 3 ? VOORRAAD_SUGGESTIES.find((s) => ingredientKey(s).startsWith(key)) : undefined
  return begin ?? schoon.charAt(0).toUpperCase() + schoon.slice(1)
}

/**
 * Soorten die in je voorraadkast onder één naam staan. "Azijn" is de gewone
 * fles: witte of rode wijnazijn, appelazijn. Rijstazijn en balsamico niet —
 * die staan er apart in of heeft niet iedereen. "Boter" is ook roomboter.
 */
const BIJZONDERE_AZIJN = /rijst|sushi|balsamico|japanse|sherry|champagne|cranberry|citroen/

function algemeen(key: string): string {
  if (/azijn$/.test(key) && !BIJZONDERE_AZIJN.test(key)) return 'azijn'
  if (/balsamico azijn$/.test(key)) return key.replace(/balsamico azijn$/, 'balsamicoazijn')
  return key.replace(/\broomboter$/, 'boter')
}

/** Lente-ui en ingelegde ui zijn geen uien, ook al eindigen ze erop. */
const ANDER_PRODUCT = /(?:^| )(?:lente|bos|ingelegde|zoetzure) /

/**
 * Staat dit ingrediënt in je voorraadkast?
 *
 * Bij het op de lijst zetten van een recept filteren we al op de voorraadkast,
 * maar zet je iets pas daarna op "in huis", dan staat het al op je lijst. Die
 * regels blijven staan (dan zie je dat een recept ze vraagt) maar gaan niet
 * mee naar het mandje.
 *
 * Naast een exacte match ook enkel- en meervoud, in beide richtingen ("preien"
 * → "prei", en "ui" in het recept is "Uien" in de kast) en een voorraadnaam
 * als laatste woord(en): "grove mosterd" is mosterd, "rode ui" is ui. Niet als
 * eerste woord: "rijst azijn" is geen rijst — behalve als er alleen een
 * bereiding achter staat. En synoniemen: knoflooktenen zijn knoflook.
 */
export function inVoorraad(key: string, voorraad: ReadonlySet<string>): boolean {
  if (voorraad.size === 0) return false
  // Het potje is niet het bosje: gemalen koriander staat alleen in de kast als het er zelf staat.
  if (/^(gemalen|gedroogde) /.test(key)) return voorraad.has(key)
  // De kast in alle vormen: "uien" telt ook als "ui".
  const kast = new Set<string>()
  for (const v of voorraad) {
    kast.add(v)
    for (const vorm of enkelvoudVormen(v)) kast.add(vorm)
  }

  const kaal = algemeen(canoniek(key).replace(BEREIDING, ''))
  const namen = [key, canoniek(key), kaal]
  for (const vorm of [...namen, ...enkelvoudVormen(key), ...enkelvoudVormen(kaal)]) {
    if (kast.has(vorm)) return true
  }
  // Als laatste woord(en). Niet met de enkelvouden van het recept: "eetbare
  // bloemen" is geen bloem. En niet voor "lente ui" of "sushi azijn".
  if (ANDER_PRODUCT.test(kaal)) return false
  const andereAzijn = /azijn$/.test(kaal) && BIJZONDERE_AZIJN.test(kaal)
  for (const naam of namen) {
    for (const v of kast) {
      if (andereAzijn && v === 'azijn') continue
      if (naam.endsWith(' ' + v)) return true
    }
  }
  return false
}
