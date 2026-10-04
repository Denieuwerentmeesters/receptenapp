import { Capacitor } from '@capacitor/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { WEBSITE } from './config'
import { db } from './db'
import { huidigeUserId } from './auth'
import type { Concept } from './extractie'
import { schatPrijsPerPersoon } from './prijsschatting'
import type { Menu, MenuGebeurtenis, MenuGerecht, SamenstelVerzoek } from './menu'

/**
 * De app-kant van "Zelf samenstellen": praat met api/samenstellen.ts en slaat
 * een menu op als recepten. De vorm van een menu staat in lib/menu.ts.
 */

/** Zelfde regel als lib/extractie.ts: de iOS-app heeft het hele adres nodig. */
function endpoint(): string {
  return Capacitor.isNativePlatform() ? `${WEBSITE}/api/samenstellen` : '/api/samenstellen'
}

export interface Samengesteld {
  menu: Menu
  samenstellingId: string | null
}

/**
 * Vraagt een menu aan en meldt elk gerecht zodra het binnen is.
 *
 * Het antwoord is één gebeurtenis per regel. In de browser komen die druppelend
 * binnen; in de iOS-app (CapacitorHttp) alles tegelijk aan het eind. Beide
 * lopen door dezelfde lus.
 */
export async function stelSamen(
  verzoek: SamenstelVerzoek,
  opGebeurtenis: (g: MenuGebeurtenis) => void,
  signaal?: AbortSignal,
): Promise<Samengesteld> {
  const respons = await fetch(endpoint(), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(verzoek),
    signal: signaal,
  })
  if (!respons.ok) {
    const { fout } = (await respons.json().catch(() => ({}))) as { fout?: string }
    throw new Error(fout ?? 'Het samenstellen is niet gelukt. Probeer het opnieuw.')
  }

  let klaar: Samengesteld | null = null
  const verwerk = (regel: string) => {
    if (!regel.trim()) return
    const g = JSON.parse(regel) as MenuGebeurtenis
    if (g.soort === 'fout') throw new Error(g.fout)
    if (g.soort === 'klaar') klaar = { menu: g.menu, samenstellingId: g.samenstellingId }
    opGebeurtenis(g)
  }

  const lezer = respons.body?.getReader()
  if (!lezer) {
    for (const regel of (await respons.text()).split('\n')) verwerk(regel)
  } else {
    const decoder = new TextDecoder()
    let rest = ''
    for (;;) {
      const { done, value } = await lezer.read()
      rest += decoder.decode(value, { stream: !done })
      const regels = rest.split('\n')
      rest = regels.pop() ?? ''
      for (const regel of regels) verwerk(regel)
      if (done) break
    }
    verwerk(rest)
  }

  if (!klaar) throw new Error('De verbinding viel weg voordat het menu af was. Probeer het opnieuw.')
  return klaar
}

/** Een gerecht in de vorm van een toe te voegen recept (opslaan, prijsschatting). */
export function alsConcept(gerecht: MenuGerecht, menu: Pick<Menu, 'keuken' | 'personen'>): Concept {
  const rol = gerecht.rol.toLowerCase()
  return {
    titel: gerecht.titel,
    personen: menu.personen,
    bereidingstijd_minuten: gerecht.bereidingstijd_minuten ?? undefined,
    keuken: menu.keuken,
    tags: gerecht.tags.includes(rol) ? gerecht.tags : [...gerecht.tags, rol],
    ingredienten: gerecht.ingredienten,
    bereiding_nl: gerecht.bereiding_nl,
  }
}

/** Geschatte kosten van het hele menu in euro's (klassenschatting); null als er niets te schatten viel. */
export function schatMenu(menu: Menu): number | null {
  let totaal = 0
  let geteld = false
  for (const gerecht of menu.gerechten) {
    const pp = schatPrijsPerPersoon(alsConcept(gerecht, menu))
    if (pp === null) continue
    totaal += pp * menu.personen
    geteld = true
  }
  return geteld ? totaal : null
}

/**
 * Slaat de gerechten van een menu op als recepten, in de volgorde van het
 * menu. Altijd privé (check-constraint samengesteld_altijd_prive), en met de
 * porties van het menu: de hoeveelheden zijn al voor dat aantal uitgerekend.
 *
 * Pas hier komt er iets in `recepten`; wie alleen kijkt laat niets achter. De
 * foto volgt 's nachts (api/afbeeldingen.ts).
 */
export function useMenuOpslaan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ menu, samenstellingId, bewaar }: Samengesteld & {
      /** Ook bij je favorieten zetten: zo vind je ze terug als ze niet op je lijst gaan. */
      bewaar: boolean
    }): Promise<string[]> => {
      const userId = await huidigeUserId()
      const ids: string[] = []
      // Eén voor één: zo is de volgorde zeker, en het zijn er hooguit zes.
      for (const gerecht of menu.gerechten) {
        const concept = alsConcept(gerecht, menu)
        const { data, error } = await db.from('recepten').insert({
          user_id: userId,
          titel: concept.titel,
          bron: 'Zelf samengesteld',
          url: null,
          personen: concept.personen,
          bereidingstijd_minuten: concept.bereidingstijd_minuten ?? null,
          keuken: concept.keuken ?? null,
          tags: concept.tags,
          ingredienten: concept.ingredienten,
          bereiding_nl: concept.bereiding_nl,
          bron_type: 'samengesteld',
          deel_status: 'prive',
          samenstelling_id: samenstellingId,
          prijs_pp_schatting: schatPrijsPerPersoon(concept),
        }).select('id').single()
        if (error) throw error
        ids.push((data as { id: string }).id)
      }
      if (bewaar) {
        const { error } = await db.from('favoriet').insert(ids.map((id) => ({ user_id: userId, recept_id: id })))
        if (error) throw error
      }
      return ids
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mijn-recepten'] })
      void qc.invalidateQueries({ queryKey: ['favorieten'] })
      void qc.invalidateQueries({ queryKey: ['favoriet-ids'] })
    },
  })
}
