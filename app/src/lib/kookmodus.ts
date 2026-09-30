/**
 * Tijden uit een bereidingsstap halen, zodat de kookmodus de timer al klaar
 * heeft staan: "laat 15 minuten sudderen" wordt een knop "15 min sudderen".
 *
 * Bij een bereik ("10 à 12 minuten", "10-12 min", "8 tot 10 minuten") nemen we
 * de laagste waarde: bijkoken kan altijd, terugkoken niet. Vage tijden als
 * "een paar minuten" of "enkele minuten" slaan we over; daar hoort geen
 * getal bij.
 */

export interface StapTijd {
  /** Duur in seconden. */
  seconden: number
  /** Korte knoptekst, bijvoorbeeld "15 min sudderen" of "1 uur". */
  label: string
}

const TELWOORDEN: Record<string, number> = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8,
  negen: 9, tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15,
  twintig: 20, vijfentwintig: 25, dertig: 30, veertig: 40, vijftig: 50, zestig: 60,
}

const GETAL = `(?:\\d+(?:[.,]\\d+)?|${Object.keys(TELWOORDEN).join('|')})`
const EENHEID = '(?:minuten|minuut|min\\.?|uren|uur|seconden|seconde|sec\\.?)'

/** "10 à 12 minuten", "10-12 min", "8 tot 10 minuten", "1,5 uur", "twintig minuten". */
const BEREIK = new RegExp(
  `(?<![\\p{L}\\d])(${GETAL})(?:\\s*(?:-|–|à|a|tot|of)\\s*(${GETAL}))?\\s*(${EENHEID})(?![\\p{L}])`,
  'giu',
)

/** Vaste uitdrukkingen zonder los getal. */
const VAST: Array<[RegExp, number]> = [
  [/\banderhalf\s+uur\b/giu, 90 * 60],
  [/\banderhalve\s+minuut\b/giu, 90],
  [/\b(?:een\s+)?half\s*uur\b/giu, 30 * 60],
  [/\b(?:een\s+)?kwartier\b/giu, 15 * 60],
]

/** "een kwartier tot twintig minuten": het tweede deel hoort bij de vaste tijd. */
const BEREIK_STAART = new RegExp(`^\\s*(?:-|–|à|tot|of)\\s*${GETAL}\\s*${EENHEID}(?![\\p{L}])`, 'iu')

/** "2 minuten korter dan op de verpakking": een verschil, geen kooktijd. */
const VERSCHIL = /^\s+(?:korter|langer|eerder|later)\b/iu

/** Woorden die na een tijd vaak volgen maar geen handeling zijn. */
const GEEN_HANDELING = new Set([
  'tegen', 'boven', 'binnen', 'buiten', 'zonder', 'even', 'open', 'bovenop',
  'voordat', 'nadat', 'totdat', 'meenemen', 'lang', 'langer',
])

function getal(s: string): number {
  const w = s.toLowerCase()
  return TELWOORDEN[w] ?? Number(w.replace(',', '.'))
}

function secondenPer(eenheid: string): number {
  const e = eenheid.toLowerCase()
  if (e.startsWith('u')) return 3600
  if (e.startsWith('s')) return 1
  return 60
}

/** De handeling direct na de tijd ("sudderen", "garen"), als die er staat. */
function handelingNa(tekst: string, eind: number): string | null {
  const m = /^\s+(\p{L}+)/u.exec(tekst.slice(eind))
  if (!m) return null
  const woord = m[1].toLowerCase()
  if (!woord.endsWith('en') || woord.length < 5 || GEEN_HANDELING.has(woord)) return null
  return woord
}

export function formatteerDuur(seconden: number): string {
  if (seconden < 60) return `${seconden} sec`
  if (seconden % 3600 === 0) return `${seconden / 3600} uur`
  if (seconden > 3600 && seconden % 1800 === 0) return `${(seconden / 3600).toString().replace('.', ',')} uur`
  if (seconden < 3600 && seconden % 30 === 0) return `${(seconden / 60).toString().replace('.', ',')} min`
  return `${Math.round(seconden / 60)} min`
}

export function tijdenUitStap(tekst: string): StapTijd[] {
  const gevonden: Array<{ plek: number; seconden: number; handeling: string | null }> = []
  const bezet: Array<[number, number]> = []
  const overlapt = (van: number, tot: number) => bezet.some(([a, b]) => van < b && tot > a)

  for (const [patroon, seconden] of VAST) {
    for (const m of tekst.matchAll(patroon)) {
      let eind = m.index + m[0].length
      const staart = BEREIK_STAART.exec(tekst.slice(eind))
      if (staart) eind += staart[0].length
      bezet.push([m.index, eind])
      gevonden.push({ plek: m.index, seconden, handeling: handelingNa(tekst, eind) })
    }
  }

  for (const m of tekst.matchAll(BEREIK)) {
    const eind = m.index + m[0].length
    if (overlapt(m.index, eind) || VERSCHIL.test(tekst.slice(eind))) continue
    const laag = Math.min(getal(m[1]), m[2] ? getal(m[2]) : Infinity)
    const seconden = Math.round(laag * secondenPer(m[3]))
    if (!Number.isFinite(seconden) || seconden <= 0 || seconden > 24 * 3600) continue
    gevonden.push({ plek: m.index, seconden, handeling: handelingNa(tekst, eind) })
  }

  gevonden.sort((a, b) => a.plek - b.plek)
  const gezien = new Set<number>()
  const tijden: StapTijd[] = []
  for (const g of gevonden) {
    if (gezien.has(g.seconden)) continue
    gezien.add(g.seconden)
    const duur = formatteerDuur(g.seconden)
    tijden.push({ seconden: g.seconden, label: g.handeling ? `${duur} ${g.handeling}` : duur })
  }
  return tijden
}
