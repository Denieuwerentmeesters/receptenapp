/**
 * Vertaalt een recept (titel, ingrediënten, bereiding) naar het Engels met
 * Claude. Gedeeld door scripts/vertaal_recepten.ts. De hoeveelheden blijven
 * zoals ze zijn; vertaald worden de eenheid en de naam, op dezelfde plek in de
 * lijst. Klopt het aantal regels niet, dan is het antwoord afgekeurd.
 */
import Anthropic from '@anthropic-ai/sdk'

export const VERTAAL_MODEL = process.env.ANTHROPIC_MODEL_VERTAAL || 'claude-sonnet-5-5'

export interface NlRecept {
  id: string
  titel: string
  titel_nl: string | null
  ingredienten: { hoeveelheid: string | null; eenheid: string | null; naam: string }[]
  bereiding_nl: string[]
}

export interface EnRecept {
  titel_en: string
  ingredienten_en: { eenheid: string | null; naam: string }[]
  bereiding_en: string[]
}

const SYSTEEM = `Je vertaalt Nederlandse recepten naar natuurlijk Brits Engels voor een kook-app.
- Titel: een korte, smakelijke Engelse naam van het gerecht.
- Ingrediënten: vertaal "eenheid" (el = tbsp, tl = tsp, bos = bunch, teen = clove, snuf = pinch, stuk(s) = piece(s), blik = tin, scheut = splash, handvol = handful, takje = sprig) en "naam". Behoud bereidingswoorden achter de naam ("ui, gesnipperd" = "onion, finely chopped"). Een eenheid die null of leeg is blijft null.
- Bereiding: vertaal elke stap, houd tijden, temperaturen en getallen gelijk.
- Zelfde aantal ingrediënten en stappen, in dezelfde volgorde. Voeg niets toe, laat niets weg.
- Merknamen en eigennamen blijven. Antwoord met alleen JSON:
{"titel_en": string, "ingredienten_en": [{"eenheid": string|null, "naam": string}], "bereiding_en": [string]}`

export async function vertaalRecept(client: Anthropic, r: NlRecept): Promise<EnRecept> {
  const invoer = {
    titel: r.titel_nl ?? r.titel,
    ingredienten: r.ingredienten.map((i) => ({ eenheid: i.eenheid, naam: i.naam })),
    bereiding: r.bereiding_nl,
  }
  const antwoord = await client.messages.create({
    model: VERTAAL_MODEL,
    max_tokens: 8000,
    system: SYSTEEM,
    messages: [{ role: 'user', content: JSON.stringify(invoer) }],
  })
  const tekst = antwoord.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const start = tekst.indexOf('{')
  const eind = tekst.lastIndexOf('}')
  if (start < 0 || eind < start) throw new Error('Geen JSON in het antwoord.')
  const o = JSON.parse(tekst.slice(start, eind + 1)) as Partial<EnRecept>
  return controleer(r, o)
}

export function controleer(r: NlRecept, o: Partial<EnRecept>): EnRecept {
  if (typeof o.titel_en !== 'string' || !o.titel_en.trim()) throw new Error('Titel ontbreekt.')
  if (!Array.isArray(o.ingredienten_en) || o.ingredienten_en.length !== r.ingredienten.length) {
    throw new Error('Aantal ingrediënten klopt niet.')
  }
  if (!Array.isArray(o.bereiding_en) || o.bereiding_en.length !== r.bereiding_nl.length) {
    throw new Error('Aantal stappen klopt niet.')
  }
  const ingredienten_en = o.ingredienten_en.map((i) => {
    if (!i || typeof i.naam !== 'string' || !i.naam.trim()) throw new Error('Ingrediëntnaam ontbreekt.')
    const eenheid = typeof i.eenheid === 'string' && i.eenheid.trim() ? i.eenheid.trim() : null
    return { eenheid, naam: i.naam.trim() }
  })
  const bereiding_en = o.bereiding_en.map((s) => {
    if (typeof s !== 'string' || !s.trim()) throw new Error('Lege stap.')
    return s.trim()
  })
  return { titel_en: o.titel_en.trim(), ingredienten_en, bereiding_en }
}
