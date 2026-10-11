import { ingredientKey } from './schaal'
import { canoniek, droogKruid, lijstSleutel } from './synoniemen'
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
 * Geeft het recept een keuze ("wraps of pitabroodjes", "geraspte kaas (cheddar
 * of jong belegen)"), dan nemen we de eerste die een product heeft ("tamari of
 * sojasaus" wordt sojasaus). Zonder die regel won de sleutel die toevallig het
 * eerst in de mapping stond, of viel de keuze tussen haakjes helemaal weg.
 */
export function zoekProduct<P>(
  item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>,
  mapping: Record<string, P>,
): P | undefined {
  for (const keuze of keuzes(item.naam)) {
    const product = zoekZonderKeuze({ ingredient_key: ingredientKey(keuze), naam: keuze }, mapping)
    if (product) return product
  }
  return zoekZonderKeuze(item, mapping)
}

/**
 * Alle mogelijkheden uit een keuze in het recept, op volgorde; leeg als het
 * recept geen keuze geeft.
 *
 *  - "wraps of pitabroodjes" → wraps, pitabroodjes. Bij een gedeeld woorddeel
 *    ("kippen- of groentebouillon") is alleen de laatste een heel woord.
 *  - Tussen haakjes: "geraspte kaas (cheddar of jong belegen)" → geraspte
 *    cheddar, cheddar, geraspte jong belegen, jong belegen. De bereiding vóór
 *    de haakjes gaat mee, het soortwoord ("kaas") valt weg. "Grana Padano (of
 *    Parmezaanse kaas)" → eerst grana padano zelf, dan parmezaanse kaas: wat
 *    na "of" staat is het alternatief. "Halfzachte kaas (bv. gruyère,
 *    cheddar)" → halfzachte gruyere, gruyere, halfzachte cheddar, cheddar.
 *    Staat geen van de keuzes in de mapping, dan zoekt zoekProduct alsnog
 *    op de hele naam.
 */
function keuzes(naam: string): string[] {
  // Ook "halfzachte kaas (bv. gruyère, cheddar)": een opsomming of een
  // voorbeeld tussen haakjes is net zo goed een keuze als "of".
  const haakjes = naam.match(/^([^(]*)\(([^)]*(?:\bof\b|,|\b(?:zoals|bijv|bijvoorbeeld|bv)\b)[^)]*)\)/)
  if (haakjes) return keuzesTussenHaakjes(haakjes[1], haakjes[2], naam)
  const key = ingredientKey(naam)
  if (key.indexOf(' of ') <= 0) return []
  const delen = key.split(' of ').map((k) => k.trim()).filter(Boolean)
  return /-\s+of\s/.test(naam) ? delen.slice(-1) : delen
}

function keuzesTussenHaakjes(voor: string, binnen: string, naam: string): string[] {
  // Een mix is geen keuze: "gemengde sla (rucola, bietenblad of veldsla)"
  // somt op wat erin zit, en dan willen we de mix en niet alleen rucola.
  if (/\bgemengde?\b/i.test(voor)) return []
  // "grof geraspte kaas" → "grof geraspte": alles behalve het laatste woord.
  const woorden = voor.split(',')[0].trim().split(/\s+/).filter(Boolean)
  const bereiding = woorden.slice(0, -1).join(' ')
  // De spatie ervoor: "(of gehakt)" begint met "of", en die lege eerste keuze
  // is het ingrediënt zelf.
  const opties = ` ${binnen}`.split(/,| of /).map((o) => o.trim().replace(VOORBEELD, ''))
  return opties.flatMap((optie) => {
    if (!optie) return [naam]
    // "tortilla's (mais of tarwe)", "paprika (rood of groen)": dat beschrijft
    // het product en vervangt het niet. Zonder deze regel werd dat een pak mais.
    const key = ingredientKey(optie)
    if (!key || EIGENSCHAP.test(key)) return []
    return bereiding ? [`${bereiding} ${optie}`, optie] : [optie]
  })
}

/** "zoals Appenzeller", "bijv. snijbiet": het voorbeeldwoord hoort niet bij het product. */
const VOORBEELD = /^(?:zoals|bijv\.?|bijvoorbeeld|bv\.?)\s+/i

/** Een los woord dat zegt hoe het product is, niet welk product: kleur, graan, rijping, verpakking. */
const EIGENSCHAP = /^(?:mais|tarwe|volkoren|spelt|rood|rode|groen|groene|geel|gele|oranje|wit|witte|zwart|zwarte|bruin|bruine|jong|jonge|oud|oude|belegen|blik|pot|diepvries|gekocht|zelfgemaakt|rauw|rauwe|geroosterd|ongebrand|gekruid|mild|milde|pittig|zoet|zuur|mager|magere|vol|volle|halfvol|halfvolle|naturel|filet|flakes|beiden|mix)$/

/**
 * Woorden die naast de productnaam mogen staan zonder dat het een ander
 * product wordt: hoe je het snijdt, waar het voor is, hoeveel. Al het andere
 * houdt de deelmatch tegen ("gerookte", "pittige", "uit blik", "volkoren"):
 * dat is vaak wél een ander product, en dan is een zoeklink beter dan een gok.
 * Mist hier een woord, dan krijgt een regel onterecht een zoeklink; vul het
 * dan aan, of geef het ingrediënt een eigen mapping-regel.
 */
const ONSCHULDIG = new Set(`
  in of en van voor op om te een plus de met erbij naar ter bij het je aan dan als ook
  blokje blokjes plakje plakjes reepje reepjes ring ringen ringetje stuk stukken stukje stukjes stuks
  part partje partjes parten linten vieren lengte diagonaal dun dunne dik dikke grof fijn roosje
  steeltjes blaadjes takje takjes scheutje kneepje eetlepel eetlepels tl el cm kilo ongeveer sap rasp
  garnering garneren serveren topping decoratie bestuiven invetten bakken braden keuze kamertemperatuur
  rijpe koud koude warme lauwwarme zachte middelgrote flinke groot lange korte brede goede lekker
  zonder vel huid graat graten pit bot korst zaadje zaadlijsten verwijderd
  blad bos naalden naaldjes geristd bewaard krop kropje kropjes bollen stronken vellen plakken blokken
  jonge baby ontpitte pitloze panklare gladde romige pure vloeibare houdbare koelverse ongesneden medium
  volle halfvolle naturel milde bevroren diepvries gekookt gekookte voorgekookte ongekookt ongekookte
  kaas pasta sla zout zeezout water olie erover jus uit blik blikje pot
  jong julienne wilde trosrijpe mini gedopte dubbel
  handje handjes virgin
`.split(/\s+/).filter(Boolean))

/**
 * Mag dit woord wegvallen naast deze mappingsleutel? Uit de lijst, of een
 * bereiding ("gesnipperd", "fijngehakt"). Twee uitzonderingen hangen van het
 * product af: geroosterd of gebrand maakt bij noten en zaden niet uit, en uit
 * blik of pot is bij tomaten en paprika juist een ander product.
 */
function onschuldig(woord: string, sleutel: string): boolean {
  if (UIT_BLIK.test(woord)) return !VERS_OF_BLIK.test(sleutel)
  if (GEROOSTERD.test(woord)) return NOOT_OF_ZAAD.test(sleutel)
  return ONSCHULDIG.has(woord) || BEREID.test(woord)
}
const UIT_BLIK = /^(?:blik|blikje|pot)$/
const VERS_OF_BLIK = /^(?:tomaten|tomaat|(?:rode |gele |groene )?paprika|ananas|perzik(?:en)?|champignons?|asperges?|bieten)$/
const GEROOSTERD = /^(?:geroosterde?|gebrande?|ongebrande?)$/
const NOOT_OF_ZAAD = /noot|noten|zaad|pinda|pitten|kokos|amandel|pistache/

/**
 * Wat je er thuis mee doet. Bewust een vaste lijst en geen "elk voltooid
 * deelwoord": gerookt, gekookt, gedroogd en gezouten koop je zo, en dat zijn
 * andere producten.
 */
const BEREID = /^(?:fijn|grof)?ge(?:hakt|snipperd|sneden|schild|halveerd|smolten|plukt|kneusd|perst|plet|kwart|scheiden|klopt|peld|schaafd|wassen|raspte?)e?$|^(?:vers|fijn)geraspte?$|^(?:uitgelekt|losgeklopt|schoongemaakte?|afgekoelde?|afgespoeld|verkruimelde?|ontdooid|afgegoten|ontpit|hardgekookte|zachtgekookte)$/

/**
 * Producten die je vers én gedroogd koopt, en waar de gewone sleutel het
 * verse product is. ingredientKey haalt "gedroogde" weg, dus zonder deze
 * regel werden gedroogde paddenstoelen een bakje champignons.
 */
const VERS_PRODUCT = /^(?:(?:gemengde )?paddenstoel(?:en)?|champignons?|shiitake|tomaat|tomaten|rode peper|gember)$/

function zoekZonderKeuze<P>(
  item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>,
  mapping: Record<string, P>,
): P | undefined {
  const naam = item.naam.toLowerCase()
  const key = canoniek(ingredientKey(item.naam))
  if (/\bgedroogde?\b/.test(naam) && VERS_PRODUCT.test(key)) return mapping[`gedroogde ${key}`]

  // Geraspte kaas is een eigen product. Staat het er niet apart in, dan is een
  // stuk kaas om zelf te raspen goed, maar plakken nooit.
  const geraspt = /\b(?:fijn|vers)?geraspte?\b/.test(naam)
  // "grof geraspte kaas", "oude geraspte kaas" en "geraspte oude kaas" zoeken
  // allemaal op "geraspte oude kaas": het woord geraspte eruit, vooraan terug.
  // ingredientKey haalt "geraspte" soms al weg als bereiding; "grof" blijft dan staan.
  const zonderGeraspt = key.replace(/\b(?:grof|fijn|vers|geraspte?)\b ?/g, '').replace(/\s+/g, ' ').trim()
  const geraspteKey = `geraspte ${zonderGeraspt}`
  if (geraspt && mapping[geraspteKey]) return mapping[geraspteKey]
  const product = zoekOpNaam(item, mapping)
  const weergavenaam = (product as { weergavenaam?: string | null } | undefined)?.weergavenaam
  if (geraspt && weergavenaam && /plak/i.test(weergavenaam)) return undefined
  return product
}

function zoekOpNaam<P>(
  item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>,
  mapping: Record<string, P>,
): P | undefined {
  // Een gedroogd kruid krijgt nooit het verse product: liever een zoeklink
  // dan een bosje koriander waar een potje gemalen koriander bedoeld is.
  const droog = droogKruid(canoniek(ingredientKey(item.naam)), item.naam)
  if (droog) return mapping[droog] ?? mapping[droog.replace(/^gemalen (.+)$/, '$1poeder')]

  // Eerst de synoniemen: "knoflookteentje" is gewoon knoflook, ook al staat
  // er een aparte sleutel voor een potje teentjes in de mapping.
  const direct = mapping[canoniek(item.ingredient_key)] ?? mapping[canoniek(ingredientKey(item.naam))]
    ?? mapping[item.ingredient_key] ?? mapping[ingredientKey(item.naam)]
  if (direct) return direct

  for (const vorm of enkelvoudVormen(ingredientKey(item.naam))) {
    if (mapping[vorm]) return mapping[vorm]
  }

  // Zoals de lijst het product noemt: zonder bereiding en wat achter de komma
  // staat, en in één spelling ("witte wijn azijn" is witte wijnazijn,
  // "lente-uien" zijn bosui en geen uien).
  const voorKomma = canoniek(ingredientKey(item.naam.replace(/\([^)]*\)/g, ' ').split(',')[0]))
  const opLijst = lijstSleutel(item)
  for (const vorm of [voorKomma, ...enkelvoudVormen(voorKomma), opLijst, ...enkelvoudVormen(opLijst)]) {
    if (mapping[vorm]) return mapping[vorm]
  }

  // Deel van de naam: "rijpe cherrytomaatjes" vindt cherrytomaten, ook via
  // de enkelvouds- en verkleinvormen van het laatste woord. Alleen als wat
  // wegvalt het product niet verandert: "sambal badjak" is geen sambal oelek.
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
        if (!deel.every((w, n) => woorden[i + n] === w)) continue
        const rest = [...woorden.slice(0, i), ...woorden.slice(i + deel.length)]
        if (!rest.every((w) => onschuldig(w, sleutel))) continue
        beste = product
        besteLengte = deel.length
        break
      }
    }
  }
  return beste
}
