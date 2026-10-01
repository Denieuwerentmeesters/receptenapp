import { describe, expect, it } from 'vitest'
import { dieetLabels, pastBijDieet, wisselDieet } from './dieet'

describe('wisselDieet', () => {
  it('kiest er één per groep', () => {
    expect(wisselDieet(['vegetarisch'], 'vegan')).toEqual(['vegan'])
    expect(wisselDieet(['koolhydraatarm'], 'keto')).toEqual(['keto'])
  })

  it('combineert tussen de groepen', () => {
    expect(wisselDieet(['vegetarisch'], 'keto')).toEqual(['vegetarisch', 'keto'])
  })

  it('zet een gekozen dieet weer uit', () => {
    expect(wisselDieet(['vegan', 'keto'], 'vegan')).toEqual(['keto'])
  })
})

describe('pastBijDieet', () => {
  it('leest vegetarisch uit de tags en de rest uit dieet', () => {
    const recept = { tags: ['vegetarisch'], dieet: ['pescotarisch', 'koolhydraatarm'] }
    expect(pastBijDieet(recept, 'vegetarisch')).toBe(true)
    expect(pastBijDieet(recept, 'koolhydraatarm')).toBe(true)
    expect(pastBijDieet(recept, 'vegan')).toBe(false)
  })

  it('werkt ook als de kolom er nog niet is', () => {
    expect(pastBijDieet({ tags: [] }, 'keto')).toBe(false)
  })
})

describe('dieetLabels', () => {
  it('noemt het strengste label per groep', () => {
    expect(dieetLabels({ tags: ['vegetarisch'], dieet: ['vegan', 'pescotarisch', 'koolhydraatarm', 'keto'] }))
      .toEqual(['vegan', 'keto'])
    expect(dieetLabels({ tags: ['vegetarisch'], dieet: ['pescotarisch', 'koolhydraatarm'] }))
      .toEqual(['vegetarisch', 'koolhydraatarm'])
    expect(dieetLabels({ tags: [], dieet: ['pescotarisch'] })).toEqual([])
  })
})
