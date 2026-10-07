import { describe, expect, it } from 'vitest'
import { gerechtSoort, zonderDubbeleSoort } from './gerechtsoort'

const r = (titel: string, gekozen = false) => ({ titel, titel_nl: null, gekozen })

describe('gerechtSoort', () => {
  it('herkent de soort in de titel', () => {
    expect(gerechtSoort('Wraps met kip en avocado')).toBe('wrap')
    expect(gerechtSoort('Zomerse pastasalade')).toBe('salade')
    expect(gerechtSoort('Kastanjesoep met salie')).toBe('soep')
    expect(gerechtSoort('Curry met (vega)balletjes')).toBe('curry')
  })

  it('geeft niets terug als er geen soort in staat', () => {
    expect(gerechtSoort('Romige paddenstoelen met tijm')).toBeNull()
  })
})

describe('zonderDubbeleSoort', () => {
  it('laat van elke soort alleen de eerste suggestie staan', () => {
    const over = zonderDubbeleSoort([r('Wraps met kip'), r('Linzensoep'), r('Wraps met bonen'), r('Kip uit de oven')])
    expect(over.map((x) => x.titel)).toEqual(['Wraps met kip', 'Linzensoep', 'Kip uit de oven'])
  })

  it('laat staan wat je zelf koos, en dat gaat voor een suggestie', () => {
    const over = zonderDubbeleSoort([r('Wraps met kip'), r('Wraps met bonen', true), r('Wraps met vis', true)])
    expect(over.map((x) => x.titel)).toEqual(['Wraps met bonen', 'Wraps met vis'])
  })
})
