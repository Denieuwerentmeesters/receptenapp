import { describe, expect, test } from 'vitest'
import { aantalVerpakkingen, groepeerOpSchap, verpakkingenPerRegel, voegSamen } from './lijst'
import { ingredientKey } from './schaal'
import type { BoodschapItem } from './database.types'

let n = 0
function rij(ingredient_key: string, hoeveelheid: number | null, eenheid: string | null): BoodschapItem {
  n++
  return {
    id: `i${n}`, user_id: 'u', week_start_datum: '2026-09-28', naam: ingredient_key, ingredient_key,
    hoeveelheid, eenheid, categorie: null, bron_type: 'recept', bron_recept_id: `r${n}`, is_afgevinkt: false,
  } as BoodschapItem
}
const regel = (...rijen: BoodschapItem[]) => voegSamen(rijen)[0]

describe('voegSamen: een keuze sluit aan bij een regel die er al staat', () => {
  const keuze = (naam: string, hoeveelheid: number, eenheid: string) =>
    ({ ...rij(ingredientKey(naam), hoeveelheid, eenheid), naam })

  test('pecorino of parmezaanse kaas hoort bij parmezaanse kaas', () => {
    const regels = voegSamen([keuze('pecorino of parmezaanse kaas', 150, 'g'), rij('parmezaanse kaas', 60, 'g')])
    expect(regels).toHaveLength(1)
    expect(regels[0].naam).toBe('parmezaanse kaas')
    expect(regels[0].label).toBe('210 g parmezaanse kaas')
    // De gewone regel geeft het product, niet de keuze.
    expect(regels[0].voorbeeld.naam).toBe('parmezaanse kaas')
  })

  test('de keuze mag ook eerst in de lijst staan', () => {
    const regels = voegSamen([rij('parmezaanse kaas', 60, 'g'), keuze('pecorino of parmezaanse kaas', 150, 'g')])
    expect(regels.map((r) => r.naam)).toEqual(['parmezaanse kaas'])
  })

  test('zonder zo\'n regel blijft de keuze staan', () => {
    const regels = voegSamen([keuze('pecorino of parmezaanse kaas', 150, 'g'), rij('ricotta', 250, 'g')])
    expect(regels.map((r) => r.naam)).toEqual(['pecorino of parmezaanse kaas', 'ricotta'])
  })

  test('bij een gedeeld woorddeel telt alleen de laatste', () => {
    const regels = voegSamen([keuze('kippen- of groentebouillon', 500, 'ml'), rij('kippenbouillon', 1, 'l')])
    expect(regels).toHaveLength(2)
  })
})

describe('aantalVerpakkingen', () => {
  test('blikken uit twee recepten tellen op', () => {
    expect(aantalVerpakkingen(regel(rij('tomatenblokjes', 1, 'blik'), rij('tomatenblokjes', 1, 'blik')))).toBe(2)
  })

  test('een geschaalde anderhalf blik wordt twee', () => {
    expect(aantalVerpakkingen(regel(rij('kokosmelk', 1.5, 'blikjes')))).toBe(2)
  })

  test('"blik (400 ml)" is ook een blik', () => {
    expect(aantalVerpakkingen(regel(rij('kikkererwten', 2, 'blik (400 ml)')))).toBe(2)
  })

  test('pak, zak, fles en pot tellen ook', () => {
    expect(aantalVerpakkingen(regel(rij('passata', 1, 'pak'), rij('passata', 1, 'pak')))).toBe(2)
    expect(aantalVerpakkingen(regel(rij('spinazie', 1, 'zak'), rij('spinazie', 2, 'zakken')))).toBe(3)
    expect(aantalVerpakkingen(regel(rij('pesto', 1, 'potje')))).toBe(1)
  })

  test('verpakking zonder hoeveelheid telt als één', () => {
    expect(aantalVerpakkingen(regel(rij('mais', null, 'blik'), rij('mais', 1, 'blik')))).toBe(2)
  })

  test('grammen blijven één verpakking', () => {
    expect(aantalVerpakkingen(regel(rij('spinazie', 100, 'g'), rij('spinazie', 100, 'g')))).toBe(1)
  })

  test('uien zijn één net', () => {
    expect(aantalVerpakkingen(regel(rij('ui', 2, null), rij('ui', 1, 'stuks')))).toBe(1)
  })

  test('paprika per stuk', () => {
    expect(aantalVerpakkingen(regel(rij('paprika', 2, null), rij('paprika', 1, 'stuk')))).toBe(3)
  })

  test('gewicht wordt stuks bij groente per stuk', () => {
    expect(aantalVerpakkingen(regel(rij('pompoen', 2.5, 'kg')))).toBe(3)
    expect(aantalVerpakkingen(regel(rij('pompoen', 1050, 'g')))).toBe(1)
    expect(aantalVerpakkingen(regel(rij('courgette', 900, 'g'), rij('courgette', 1, null)))).toBe(4)
    expect(aantalVerpakkingen(regel(rij('paprika', 100, 'g')))).toBe(1)
  })

  test('citroenen zonder bekende inhoud zijn één net', () => {
    expect(aantalVerpakkingen(regel(rij('citroen', 2, null)))).toBe(1)
  })
})

describe('aantalVerpakkingen met inhoud', () => {
  const pak500 = { inhoud: 500, eenheid: 'g' as const }

  test('twee keer 500 g gehakt is twee pakken', () => {
    expect(aantalVerpakkingen(regel(rij('rundergehakt', 500, 'g'), rij('rundergehakt', 500, 'g')), pak500)).toBe(2)
  })

  test('twee keer 100 g spinazie in een zak van 400 g is één zak', () => {
    expect(aantalVerpakkingen(regel(rij('spinazie', 100, 'g'), rij('spinazie', 100, 'g')),
      { inhoud: 400, eenheid: 'g' })).toBe(1)
  })

  test('een kwart speling: 625 g is nog één pak van 500 g', () => {
    expect(aantalVerpakkingen(regel(rij('kipfilet', 625, 'g')), pak500)).toBe(1)
    expect(aantalVerpakkingen(regel(rij('kipfilet', 650, 'g')), pak500)).toBe(2)
  })

  test('500 g broccoli is één stronk van 400 g', () => {
    const stronk = { inhoud: 400, eenheid: 'g' as const }
    expect(aantalVerpakkingen(regel(rij('broccoli', 500, 'g')), stronk)).toBe(1)
    expect(aantalVerpakkingen(regel(rij('broccoli', 520, 'g')), stronk)).toBe(2)
  })

  test('de speling geldt per laatste verpakking, niet per stuk', () => {
    // 1000 g in pakken van 375 g: 2,67 pak, dus drie.
    expect(aantalVerpakkingen(regel(rij('vegagehakt', 500, 'g'), rij('vegagehakt', 500, 'g')), { inhoud: 375, eenheid: 'g' })).toBe(3)
    expect(aantalVerpakkingen(regel(rij('rijst', 1100, 'g')), pak500)).toBe(2)
  })

  test('kilo en liter rekenen om', () => {
    expect(aantalVerpakkingen(regel(rij('aardappel', 1.5, 'kg')), { inhoud: 1000, eenheid: 'g' })).toBe(2)
    expect(aantalVerpakkingen(regel(rij('melk', 0.5, 'l'), rij('melk', 800, 'ml')), { inhoud: 1000, eenheid: 'ml' })).toBe(2)
  })

  test('uien per stuk tegen een net van 1 kg', () => {
    expect(aantalVerpakkingen(regel(rij('ui', 3, null), rij('ui', 2, 'stuks')), { inhoud: 1000, eenheid: 'g' })).toBe(1)
    expect(aantalVerpakkingen(regel(rij('ui', 9, null)), { inhoud: 1000, eenheid: 'g' })).toBe(2)
  })

  test('eieren tegen een doos van 10', () => {
    const doos = { inhoud: 10, eenheid: 'stuks' as const }
    expect(aantalVerpakkingen(regel(rij('ei', 4, null), rij('ei', 8, null)), doos)).toBe(1)
    expect(aantalVerpakkingen(regel(rij('ei', 6, null), rij('ei', 8, null)), doos)).toBe(2)
  })

  test('citroenen tegen een net, rode pepers per stuk', () => {
    expect(aantalVerpakkingen(regel(rij('citroen', 2, null)), { inhoud: 500, eenheid: 'g' })).toBe(1)
    expect(aantalVerpakkingen(regel(rij('rode peper', 1, null), rij('rode peper', 1, null)), { inhoud: 1, eenheid: 'stuks' })).toBe(2)
  })

  test('stengels in de naam zijn geen struiken', () => {
    const r = regel({ ...rij('bleekselderij', 3, null), naam: 'stengels bleekselderij' })
    expect(aantalVerpakkingen(r, { inhoud: 1, eenheid: 'stuks' })).toBe(1)
  })

  test('knoflooktenen zijn geen bollen', () => {
    expect(aantalVerpakkingen(regel(rij('knoflooktenen', 3, null)), { inhoud: 1, eenheid: 'stuks' })).toBe(1)
  })

  test('een theelepel saffraan is één potje, niet honderd', () => {
    expect(aantalVerpakkingen(regel(rij('saffraan', 1, 'tl')), { inhoud: 0.05, eenheid: 'g' })).toBe(1)
  })

  test('nooit meer dan zes', () => {
    expect(aantalVerpakkingen(regel(rij('parmezaan', 2, 'kg')), { inhoud: 50, eenheid: 'g' })).toBe(6)
  })

  test('blikken in het recept gaan voor de inhoud', () => {
    expect(aantalVerpakkingen(regel(rij('kokosmelk', 2, 'blik')), { inhoud: 400, eenheid: 'ml' })).toBe(2)
  })
})

describe('verpakkingenPerRegel', () => {
  const pot = { inhoud: 800, eenheid: 'g' as const }

  test('twee regels uit dezelfde pot zijn samen één pot', () => {
    const regels = voegSamen([rij('bruine bonen', 200, 'g'), rij('pintobonen', 400, 'g')])
    const per = verpakkingenPerRegel(regels, () => '840', () => pot)
    expect(per.get('bruine bonen')).toEqual({ aantal: 1, totaal: 1, samenMet: ['pintobonen'] })
    expect(per.get('pintobonen')).toEqual({ aantal: 0, totaal: 1, samenMet: ['bruine bonen'] })
  })

  test('samen meer dan één pot telt samen op', () => {
    const regels = voegSamen([rij('bruine bonen', 600, 'g'), rij('pintobonen', 600, 'g')])
    const per = verpakkingenPerRegel(regels, () => '840', () => pot)
    expect([...per.values()].reduce((som, r) => som + r.aantal, 0)).toBe(2)
  })

  test('twee regels kruiden met één potje zijn één potje', () => {
    const regels = voegSamen([rij('paprikapoeder', 1, 'tl'), rij('pittige paprikapoeder', 2, 'tl')])
    const per = verpakkingenPerRegel(regels, () => '216677', () => undefined)
    expect([...per.values()].reduce((som, r) => som + r.aantal, 0)).toBe(1)
  })

  test('zonder productnummer telt elke regel op zichzelf', () => {
    const regels = voegSamen([rij('paprika', 2, null), rij('courgette', 1, null)])
    const per = verpakkingenPerRegel(regels, () => null, () => undefined)
    expect(per.get('paprika')?.aantal).toBe(2)
    expect(per.get('courgette')?.aantal).toBe(1)
  })
})

describe('kruiden op de lijst', () => {
  test('theelepels en grammen kurkuma worden één regel zonder hoeveelheid', () => {
    const regels = voegSamen([rij('kurkuma', 1, 'theelepel'), rij('kurkuma', 10, 'gram')])
    expect(regels).toHaveLength(1)
    expect(regels[0].label).toBe('kurkuma')
  })

  test('kurkumapoeder en een maat in de naam vallen samen met kurkuma', () => {
    const regels = voegSamen([rij('kurkuma', 1, 'tl'), rij('kurkumapoeder', 2, 'tl'), rij('gram kurkuma', 10, null)])
    expect(regels).toHaveLength(1)
    expect(regels[0].label).toBe('kurkuma')
  })

  test('paprikapoeder blijft iets anders dan paprika', () => {
    expect(voegSamen([rij('paprika', 2, null), rij('paprikapoeder', 1, 'tl')])).toHaveLength(2)
  })

  test('gewone producten houden hun hoeveelheid', () => {
    expect(regel(rij('spinazie', 100, 'g'), rij('spinazie', 100, 'g')).label).toBe('200 g spinazie')
  })
})

describe('vers en gedroogd', () => {
  const met = (naam: string, ingredient_key: string, hoeveelheid: number, eenheid: string) =>
    ({ ...rij(ingredient_key, hoeveelheid, eenheid), naam })

  test('gemalen koriander staat er zonder hoeveelheid, los van het bosje', () => {
    const regels = voegSamen([
      met('gemalen koriander', 'koriander', 1.3, 'tl'),
      met('gemalen koriander', 'koriander', 27, 'g'),
      met('korianderpoeder', 'korianderpoeder', 1, 'tl'),
      met('verse koriander', 'koriander', 15, 'g'),
    ])
    expect(regels.map((r) => r.label).sort()).toEqual(['15 g verse koriander', 'gemalen koriander'])
    expect(groepeerOpSchap(regels).map((g) => g.schap)).toEqual(['Verse kruiden', 'Kruiden & specerijen'])
  })

  test('gedroogde tijm is een potje, tijm een takje', () => {
    expect(regel(met('gedroogde tijm', 'tijm', 1.3, 'tl')).label).toBe('gedroogde tijm')
    expect(regel(met('tijm', 'tijm', 2, 'takjes')).label).toBe('2 takjes tijm')
  })
})

describe('één product, één regel', () => {
  const met = (naam: string, hoeveelheid: number | null = 1, eenheid: string | null = null) =>
    ({ ...rij(ingredientKey(naam), hoeveelheid, eenheid), naam })
  const labels = (...namen: string[]) => voegSamen(namen.map((n) => met(n))).map((r) => r.label)

  test('enkel- en meervoud en de bereiding tellen samen', () => {
    expect(labels('ui', 'uien', 'ui, gesnipperd', 'ui (fijngesneden)')).toEqual(['4 ui'])
    expect(labels('rode ui', 'rode uien, in ringen')).toEqual(['2 rode ui'])
    expect(labels('tomaten', 'tomaat')).toEqual(['2 tomaten'])
    expect(labels('kipfilets', 'kipfilet')).toEqual(['2 kipfilet'])
  })

  test('alleen het meervoud op de lijst blijft meervoud', () => {
    expect(labels('uien, gesnipperd')).toEqual(['1 uien'])
    expect(labels('citroenen')).toEqual(['1 citroenen'])
  })

  test('andere spelling is hetzelfde product', () => {
    expect(labels('rodewijnazijn', 'rode wijnazijn')).toHaveLength(1)
    expect(labels('kipdijfilet', 'kippendijfilets')).toHaveLength(1)
    expect(labels('lente-ui', 'bosuitjes', 'bosui')).toHaveLength(1)
    expect(labels('boter', 'roomboter', 'ongezouten roomboter', 'boter, gesmolten', 'koude boter')).toHaveLength(1)
    expect(labels('kerstomaatjes', 'cherrytomaten')).toHaveLength(1)
    expect(labels('yoghurt', 'volle yoghurt', 'naturel yoghurt')).toHaveLength(1)
  })

  test('wat echt iets anders is blijft apart', () => {
    expect(labels('ui', 'rode ui', 'bosui')).toHaveLength(3)
    expect(labels('tomaten', 'tomaten uit blik', 'zongedroogde tomaten')).toHaveLength(3)
    expect(labels('roomboter', 'gezouten roomboter', 'kruidenboter')).toHaveLength(3)
    expect(labels('melk', 'kokosmelk')).toHaveLength(2)
    expect(labels('yoghurt', 'magere yoghurt', 'griekse yoghurt', 'kokosyoghurt')).toHaveLength(4)
  })
})
