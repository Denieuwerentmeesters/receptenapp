/**
 * Leest een kookboekfoto of vrije tekst en geeft gestructureerde receptvelden terug.
 *
 * Waarom dit een aparte functie is en niet in de app zit: de Anthropic-sleutel
 * mag niet in de app-bundle. Iedereen die de app installeert kan die er anders
 * uithalen en op jouw rekening laten draaien.
 *
 * Draait op Vercel (gratis plan). Zet `ANTHROPIC_API_KEY` in de
 * projectinstellingen, niet in een bestand.
 *
 * De uitvoer landt in hetzelfde schema als de rest van recepten.json (plan §7.8),
 * zodat de weekmenu-generator geen onderscheid hoeft te maken tussen gescrapete,
 * kookboek- en eigen recepten.
 */

const MODEL = 'claude-sonnet-5'

const SCHEMA = {
  name: 'recept',
  description: 'Het uitgelezen recept in het schema van de app.',
  input_schema: {
    type: 'object',
    properties: {
      titel: { type: 'string', description: 'De naam van het gerecht, in het Nederlands.' },
      personen: { type: 'integer', description: 'Voor hoeveel personen. Staat het er niet, schat dan 4.' },
      bereidingstijd_minuten: { type: 'integer', description: 'Totale bereidingstijd in minuten. Laat weg als het echt niet af te leiden is.' },
      keuken: { type: 'string', description: 'Bijv. Italiaans, Aziatisch, Nederlands. Laat weg bij twijfel.' },
      tags: {
        type: 'array', items: { type: 'string' },
        description: "Korte kenmerken. Gebruik 'vegetarisch' alleen als er echt geen vlees of vis in zit — kijk naar de ingrediënten, niet naar de titel.",
      },
      ingredienten: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            hoeveelheid: { type: ['string', 'null'], description: "Alleen het getal, bijv. '250' of '0.5'. Null als er geen hoeveelheid staat." },
            eenheid: { type: ['string', 'null'], description: "Bijv. 'g', 'ml', 'el', 'tl'. Null bij stuks." },
            naam: { type: 'string', description: 'De naam van het ingrediënt, zonder hoeveelheid.' },
          },
          required: ['naam'],
        },
      },
      bereiding_nl: {
        type: 'array', items: { type: 'string' },
        description: 'De bereiding als losse stappen, in het Nederlands, één stap per element.',
      },
    },
    required: ['titel', 'personen', 'ingredienten', 'bereiding_nl'],
  },
} as const

const INSTRUCTIE = `Je leest een recept uit en zet het om naar gestructureerde velden.

Regels:
- Antwoord altijd in het Nederlands, ook als de bron een andere taal heeft.
- Verzin niets. Staat een hoeveelheid er niet, laat 'm dan leeg.
- Splits de bereiding in losse, uitvoerbare stappen.
- Schrijf de bereiding in je eigen, beknopte woorden — niet letterlijk overtypen.
- Bij een foto: lees alleen wat er staat. Is een deel onleesbaar, laat dat weg.

Gebruik altijd het gereedschap 'recept' voor je antwoord.`

interface Verzoek {
  tekst?: string
  afbeelding?: { mediaType: string; data: string }
}

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })
  if (request.method !== 'POST') {
    return antwoord({ fout: 'Alleen POST.' }, 405)
  }

  const sleutel = process.env.ANTHROPIC_API_KEY
  if (!sleutel) {
    return antwoord({ fout: 'ANTHROPIC_API_KEY ontbreekt op de server.' }, 500)
  }

  let invoer: Verzoek
  try {
    invoer = (await request.json()) as Verzoek
  } catch {
    return antwoord({ fout: 'Ongeldige aanvraag.' }, 400)
  }

  if (!invoer.tekst && !invoer.afbeelding) {
    return antwoord({ fout: 'Stuur een foto of een tekst mee.' }, 400)
  }

  const inhoud: unknown[] = []
  if (invoer.afbeelding) {
    inhoud.push({
      type: 'image',
      source: { type: 'base64', media_type: invoer.afbeelding.mediaType, data: invoer.afbeelding.data },
    })
  }
  inhoud.push({
    type: 'text',
    text: invoer.tekst
      ? `Zet dit recept om naar gestructureerde velden:\n\n${invoer.tekst}`
      : 'Lees het recept op deze foto uit.',
  })

  try {
    const respons = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': sleutel,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: INSTRUCTIE,
        tools: [SCHEMA],
        tool_choice: { type: 'tool', name: 'recept' },
        messages: [{ role: 'user', content: inhoud }],
      }),
    })

    if (!respons.ok) {
      const tekst = await respons.text()
      return antwoord({ fout: `Het model gaf een fout terug (${respons.status}).`, details: tekst.slice(0, 400) }, 502)
    }

    const body = (await respons.json()) as {
      content: { type: string; name?: string; input?: unknown }[]
    }
    const gereedschap = body.content.find((c) => c.type === 'tool_use' && c.name === 'recept')
    if (!gereedschap?.input) {
      return antwoord({ fout: 'Het model gaf geen bruikbaar recept terug.' }, 502)
    }

    return antwoord(gereedschap.input, 200)
  } catch (fout) {
    return antwoord({ fout: fout instanceof Error ? fout.message : 'Onbekende fout.' }, 502)
  }
}

function cors(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  }
}

function antwoord(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors() },
  })
}
