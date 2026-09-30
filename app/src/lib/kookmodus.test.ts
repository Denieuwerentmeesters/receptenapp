import { describe, expect, test } from 'vitest'
import { formatteerDuur, tijdenUitStap } from './kookmodus'

/** Echte stappen uit data/recepten.json, met de knoppen die we verwachten. */
const STAPPEN: Array<[string, string[]]> = [
  ['Voeg de krieltjes en sperziebonen toe en laat dit 10 tot 15 minuten sudderen tot de groenten gaar zijn.',
    ['10 min sudderen']],
  ['Snipper ondertussen de ui en de knoflook fijn en laat ze op laag vuur 4 à 5 minuten goudkleurig worden in een scheutje olie.',
    ['4 min']],
  ['Bak ze 12-15 minuten tot ze goudbruin en gaar zijn.',
    ['12 min']],
  ['Giet de bouillon erbij samen met de pasta, breng aan de kook en laat circa 15 minuten koken tot de pasta gaar is.',
    ['15 min koken']],
  ['Laat de taart 5 minuten rusten voordat je hem uit de vorm haalt en in punten snijdt.',
    ['5 min rusten']],
  ['Rooster de kip 15 minuten op 220°C, verlaag dan de temperatuur naar 180°C en gaar nog circa 1 uur tot de kip volledig gaar is.',
    ['15 min', '1 uur']],
  ['Doe het karkas, de geschroeide groenten, steranijs, peperkorrels en kaneelstokjes samen met de bouillon, vissaus en suiker in een grote pan en laat dit ongeveer een uur zachtjes trekken.',
    ['1 uur']],
  ['Laat het geheel ongeveer anderhalf uur zachtjes stoven, tot de kip mals is en de saus is ingedikt.',
    ['1,5 uur']],
  ['Dompel intussen de kippendijen onder in het achtergehouden deel van de citroen-kruidenmix; een kwartier marineren is genoeg.',
    ['15 min marineren']],
  ['Snijd de brie in plakjes en verdeel die over de pasta. Schuif de schaal een kwartier tot twintig minuten de oven in, tot de brie mooi gesmolten is.',
    ['15 min']],
  ['Voeg de gedroogde vruchten toe en laat alles nog een half uur doorstoven tot het vlees mals is en uit elkaar valt.',
    ['30 min doorstoven']],
  ['Laat de schotel een halfuur garen in de voorverwarmde oven, tot de korst mooi kleurt en knapperig wordt.',
    ['30 min garen']],
  ['Laat de soep met deksel zo\'n 2 tot 2,5 uur zachtjes sudderen tot het vlees mals is.',
    ['2 uur']],
  ['Laat alles op de lage stand zo\'n 3,5 uur garen, en houd de vochtigheid in de gaten.',
    ['3,5 uur garen']],
  ['Snijd de rijstpapiervellen doormidden en week elke helft circa 30 seconden in koud water tot ze soepel zijn.',
    ['30 sec']],
  ['Kook de garnalen ongeveer anderhalve minuut tot ze roze zijn en snijd ze in de lengte doormidden.',
    ['1,5 min']],
  ['Neem de schaal uit de oven, schik de kippendijen bovenop de krieltjes en laat alles nog eens twintig minuten garen.',
    ['20 min garen']],
  ['Rooster circa acht minuten tot krokant en goudbruin, en schud de plaat halverwege om.',
    ['8 min']],
  ['Fruit de Butter Chicken kruidenpasta al roerend 1 tot 2 minuten in een diepe koekenpan, schenk er de yoghurt en de kookroom bij en laat dit nog zo\'n 5 minuten zachtjes sudderen.',
    ['1 min', '5 min']],
  ['Laat de kip na het bakken 15 minuten rusten voordat je hem aansnijdt.',
    ['15 min rusten']],
  ['Kook de pasta 2 minuten korter dan op de verpakking staat aangegeven in ruim gezouten water; bewaar 200 ml kookvocht en giet de pasta af.',
    []],
  ['Laat de gratin een paar minuten rusten voordat je hem serveert.',
    []],
  ['Voeg de venkel, wortel en aardappel toe en roerbak dit enkele minuten.',
    []],
  ['Verhit de olie op middelhoog vuur en bak de ui glazig.',
    []],
]

describe('tijdenUitStap', () => {
  test.each(STAPPEN)('%s', (stap, verwacht) => {
    expect(tijdenUitStap(stap).map((t) => t.label)).toEqual(verwacht)
  })

  test('neemt bij een bereik de laagste waarde', () => {
    expect(tijdenUitStap('Laat 10-12 min staan.')[0].seconden).toBe(600)
    expect(tijdenUitStap('Laat 12 à 10 minuten staan.')[0].seconden).toBe(600)
  })

  test('geeft dezelfde tijd maar één keer', () => {
    expect(tijdenUitStap('Bak 5 minuten, draai om en bak nog 5 minuten.')).toHaveLength(1)
  })
})

describe('formatteerDuur', () => {
  test.each([[30, '30 sec'], [90, '1,5 min'], [100, '2 min'], [600, '10 min'], [3600, '1 uur'], [5400, '1,5 uur'], [7200, '2 uur']])(
    '%i seconden → %s', (s, verwacht) => { expect(formatteerDuur(s)).toBe(verwacht) },
  )
})
