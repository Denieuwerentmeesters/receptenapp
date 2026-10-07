import { describe, expect, it } from 'vitest'
import { bronVermelding, instagramCode, isInstagramUrl, lijktRecept, normaliseerUrl, siteNaam, websiteLinkIn } from './importeren'

describe('instagramCode', () => {
  it('herkent posts, reels en tv, met en zonder www', () => {
    expect(instagramCode('https://www.instagram.com/p/C8abcDEfgh1/')).toBe('C8abcDEfgh1')
    expect(instagramCode('https://instagram.com/reel/C8abcDEfgh1')).toBe('C8abcDEfgh1')
    expect(instagramCode('https://www.instagram.com/reels/C8abcDEfgh1/?igsh=abc')).toBe('C8abcDEfgh1')
    expect(instagramCode('https://www.instagram.com/tv/C8abcDEfgh1/')).toBe('C8abcDEfgh1')
    expect(instagramCode('https://www.instagram.com/kokenmetkees/p/C8abcDEfgh1/')).toBe('C8abcDEfgh1')
  })
  it('wijst profielen, stories en andere sites af', () => {
    expect(isInstagramUrl('https://www.instagram.com/kokenmetkees/')).toBe(false)
    expect(isInstagramUrl('https://www.instagram.com/stories/kokenmetkees/123/')).toBe(false)
    expect(isInstagramUrl('https://notinstagram.com/p/C8abcDEfgh1/')).toBe(false)
    expect(isInstagramUrl('geen link')).toBe(false)
  })
})

describe('normaliseerUrl', () => {
  it('maakt van elke Instagram-vorm dezelfde postlink', () => {
    expect(normaliseerUrl('https://www.instagram.com/reel/C8abcDEfgh1/?igsh=xyz')).toBe('https://www.instagram.com/p/C8abcDEfgh1/')
    expect(normaliseerUrl('Kijk dit: https://instagram.com/p/C8abcDEfgh1')).toBe('https://www.instagram.com/p/C8abcDEfgh1/')
  })
  it('haalt volgparameters, fragment en eindslash van een website', () => {
    expect(normaliseerUrl('https://www.Uitpaulineskeuken.nl/recept/pasta/?utm_source=ig&fbclid=1#reacties'))
      .toBe('https://www.uitpaulineskeuken.nl/recept/pasta')
    expect(normaliseerUrl('https://example.com/r?id=12&utm_medium=x')).toBe('https://example.com/r?id=12')
  })
  it('vult https aan en wijst onzin af', () => {
    expect(normaliseerUrl('ah.nl/allerhande/recept/R-R1')).toBe('https://ah.nl/allerhande/recept/R-R1')
    expect(normaliseerUrl('mailto:iemand@example.com')).toBeNull()
    expect(normaliseerUrl('pasta met pesto')).toBeNull()
  })
})

describe('lijktRecept', () => {
  it('ziet een ingrediëntenlijst met hoeveelheden', () => {
    expect(lijktRecept('Lekker! Ingrediënten:\n- 250 g pasta\n- 2 tenen knoflook\n- 1 el olijfolie\nBereiding: kook de pasta.')).toBe(true)
    expect(lijktRecept('INGREDIENTS\n1 cup rice\n2 tbsp soy sauce\n½ onion')).toBe(true)
  })
  it('ziet geen recept in een aanprijzing of "link in bio"', () => {
    expect(lijktRecept('De lekkerste pasta ooit 😍 Recept via de link in bio!')).toBe(false)
    expect(lijktRecept('Dag 3 van 30: pasta. Morgen deel 4.')).toBe(false)
  })
})

describe('websiteLinkIn', () => {
  it('geeft de eerste echte website, geen Instagram of linkpagina', () => {
    expect(websiteLinkIn('Recept: https://www.instagram.com/p/abc/ of https://linktr.ee/kees of https://kokenmetkees.nl/pasta.')).toBe('https://kokenmetkees.nl/pasta')
    expect(websiteLinkIn('Link in bio!')).toBeNull()
  })
})

describe('bronVermelding', () => {
  it('noemt het account bij Instagram en de site bij een website', () => {
    expect(bronVermelding({ bron_type: 'instagram', bron_maker: '@kees', url: 'https://www.instagram.com/p/abc/' }))
      .toEqual({ tekst: 'Recept van @kees', bekijk: 'Bekijk op Instagram', url: 'https://www.instagram.com/p/abc/' })
    expect(bronVermelding({ bron_type: 'website', bron_maker: null, url: 'https://www.uitpaulineskeuken.nl/x' }))
      .toEqual({ tekst: 'Recept van uitpaulineskeuken.nl', bekijk: 'Bekijk op uitpaulineskeuken.nl', url: 'https://www.uitpaulineskeuken.nl/x' })
    expect(siteNaam('https://www.ah.nl/allerhande')).toBe('ah.nl')
  })
  it('geeft niets voor de pool en eigen recepten', () => {
    expect(bronVermelding({ bron_type: 'scraper', bron_maker: null, url: 'https://x.nl' })).toBeNull()
    expect(bronVermelding({ bron_type: 'eigen_input', bron_maker: null, url: null })).toBeNull()
  })
})
