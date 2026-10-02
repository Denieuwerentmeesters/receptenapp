import { ingredientKey } from './schaal'
import { canoniek, lijstSleutel } from './synoniemen'
import type { BoodschapItem } from './database.types'

/*
 * Een ingrediënt opzoeken in een mapping (AH, Jumbo, toko, bonus). Los van
 * lib/ah.ts, dat ook Capacitor laadt voor de mandjeknop: zo kan de server
 * (de bonus-cron) dezelfde zoekregels gebruiken.
 */

/**
 * Mogelijke enkelvouden van het laatste woord: "preien" → "prei",
 * "kipfilets" → "kipfilet", "tomaten" → "tomaat", "pitten" → "pit".
 *
 * Dit hoort bewust niet in ingredientKey: die sleutel moet op drie plekken
 * identiek blijven (SQL, app, script), en wat meervoud is valt zonder
 * woordenboek niet te zeggen ("kruiden", "linzen"). Hier is een verkeerde
 * kandidaat onschuldig: hij telt alleen als hij exact een mappingsleutel is.
 */
export function enkelvoudVormen(key: string): string[] {
  const woorden = key.split(' ')
  const laatste = woorden.pop() ?? ''
  const voor = woorden.length ? woorden.join(' ') + ' ' : ''
  const vormen: string[] = []

  if (laatste.length >= 4 && laatste.endsWith('s')) vormen.push(laatste.slice(0, -1))
  if (laatste.length >= 4 && laatste.endsWith('en')) {
    const stam = laatste.slice(0, -2)
    vormen.push(stam)
    // Verdubbelde medeklinker terug: pitten → pit, flessen → fles.
    if (/([^aeiou])\1$/.test(stam)) vormen.push(stam.slice(0, -1))
    // Open lettergreep weer sluiten: tomaten → tomaat, bonen → boon.
    const kort = stam.match(/^(.*[^aeiou])([aeou])([^aeiou])$/)
    if (kort) vormen.push(kort[1] + kort[2] + kort[2] + kort[3])
  }
  vormen.push(...zonderVerkleining(laatste))
  return vormen.map((v) => voor + v)
}

/**
 * Verkleinwoorden terug naar het gewone woord, plus de meervouden daarvan,
 * want de mapping gebruikt vaak het meervoud: cherrytomaatje → cherrytomaat,
 * cherrytomaten; worstje → worst; bolletje → bol; aardappeltje → aardappel.
 */
function zonderVerkleining(woord: string): string[] {
  const vormen: string[] = []
  // Elke uitgang proberen: tomaatje is tomaat + je, aardappeltje is aardappel + tje.
  for (const uitgang of ['etjes', 'etje', 'tjes', 'tje', 'pjes', 'pje', 'jes', 'je']) {
    if (!woord.endsWith(uitgang) || woord.length - uitgang.length < 3) continue
    let stam = woord.slice(0, -uitgang.length)
    // bolletje → bol, kommetje → kom
    if (uitgang.startsWith('e') && /([^aeiou])\1$/.test(stam)) stam = stam.slice(0, -1)
    vormen.push(stam, `${stam}s`, `${stam}en`)
    // tomaat → tomaten, boon → bonen
    const lang = stam.match(/^(.*[^aeiou])([aeou])\2([^aeiou])$/)
    if (lang) vormen.push(`${lang[1]}${lang[2]}${lang[3]}en`)
  }
  return vormen
}

/**
 * Zoekt het AH-product bij een boodschapregel.
 *
 * Twee redenen waarom de opgeslagen `ingredient_key` niet altijd volstaat:
 *
 *  1. Rijen die vóór een correctie aan ingredientKey zijn gemaakt dragen nog de
 *     oude sleutel ("sojasau" in plaats van "sojasaus"). Daarom rekenen we 'm
 *     hier opnieuw uit de naam — dan telt altijd de huidige regel.
 *
 *  2. Recepten schrijven bijzinnen mee: "zalmfilet, zonder huid",
 *     "kipfilet in blokjes". De basis staat wél in de mapping, de hele zin niet.
 *     Daarom vallen we terug op de langste mappingsleutel die als aaneengesloten
 *     reeks hele woorden in de regel voorkomt.
 *
 * Bewust op hele woorden en niet op letterreeksen: "amandelmelk" bevat "melk",
 * maar dat is een ander product. Zo'n gok legt stilletjes het verkeerde artikel
 * in je mandje, en dat merk je pas bij de kassa.
 *
 * Geeft het recept een keuze ("wraps of pitabroodjes"), dan nemen we de eerste.
 * Zonder die regel won de sleutel die toevallig het eerst in de mapping stond.
 */
export function zoekProduct<P>(
  item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>,
  mapping: Record<string, P>,
): P | undefined {
  const eerste = eersteKeuze(item.naam)
  if (eerste) {
    const product = zoekZonderKeuze({ ingredient_key: ingredientKey(eerste), naam: eerste }, mapping)
    if (product) return product
  }
  return zoekZonderKeuze(item, mapping)
}

/**
 * "wraps of pitabroodjes" → "wraps". Niets bij een gedeeld woorddeel
 * ("kippen- of groentebouillon") of als er voor de "of" geen product staat
 * ("verse of diepvries doperwten"): dan zoeken we op de hele naam.
 */
export function eersteKeuze(naam: string): string | undefined {
  if (/-\s+of\s/.test(naam)) return undefined
  const key = ingredientKey(naam)
  const plek = key.indexOf(' of ')
  return plek > 0 ? key.slice(0, plek) : undefined
}

function zoekZonderKeuze<P>(
  item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>,
  mapping: Record<string, P>,
): P | undefined {
  // Een gedroogd kruid krijgt nooit het verse product: liever een zoeklink
  // dan een bosje koriander waar een potje gemalen koriander bedoeld is.
  const sleutel = lijstSleutel({ ingredient_key: ingredientKey(item.naam), naam: item.naam })
  if (sleutel !== canoniek(ingredientKey(item.naam))) {
    return mapping[sleutel] ?? mapping[sleutel.replace(/^gemalen (.+)$/, '$1poeder')]
  }

  // Eerst de synoniemen: "knoflookteentje" is gewoon knoflook, ook al staat
  // er een aparte sleutel voor een potje teentjes in de mapping.
  const direct = mapping[canoniek(item.ingredient_key)] ?? mapping[canoniek(ingredientKey(item.naam))]
    ?? mapping[item.ingredient_key] ?? mapping[ingredientKey(item.naam)]
  if (direct) return direct

  for (const vorm of enkelvoudVormen(ingredientKey(item.naam))) {
    if (mapping[vorm]) return mapping[vorm]
  }

  // Deel van de naam: "rijpe cherrytomaatjes" vindt cherrytomaten, ook via
  // de enkelvouds- en verkleinvormen van het laatste woord.
  const naam = ingredientKey(item.naam)
  let beste: P | undefined
  let besteLengte = 0
  for (const vorm of [naam, ...enkelvoudVormen(naam)]) {
    const woorden = vorm.split(' ').filter(Boolean)
    if (woorden.length < 2) continue
    for (const [sleutel, product] of Object.entries(mapping)) {
      const deel = sleutel.split(' ')
      if (deel.length >= woorden.length || deel.length <= besteLengte) continue
      for (let i = 0; i + deel.length <= woorden.length; i++) {
        if (deel.every((w, n) => woorden[i + n] === w)) {
          beste = product
          besteLengte = deel.length
          break
        }
      }
    }
  }
  return beste
}
