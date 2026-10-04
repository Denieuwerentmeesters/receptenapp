import { describe, expect, it } from 'vitest'
import { MenuStroom, type StroomDeel } from './menuStroom'
import { leesGerecht, leesMenu } from './menu'

const ANTWOORD = JSON.stringify({
  keuken: 'Midden-Oosters',
  begrepen: ['vegetarisch', 'zonder noten'],
  gerechten: [
    {
      rol: 'Salade', titel: 'Fattoush met "sumak" {en} [pita]', bereidingstijd_minuten: 25, tags: ['vegetarisch'],
      vooraf: 'dressing maken',
      ingredienten: [{ hoeveelheid: '3', eenheid: null, naam: 'komkommer' }, { hoeveelheid: '4', eenheid: 'el', naam: 'sumak' }],
      bereiding_nl: ['Snijd de groente.', 'Meng met de dressing: "eerst proeven".'],
    },
    {
      rol: 'Bijgerecht', titel: 'Geroosterde bloemkool', bereidingstijd_minuten: 40, tags: [], vooraf: null,
      ingredienten: [{ hoeveelheid: '3', eenheid: null, naam: 'bloemkool' }],
      bereiding_nl: ['Rooster 30 minuten op 220 °C.'],
    },
  ],
  draaiboek: [{ wanneer: '17:45', wat: 'Bloemkool de oven in' }],
  opmerking: null,
})

/** Het antwoord in stukjes van `grootte` tekens, zoals het van de API komt. */
function inStukjes(grootte: number): StroomDeel[] {
  const stroom = new MenuStroom()
  const uit: StroomDeel[] = []
  for (let i = 0; i < ANTWOORD.length; i += grootte) uit.push(...stroom.voeg(ANTWOORD.slice(i, i + grootte)))
  return uit
}

describe('MenuStroom', () => {
  it.each([1, 7, 64, 100000])('geeft kop en gerechten, in stukjes van %i', (grootte) => {
    const delen = inStukjes(grootte)
    expect(delen.map((d) => d.soort)).toEqual(['kop', 'gerecht', 'gerecht'])
    expect(delen[0].waarde).toEqual({ keuken: 'Midden-Oosters', begrepen: ['vegetarisch', 'zonder noten'] })
    expect(leesGerecht(delen[1].waarde)?.titel).toBe('Fattoush met "sumak" {en} [pita]')
    expect(leesGerecht(delen[2].waarde)?.rol).toBe('Bijgerecht')
  })

  it('ziet het draaiboek niet aan voor een gerecht', () => {
    expect(inStukjes(5).filter((d) => d.soort === 'gerecht')).toHaveLength(2)
  })

  it('geeft een gerecht pas als het af is', () => {
    const stroom = new MenuStroom()
    const half = ANTWOORD.indexOf('Geroosterde')
    expect(stroom.voeg(ANTWOORD.slice(0, half)).map((d) => d.soort)).toEqual(['kop', 'gerecht'])
    expect(stroom.voeg(ANTWOORD.slice(half)).map((d) => d.soort)).toEqual(['gerecht'])
  })
})

describe('leesMenu', () => {
  it('zet het aantal personen van de aanvraag en laat lege gerechten weg', () => {
    const ruw = JSON.parse(ANTWOORD) as { gerechten: unknown[] }
    ruw.gerechten.push({ rol: 'Dessert', titel: 'Niets', ingredienten: [], bereiding_nl: [] })
    const menu = leesMenu(ruw, 10, 'Verras me')
    expect(menu?.personen).toBe(10)
    expect(menu?.keuken).toBe('Midden-Oosters')
    expect(menu?.gerechten).toHaveLength(2)
    expect(menu?.gerechten[0].ingredienten[0]).toEqual({ hoeveelheid: '3', eenheid: null, naam: 'komkommer' })
  })

  it('geeft null zonder bruikbaar gerecht', () => {
    expect(leesMenu({ gerechten: [{ titel: 'x' }] }, 4, 'Italiaans')).toBeNull()
  })
})
