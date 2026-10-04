import { describe, expect, it } from 'vitest'
import { leesReceptPad, naamSlug, receptPad } from './slug'

const ID = '199ad632-e86c-4d49-ad7e-c583151ac632'

describe('naamSlug', () => {
  it('maakt van een titel een leesbare naam', () => {
    expect(naamSlug('Romige kip met spinazie')).toBe('romige-kip-met-spinazie')
    expect(naamSlug('Crème brûlée (snel)')).toBe('creme-brulee-snel')
    expect(naamSlug("Pasta all'arrabbiata & burrata")).toBe('pasta-all-arrabbiata-burrata')
  })

  it('houdt het kort en eindigt niet op een streepje', () => {
    const lang = naamSlug(`${'a'.repeat(79)} en nog veel meer`)
    expect(lang.length).toBeLessThanOrEqual(80)
    expect(lang.endsWith('-')).toBe(false)
  })

  it('valt terug op "recept" als er niets overblijft', () => {
    expect(naamSlug('🍝')).toBe('recept')
  })
})

describe('receptPad', () => {
  it('geeft de slug van een recept uit de pool', () => {
    expect(receptPad({ id: ID, slug: 'romige-kip', titel: 'x', titel_nl: null })).toBe('romige-kip')
  })

  it('houdt bij een eigen recept het id erachter', () => {
    expect(receptPad({ id: ID, slug: null, titel: 'Lasagna', titel_nl: 'Lasagne van oma' })).toBe(`lasagne-van-oma-${ID}`)
  })
})

describe('leesReceptPad', () => {
  it('herkent een oud adres met alleen het id', () => {
    expect(leesReceptPad(ID)).toEqual({ id: ID })
  })

  it('herkent het id achter een naam', () => {
    expect(leesReceptPad(`lasagne-van-oma-${ID}`)).toEqual({ id: ID })
  })

  it('ziet de rest als slug', () => {
    expect(leesReceptPad('romige-kip-met-spinazie')).toEqual({ slug: 'romige-kip-met-spinazie' })
    expect(leesReceptPad('lasagne-2')).toEqual({ slug: 'lasagne-2' })
  })

  it('weigert wat geen adres kan zijn', () => {
    expect(leesReceptPad('')).toBeNull()
    expect(leesReceptPad('Romige Kip')).toBeNull()
    expect(leesReceptPad('../etc')).toBeNull()
  })
})
