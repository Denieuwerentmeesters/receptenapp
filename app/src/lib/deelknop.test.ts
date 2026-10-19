import { describe, expect, it } from 'vitest'
import { linkUitSchema, toevoegPad } from './deelknop'

describe('linkUitSchema', () => {
  it('leest de link uit kookmaatje://toevoegen', () => {
    expect(linkUitSchema('kookmaatje://toevoegen?url=https%3A%2F%2Fwww.instagram.com%2Freel%2Fabc%2F'))
      .toBe('https://www.instagram.com/reel/abc/')
  })
  it('wijst andere schema\'s, paden en niet-http-links af', () => {
    expect(linkUitSchema('https://kookmaatje.eu/toevoegen?url=https://x.nl')).toBeNull()
    expect(linkUitSchema('kookmaatje://instellingen?url=https://x.nl')).toBeNull()
    expect(linkUitSchema('kookmaatje://toevoegen?url=javascript:alert(1)')).toBeNull()
    expect(linkUitSchema('geen url')).toBeNull()
  })
  it('bouwt het pad naar het toevoegscherm', () => {
    expect(toevoegPad('https://x.nl/a?b=1')).toBe('/toevoegen?route=link&url=https%3A%2F%2Fx.nl%2Fa%3Fb%3D1')
  })
})
