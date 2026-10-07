import { describe, expect, test } from 'vitest'
import type { BoodschapItem } from './database.types'
import { metVegaKeuze, vegaOpties, vegaVervanger, vleesVarianten } from './vega'

const rij = (naam: string, ingredient_key = naam) => ({ naam, ingredient_key } as BoodschapItem)

describe('vlees wordt standaard vega', () => {
  test('gehakt, rookworst en spekjes hebben een vega-versie', () => {
    expect(vegaVervanger('rundergehakt')?.key).toBe('vegagehakt')
    expect(vegaVervanger('half om half')?.key).toBe('vegagehakt')
    expect(vegaVervanger('rookworst')?.key).toBe('vega rookworst')
    expect(vegaVervanger('gerookte spekreepje')?.key).toBe('vega spekjes')
    expect(vegaVervanger('kipfilet')).toBeUndefined()
    expect(vegaVervanger('vegagehakt')).toBeUndefined()
  })

  test('de keuzelijst: vega eerst, dan het recept', () => {
    expect(vegaOpties('rundergehakt')).toEqual([{ keuze: 'vega', label: 'Vegagehakt' }, { keuze: 'recept' }])
    expect(vegaOpties('kipfilet')).toEqual([])
  })

  test('naar de winkel gaat de gekozen versie', () => {
    expect(metVegaKeuze(rij('rundergehakt'), 'vega')).toMatchObject({ naam: 'vegagehakt', ingredient_key: 'vegagehakt' })
    expect(metVegaKeuze(rij('rundergehakt'), 'recept')).toMatchObject({ naam: 'rundergehakt' })
  })
})

describe('vega in het recept kun je vlees maken', () => {
  test.each([
    ['vegagehakt', ['rundergehakt', 'kipgehakt']],
    ['vegetarisch gehakt', ['rundergehakt', 'kipgehakt']],
    ['plantaardig rulgehakt', ['rundergehakt', 'kipgehakt']],
    ['vegetarische kipschnitzel', ['kipschnitzel']],
    ['vega rookworst', ['rookworst']],
    ['vega spekje', ['spekblokje']],
    // Geen vleesversie met een productnummer: niets te kiezen.
    ['vegetarische gehaktbal', []],
    ['plantaardige yoghurt', []],
    ['rundergehakt', []],
  ])('%s → %j', (key, keys) => {
    expect(vleesVarianten(key).map((v) => v.key)).toEqual(keys)
  })

  test('de keuzelijst: het recept eerst, dan het vlees', () => {
    expect(vegaOpties('vegagehakt')).toEqual([
      { keuze: 'vega' }, { keuze: 'rundergehakt', label: 'Rundergehakt' }, { keuze: 'kipgehakt', label: 'Kipgehakt' },
    ])
  })

  test('naar de winkel gaat het gekozen vlees, of het recept zelf', () => {
    expect(metVegaKeuze(rij('vegagehakt (of gehakt)', 'vegagehakt'), 'kipgehakt'))
      .toMatchObject({ naam: 'kipgehakt', ingredient_key: 'kipgehakt' })
    expect(metVegaKeuze(rij('vegagehakt (of gehakt)', 'vegagehakt'), 'vega')).toMatchObject({ naam: 'vegagehakt (of gehakt)' })
    // Een keuze die niet bij dit ingrediënt hoort doet niets.
    expect(metVegaKeuze(rij('vegagehakt'), 'kipschnitzel')).toMatchObject({ naam: 'vegagehakt' })
  })
})
