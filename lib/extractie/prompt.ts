/**
 * De opdracht aan Claude voor het uitlezen van een recept (api/extraheer.ts):
 * het schema van het antwoord en de huisregels.
 *
 * De huisregels en de lijst ingrediëntnamen zijn voor iedereen gelijk en
 * staan in het systeemdeel, zodat ze uit de cache komen. Wat per aanvraag
 * verschilt (de tekst, de foto's, de bron) staat in het gebruikersbericht.
 * Zet dus nooit een datum, naam of link in HUISREGELS.
 */

const tekst = (description: string) => ({ type: 'string', description })

/**
 * Hetzelfde schema als Concept in app/src/lib/extractie.ts, plus `geen_recept`:
 * zo kan Claude zeggen dat er niets uit te lezen valt in plaats van iets te
 * verzinnen. Alle velden verplicht (structured outputs), null waar het mag.
 */
export const RECEPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    geen_recept: {
      type: ['string', 'null'],
      description: 'Staat er in de bron geen recept dat je kunt uitlezen (geen ingrediënten en geen bereiding)? Zet hier dan kort waarom, en laat de rest leeg. Anders null.',
    },
    titel: tekst('De naam van het gerecht, in het Nederlands. Zonder naam van de maker, het account of het merk.'),
    personen: { type: 'integer', description: 'Voor hoeveel personen. Staat het er niet, schat dan 4.' },
    bereidingstijd_minuten: { type: ['integer', 'null'], description: 'Totale bereidingstijd in minuten. Null als het echt niet af te leiden is.' },
    keuken: { type: ['string', 'null'], description: 'Bijv. Italiaans, Aziatisch, Nederlands, Mexicaans. Null bij twijfel.' },
    tags: {
      type: 'array', items: { type: 'string' },
      description: "Korte kenmerken in kleine letters. 'vegetarisch' alleen als er echt geen vlees of vis in zit — kijk naar de ingrediënten, niet naar de titel.",
    },
    ingredienten: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hoeveelheid: { type: ['string', 'null'], description: "Alleen het getal, bijv. '250' of '0.5'. Null als er geen hoeveelheid staat of bij 'naar smaak'." },
          eenheid: { type: ['string', 'null'], description: "g, ml, el, tl, blik, bos, teen. Null bij stuks." },
          naam: tekst('De naam van het ingrediënt in het Nederlands, zonder hoeveelheid. Gebruik waar het past precies een naam uit de lijst in de huisregels.'),
        },
        required: ['hoeveelheid', 'eenheid', 'naam'],
      },
    },
    bereiding_nl: {
      type: 'array', items: { type: 'string' },
      description: 'De bereiding als losse, uitvoerbare stappen in het Nederlands, één stap per element, in je eigen woorden.',
    },
  },
  required: ['geen_recept', 'titel', 'personen', 'bereidingstijd_minuten', 'keuken', 'tags', 'ingredienten', 'bereiding_nl'],
} as const

export const HUISREGELS = `Je leest een recept uit en zet het om naar gestructureerde velden voor een Nederlandse boodschappen-app.

Regels:
- Antwoord altijd in het Nederlands. Is de bron Engels of een andere taal, vertaal dan titel, ingrediënten en bereiding.
- Reken om naar metrisch: cups, ounces, pounds en Fahrenheit worden gram, milliliter en graden Celsius. Rond af op praktische hoeveelheden (1 cup bloem is 125 g, 1 cup vloeistof 240 ml, 1 oz 28 g, 1 lb 450 g, 350 °F is 180 °C).
- Verzin niets. Staat een hoeveelheid er niet, laat die dan null. Is een deel onleesbaar of niet uitgesproken, laat het weg.
- Schrijf de bereiding in je eigen, beknopte woorden als losse stappen. Nooit letterlijk overnemen uit de bron.
- Gebruik voor een ingrediënt precies een naam uit de lijst "Ingrediëntnamen met een productnummer" als die het product dekt (schrijf dan "ui", niet "uien" of "gesnipperde ui"). Staat het product er niet in, gebruik dan de gangbare Nederlandse naam. Een bereiding ("in blokjes") hoort niet in de naam.
- Eén product per ingrediënt. "Basilicum en peterselie" zijn twee ingrediënten, elk met een eigen hoeveelheid; één regel met "en" krijgt geen productnummer.
- Zout, peper en water zijn ook ingrediënten als het recept ze noemt; laat ze niet weg.
- Bij een foto of screenshot: lees alleen wat er staat. Staan er meerdere delen, dan horen die bij één recept.
- Bij gesproken tekst (transcript): die is automatisch uitgeschreven en kan fouten bevatten; gebruik het onderschrift en het beeld om namen en hoeveelheden te controleren.
- Staat er in de bron geen recept (geen ingrediënten en geen bereiding), vul dan geen_recept in en verzin er geen.`

/**
 * Het systeemdeel: huisregels plus de ingrediëntnamen die een productnummer
 * hebben, zodat de app ze aan de supermarkt kan koppelen. De lijst komt uit
 * de cache; de volgorde moet daarom elke keer gelijk zijn (gesorteerd).
 */
export function systeem(sleutels: string[]) {
  return [
    { type: 'text' as const, text: HUISREGELS },
    {
      type: 'text' as const,
      text: `Ingrediëntnamen met een productnummer bij de supermarkt:\n${sleutels.join(', ')}`,
      cache_control: { type: 'ephemeral' as const },
    },
  ]
}
