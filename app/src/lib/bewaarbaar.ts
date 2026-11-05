import { isKruid } from './kruiden'

/**
 * Toevoegingen die je bewaart en waar je meerdere gerechten mee maakt: miso,
 * chipotle, currypasta, sauzen. Bij de receptprijs (lib/receptprijs.ts) tellen
 * we daarvan wat het recept gebruikt en niet de hele pot: die pot staat nog
 * weken in de kast, en een recept van € 3,99 voor één eetlepel miso maakt
 * elk recept met een scheut saus onterecht duur (Reinoud, 5 nov 2026).
 *
 * Alleen wat lang goed blijft. Verse kruiden, pesto en blikken die je opent
 * (kokosmelk) horen er niet bij: dat is binnen een week op. De mandjeknop
 * telt gewoon de hele verpakking; dit gaat alleen over de prijs per recept.
 */
const BEWAARBAAR = new RegExp([
  'misopasta', 'miso', 'chipotle', 'harissa', 'sambal', 'sriracha', 'gochujang', 'tabasco',
  'currypasta', 'kerriepasta', 'curry pasta', 'tomatenpuree', 'tahin', 'tahini',
  'sojasaus', 'ketjap', 'vissaus', 'oestersaus', 'hoisinsaus', 'worcester', 'teriyaki', 'sweet chili',
  'mosterd', 'azijn', 'balsamico', 'mirin', 'honing', 'ahornsiroop', 'agavesiroop',
  'sesamolie', 'sesamzaad', 'kappertjes', 'zeewier', 'nori',
].join('|'))

/** Een product dat je bewaart; zie BEWAARBAAR. Kruidenpotjes tellen ook. */
export function bewaarbaar(key: string): boolean {
  return isKruid(key) || BEWAARBAAR.test(key)
}

/**
 * Dit telt niet mee in de receptprijs: droge kruiden en specerijen, en koffie
 * (koffiebonen, espresso). Een potje of zak gaat naar tientallen gerechten en
 * koffie heb je al (Reinoud, 5 nov 2026).
 */
export function telNietMee(key: string): boolean {
  return isKruid(key) || /koffie|espresso/.test(key)
}
