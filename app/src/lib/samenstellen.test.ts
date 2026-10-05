import { describe, expect, it, vi } from 'vitest'

// alsLijst is puur; de rest van de module wil een database en een sessie.
vi.mock('./db', () => ({ db: {} }))
vi.mock('./auth', () => ({ huidigeUserId: async () => 'u' }))

import { alsLijst } from './samenstellen'
import { mandjeKosten } from './besparing'
import type { Menu, MenuGerecht } from './menu'
import type { JumboProduct } from './database.types'

const gerecht = (titel: string, ingredienten: MenuGerecht['ingredienten']): MenuGerecht => ({
  rol: 'Gerecht', titel, bereidingstijd_minuten: 30, tags: [], vooraf: null, ingredienten, bereiding_nl: ['Doe iets.'],
})
const menu: Menu = {
  keuken: 'Italiaans', personen: 6, begrepen: [], draaiboek: [], opmerking: null,
  gerechten: [
    gerecht('Lasagne', [
      { hoeveelheid: '700', eenheid: 'g', naam: 'rundergehakt' },
      { hoeveelheid: '2', eenheid: null, naam: 'citroen' },
      { hoeveelheid: null, eenheid: null, naam: 'zout' },
    ]),
    gerecht('Salade', [{ hoeveelheid: '1', eenheid: null, naam: 'citroen' }]),
  ],
}

describe('alsLijst', () => {
  it('voegt samen over de gerechten en laat basisvoorraad weg', () => {
    const regels = alsLijst(menu)
    expect(regels.map((r) => r.key).sort()).toEqual(['citroen', 'rundergehakt'])
    expect(regels.find((r) => r.key === 'citroen')?.items).toHaveLength(2)
  })

  it('rekent in hele verpakkingen: 700 g gehakt is twee pakken van 500 g', () => {
    const mapping = { rundergehakt: { ingredient_key: 'rundergehakt', standaard_sku: 'G' } } as unknown as Record<string, JumboProduct>
    const kosten = mandjeKosten(
      alsLijst(menu).filter((r) => r.key === 'rundergehakt'), mapping, { G: 5 },
      { biologisch: false, huismerk: false }, { G: { inhoud: 500, eenheid: 'g' } },
    )
    expect(kosten.totaal).toBe(10)
  })
})
