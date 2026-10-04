import { Capacitor } from '@capacitor/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WEBSITE } from './config'
import { db } from './db'
import { huidigeUserId } from './auth'
import type { Concept } from './extractie'
import { schatPrijsPerPersoon } from './prijsschatting'
import { useMemo } from 'react'
import { altijdInHuis } from './altijdInHuis'
import { mandjeKosten } from './besparing'
import { voegSamen, type LijstRegel } from './lijst'
import { useJumboMapping, useVoorkeuren } from './queries'
import { useJumboPrijzen, useJumboVerpakkingen, useVoorraad } from './queries2'
import { DROGE_KRUIDEN_KEY, isDroogKruid } from './kruiden'
import { inVoorraad } from './voorraad'
import { ingredientKey } from './schaal'
import { productvoorkeur } from './winkel'
import { leesMenu, type Menu, type MenuGebeurtenis, type MenuGerecht, type SamenstelVerzoek } from './menu'
import type { BoodschapItem, SamenstellingRij } from './database.types'

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

/**
 * Het menu als regels op een boodschappenlijst: samengevoegd over de gerechten
 * en zonder basisvoorraad, zoals het straks op de lijst komt. Voor de kosten
 * en het aantal producten onderaan het menuscherm.
 */
export function alsLijst(menu: Menu): LijstRegel[] {
  const items: BoodschapItem[] = []
  menu.gerechten.forEach((gerecht, g) => {
    gerecht.ingredienten.forEach((ing, i) => {
      const key = ingredientKey(ing.naam)
      if (!key || altijdInHuis(key)) return
      const getal = Number.parseFloat(String(ing.hoeveelheid ?? '').replace(',', '.'))
      items.push({
        id: `${g}-${i}`, user_id: '', week_start_datum: '', naam: ing.naam, ingredient_key: key,
        hoeveelheid: Number.isFinite(getal) ? getal : null, eenheid: ing.eenheid, categorie: null,
        bron_type: 'recept', bron_recept_id: String(g), is_afgevinkt: false, aangemaakt_op: '',
      })
    })
  })
  return voegSamen(items)
}

/**
 * Wat het menu ongeveer kost aan de kassa: hele verpakkingen tegen de gewone
 * Jumbo-prijs (ook voor AH; die liggen dicht bij elkaar), en zonder prijs de
 * klassenschatting. Dezelfde som als Bespaard! (mandjeKosten). Wat je in je
 * voorraadkast hebt telt niet mee; `inHuis` zegt hoeveel producten dat zijn.
 *
 * Niet schatPrijsPerPersoon: die telt alleen wat het recept verbruikt (150 g
 * uit een pak van 500 g) en kwam daardoor een derde te laag uit.
 */
export function useMenuKosten(menu: Menu | null): { producten: number; kosten: number | null; inHuis: number } {
  const voorkeuren = useVoorkeuren()
  const mapping = useJumboMapping(true)
  const prijzen = useJumboPrijzen()
  const verpakkingen = useJumboVerpakkingen()
  const voorraad = useVoorraad()
  return useMemo(() => {
    const alle = menu ? alsLijst(menu) : []
    // Wat in je voorraadkast staat hoef je niet te kopen; zelfde regels als
    // het boodschappenscherm (ook: droge kruiden als die in huis zijn).
    const kruidenThuis = (voorraad.data ?? []).some((v) => v.ingredient_key === DROGE_KRUIDEN_KEY && v.in_huis)
    const thuis = new Set((voorraad.data ?? [])
      .filter((v) => v.in_huis && v.ingredient_key !== DROGE_KRUIDEN_KEY).map((v) => v.ingredient_key))
    const kopen = alle.filter((r) => !(kruidenThuis && isDroogKruid(r.key)) && !inVoorraad(r.key, thuis))
    const basis = { producten: kopen.length, inHuis: alle.length - kopen.length }
    if (!mapping.data || !prijzen.data) return { ...basis, kosten: null }
    const { totaal } = mandjeKosten(
      kopen, mapping.data, prijzen.data, productvoorkeur(voorkeuren.data), verpakkingen.data ?? {},
    )
    return { ...basis, kosten: totaal > 0 ? totaal : null }
  }, [menu, mapping.data, prijzen.data, verpakkingen.data, voorkeuren.data, voorraad.data])
}

/**
 * Vraagt api/menu-afbeeldingen.ts om de foto's bij een opgeslagen menu. Geeft
 * terug hoeveel er gelukt zijn; nul bij elke fout, want dan maakt de
 * nachtelijke ronde ze alsnog.
 */
export async function maakFotos(samenstellingId: string): Promise<number> {
  try {
    const respons = await fetch(
      Capacitor.isNativePlatform() ? `${WEBSITE}/api/menu-afbeeldingen` : '/api/menu-afbeeldingen',
      {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ samenstellingId }),
      },
    )
    if (!respons.ok) return 0
    return ((await respons.json()) as { gelukt?: number }).gelukt ?? 0
  } catch {
    return 0
  }
}

/**
 * Slaat de gerechten van een menu op als recepten, in de volgorde van het
 * menu. Altijd privé (check-constraint samengesteld_altijd_prive), en met de
 * porties van het menu: de hoeveelheden zijn al voor dat aantal uitgerekend.
 *
 * Pas hier komt er iets in `recepten`; wie alleen kijkt laat niets achter. De
 * foto's worden daarna meteen gemaakt (maakFotos).
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
    onSuccess: (_ids, { samenstellingId }) => {
      void qc.invalidateQueries({ queryKey: ['mijn-recepten'] })
      void qc.invalidateQueries({ queryKey: ['favorieten'] })
      void qc.invalidateQueries({ queryKey: ['favoriet-ids'] })
      // De foto's meteen laten maken; daar wachten we niet op. Zodra ze er
      // zijn verversen de schermen die het recept tonen.
      if (samenstellingId) {
        void maakFotos(samenstellingId).then((gelukt) => {
          if (gelukt === 0) return
          for (const sleutel of ['deze-week', 'recept', 'favorieten', 'geschiedenis']) {
            void qc.invalidateQueries({ queryKey: [sleutel] })
          }
        })
      }
    },
  })
}

/** Een menu dat je eerder liet samenstellen, om terug te halen. */
export interface EerderMenu {
  id: string
  /** Wat je toen vroeg: je wensen, of bij een aanpassing wat er anders moest. */
  wensen: string
  aangepast: boolean
  aangemaaktOp: string
  menu: Menu
}

/**
 * Je eerdere menu's, nieuwste eerst. Elke aanvraag staat in `samenstelling`,
 * ook als je daarna wegklikte zonder iets te bewaren; hiermee haal je zo'n
 * menu terug. Mislukte aanvragen (geen bruikbaar menu) vallen af.
 */
export function useEerdereMenus() {
  return useQuery({
    queryKey: ['eerdere-menus'],
    queryFn: async (): Promise<EerderMenu[]> => {
      const { data, error } = await db.from('samenstelling')
        .select('id, soort, keuken, personen, wensen, antwoord, aangemaakt_op')
        .not('antwoord', 'is', null)
        .order('aangemaakt_op', { ascending: false })
        .limit(40)
      if (error) throw error
      return (data as SamenstellingRij[]).flatMap((rij) => {
        const menu = leesMenu(rij.antwoord, rij.personen, rij.keuken)
        return menu ? [{
          id: rij.id, wensen: rij.wensen, aangepast: rij.soort === 'aanpassing',
          aangemaaktOp: rij.aangemaakt_op, menu,
        }] : []
      })
    },
  })
}

/** De recepten die bij een eerder menu zijn opgeslagen, in de volgorde van het menu; leeg als dat nooit gebeurde. */
export async function receptenVanMenu(samenstellingId: string): Promise<string[]> {
  const { data, error } = await db.from('recepten').select('id')
    .eq('samenstelling_id', samenstellingId).order('aangemaakt_op')
  if (error) throw error
  return (data as { id: string }[]).map((r) => r.id)
}
