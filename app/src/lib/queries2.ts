import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from './db'
import { huidigeUserId } from './auth'
import { ingredientKey } from './schaal'
import { weekStart } from './week'
import { sleutels } from './queries'
import type { BronType, DeelStatus, Recept } from './database.types'
import type { Concept } from './extractie'
import { BUDGET_PER_PERSOON, schatPrijsPerPersoon } from './prijsschatting'

/* --------------------------------------------------------------- ontdekken */

export interface OntdekFilters {
  zoek: string
  maxTijd: number | null
  keuken: string | null
  alleenVega: boolean
  alleenBudget: boolean
}

const PER_PAGINA = 30

/** Het stukje van de PostgREST-builder dat de filters nodig hebben. */
interface Filterbaar {
  or(filter: string): Filterbaar
  lte(kolom: string, waarde: number): Filterbaar
  eq(kolom: string, waarde: string): Filterbaar
  contains(kolom: string, waarde: string[]): Filterbaar
}

/**
 * Dezelfde filters voor de pagina's en voor de telling, zodat die nooit
 * uiteenlopen. De casts zijn nodig omdat de volledige builder-typen van
 * postgrest-js TypeScript in een oneindige lus laten lopen.
 */
function metFilters<T>(vraag: T, filters: OntdekFilters): T {
  let v = vraag as unknown as Filterbaar
  const zoek = filters.zoek.trim()
  if (zoek) {
    // Zoek op titel én op de Nederlandse titel; PostgREST's `or` wil
    // komma-gescheiden condities.
    const patroon = `%${zoek}%`
    v = v.or(`titel.ilike.${patroon},titel_nl.ilike.${patroon}`)
  }
  if (filters.maxTijd) v = v.lte('bereidingstijd_minuten', filters.maxTijd)
  if (filters.keuken) v = v.eq('keuken', filters.keuken)
  if (filters.alleenVega) v = v.contains('tags', ['vegetarisch'])
  if (filters.alleenBudget) v = v.lte('prijs_pp_schatting', BUDGET_PER_PERSOON)
  return v as unknown as T
}

/**
 * Alle recepten doorbladeren met filters. Paginerend, want 475 recepten in één
 * keer ophalen is zonde van de verbinding als je er tien bekijkt.
 */
export function useOntdek(filters: OntdekFilters) {
  return useInfiniteQuery({
    queryKey: ['ontdek', filters],
    initialPageParam: 0,
    getNextPageParam: (laatste: Recept[], allePaginas) =>
      laatste.length < PER_PAGINA ? undefined : allePaginas.length,
    queryFn: async ({ pageParam }) => {
      const van = (pageParam as number) * PER_PAGINA
      const { data, error } = await metFilters(db.from('recepten').select('*'), filters)
        .order('titel')
        .range(van, van + PER_PAGINA - 1)
      if (error) throw error
      return data as Recept[]
    },
  })
}

/**
 * Hoeveel recepten er binnen deze filters zijn — het getal bovenaan Ontdekken.
 * Los van de pagina's: je wilt "475 recepten" zien, niet "30+".
 */
export function useOntdekTelling(filters: OntdekFilters) {
  return useQuery({
    queryKey: ['ontdek-telling', filters],
    queryFn: async (): Promise<number> => {
      const { count, error } = await metFilters(
        db.from('recepten').select('id', { count: 'exact', head: true }), filters,
      )
      if (error) throw error
      return count ?? 0
    },
  })
}

/** De keukens die daadwerkelijk in de pool voorkomen, met aantallen. */
export function useKeukens() {
  return useQuery({
    queryKey: ['keukens'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<{ keuken: string; aantal: number }[]> => {
      const { data, error } = await db.from('recepten').select('keuken')
      if (error) throw error
      const teller = new Map<string, number>()
      for (const rij of data as { keuken: string | null }[]) {
        if (!rij.keuken || rij.keuken.startsWith('anders')) continue
        teller.set(rij.keuken, (teller.get(rij.keuken) ?? 0) + 1)
      }
      return [...teller]
        .map(([keuken, aantal]) => ({ keuken, aantal }))
        .sort((a, b) => b.aantal - a.aantal)
    },
  })
}

/* -------------------------------------------------------------- favorieten */

export function useFavorieten() {
  return useQuery({
    queryKey: ['favorieten'],
    queryFn: async (): Promise<Recept[]> => {
      const { data, error } = await db.from('favoriet').select('recept_id, recepten(*)')
      if (error) throw error
      return (data as unknown as { recepten: Recept }[])
        .map((r) => r.recepten)
        .filter(Boolean)
    },
  })
}

/**
 * Let op: geen Set als querydata — zelfde valkuil als useAhMapping. De cache
 * gaat naar localStorage en JSON.stringify(new Set(...)) wordt '{}'; na een
 * herstart is `.has()` dan weg. Een gewoon object overleeft dat wel.
 */
export function useFavorietIds() {
  return useQuery({
    queryKey: ['favoriet-ids'],
    queryFn: async (): Promise<Record<string, true>> => {
      const { data, error } = await db.from('favoriet').select('recept_id')
      if (error) throw error
      return Object.fromEntries((data as { recept_id: string }[]).map((r) => [r.recept_id, true as const]))
    },
  })
}

export function useFavorietToggle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ receptId, favoriet }: { receptId: string; favoriet: boolean }) => {
      if (favoriet) {
        const { error } = await db.from('favoriet')
          .insert({ user_id: await huidigeUserId(), recept_id: receptId })
        if (error) throw error
      } else {
        const { error } = await db.from('favoriet').delete().eq('recept_id', receptId)
        if (error) throw error
      }
    },
    onMutate: async ({ receptId, favoriet }) => {
      await qc.cancelQueries({ queryKey: ['favoriet-ids'] })
      const vorige = qc.getQueryData<Record<string, true>>(['favoriet-ids'])
      if (vorige) {
        const nieuw = { ...vorige }
        if (favoriet) nieuw[receptId] = true; else delete nieuw[receptId]
        qc.setQueryData(['favoriet-ids'], nieuw)
      }
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(['favoriet-ids'], context.vorige)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['favoriet-ids'] })
      void qc.invalidateQueries({ queryKey: ['favorieten'] })
    },
  })
}

/* --------------------------------------------------------------- voorraad */

export interface VoorraadItem {
  user_id: string
  ingredient_key: string
  naam: string
  categorie: string | null
  in_huis: boolean
  bijgewerkt_op: string
}

export function useVoorraad() {
  return useQuery({
    queryKey: ['voorraad'],
    queryFn: async (): Promise<VoorraadItem[]> => {
      const { data, error } = await db.from('voorraad_item').select('*').order('naam')
      if (error) throw error
      return data as VoorraadItem[]
    },
  })
}

export function useVoorraadMuteren() {
  const qc = useQueryClient()
  const ververs = () => {
    void qc.invalidateQueries({ queryKey: ['voorraad'] })
    void qc.invalidateQueries({ queryKey: sleutels.boodschappen(weekStart()) })
  }

  const toggle = useMutation({
    mutationFn: async ({ key, inHuis }: { key: string; inHuis: boolean }) => {
      const { error } = await db.from('voorraad_item')
        .update({ in_huis: inHuis, bijgewerkt_op: new Date().toISOString() })
        .eq('ingredient_key', key)
      if (error) throw error
    },
    onMutate: async ({ key, inHuis }) => {
      await qc.cancelQueries({ queryKey: ['voorraad'] })
      const vorige = qc.getQueryData<VoorraadItem[]>(['voorraad'])
      qc.setQueryData<VoorraadItem[]>(['voorraad'], (oud) =>
        oud?.map((i) => (i.ingredient_key === key ? { ...i, in_huis: inHuis } : i)))
      return { vorige }
    },
    onError: (_e, _v, c) => { if (c?.vorige) qc.setQueryData(['voorraad'], c.vorige) },
    onSettled: ververs,
  })

  const toevoegen = useMutation({
    mutationFn: async (naam: string) => {
      const schoon = naam.trim()
      if (!schoon) return
      const { error } = await db.from('voorraad_item').upsert({
        user_id: await huidigeUserId(),
        ingredient_key: ingredientKey(schoon),
        naam: schoon.charAt(0).toUpperCase() + schoon.slice(1),
        categorie: 'Zelf toegevoegd',
        in_huis: true,
      }, { onConflict: 'user_id,ingredient_key' })
      if (error) throw error
    },
    onSuccess: ververs,
  })

  const verwijderen = useMutation({
    mutationFn: async (key: string) => {
      const { error } = await db.from('voorraad_item').delete().eq('ingredient_key', key)
      if (error) throw error
    },
    onSuccess: ververs,
  })

  return { toggle, toevoegen, verwijderen }
}

/* ------------------------------------------------------------ geschiedenis */

export interface WeekGeschiedenis {
  week: string
  gekozen: { recept: Recept; gekooktOp: string | null }[]
}

export function useGeschiedenis() {
  return useQuery({
    queryKey: ['geschiedenis'],
    queryFn: async (): Promise<WeekGeschiedenis[]> => {
      const { data, error } = await db
        .from('weekmenu_gekozen')
        .select('week_start_datum, gekookt_op, recepten(*)')
        .order('week_start_datum', { ascending: false })
      if (error) throw error

      const perWeek = new Map<string, WeekGeschiedenis['gekozen']>()
      for (const rij of data as unknown as {
        week_start_datum: string; gekookt_op: string | null; recepten: Recept
      }[]) {
        if (!rij.recepten) continue
        const lijst = perWeek.get(rij.week_start_datum) ?? []
        lijst.push({ recept: rij.recepten, gekooktOp: rij.gekookt_op })
        perWeek.set(rij.week_start_datum, lijst)
      }
      return [...perWeek].map(([week, gekozen]) => ({ week, gekozen }))
    },
  })
}

/** Markeert een recept als gekookt — of draait dat terug. */
export function useGekooktMarkeren(week = weekStart()) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ receptId, gekookt }: { receptId: string; gekookt: boolean }) => {
      const { error } = await db.from('weekmenu_gekozen')
        .update({ gekookt_op: gekookt ? new Date().toISOString() : null })
        .eq('week_start_datum', week).eq('recept_id', receptId)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sleutels.dezeWeek(week) })
      void qc.invalidateQueries({ queryKey: ['geschiedenis'] })
    },
  })
}

/* ------------------------------------------------- recept zelf toevoegen */

export interface OpslaanInvoer {
  concept: Concept
  bronType: BronType
  deelStatus: DeelStatus
}

/**
 * Slaat een zelf toegevoegd recept op.
 *
 * De harde regel uit plan §7.3 staat als check-constraint op de tabel: een
 * recept met bron_type 'kookboek_foto' kan alleen deel_status 'prive' hebben.
 * We herhalen 'm hier zodat de fout duidelijk is voordat de database 'm geeft.
 */
export function useReceptOpslaan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ concept, bronType, deelStatus }: OpslaanInvoer): Promise<string> => {
      if (bronType === 'kookboek_foto' && deelStatus !== 'prive') {
        throw new Error('Een recept uit een kookboek kan niet gedeeld worden.')
      }

      const userId = await huidigeUserId()
      const { data, error } = await db.from('recepten').insert({
        user_id: userId,
        titel: concept.titel.trim(),
        bron: bronType === 'kookboek_foto' ? 'Kookboek' : 'Eigen recept',
        url: null,
        personen: concept.personen,
        bereidingstijd_minuten: concept.bereidingstijd_minuten ?? null,
        keuken: concept.keuken ?? null,
        tags: concept.tags,
        ingredienten: concept.ingredienten,
        bereiding_nl: concept.bereiding_nl.filter((s) => s.trim()),
        bron_type: bronType,
        deel_status: deelStatus,
        prijs_pp_schatting: schatPrijsPerPersoon(concept),
      }).select('id').single()

      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ontdek'] })
      void qc.invalidateQueries({ queryKey: ['ontdek-telling'] })
      void qc.invalidateQueries({ queryKey: ['mijn-recepten'] })
    },
  })
}

/** Je eigen toegevoegde recepten. */
export function useMijnRecepten() {
  return useQuery({
    queryKey: ['mijn-recepten'],
    queryFn: async (): Promise<Recept[]> => {
      const { data, error } = await db.from('recepten').select('*')
        .neq('bron_type', 'scraper').order('aangemaakt_op', { ascending: false })
      if (error) throw error
      return data as Recept[]
    },
  })
}

/* ------------------------------------------------------ admin: goedkeuren */

export function useIsAdmin() {
  return useQuery({
    queryKey: ['is-admin'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await db.from('gebruiker').select('is_admin').single()
      if (error) return false
      return (data as { is_admin: boolean }).is_admin
    },
  })
}

/** Recepten die op goedkeuring wachten (plan §7.7). Alleen zichtbaar voor een admin. */
export function useAanmeldingen() {
  return useQuery({
    queryKey: ['aanmeldingen'],
    queryFn: async (): Promise<Recept[]> => {
      const { data, error } = await db.from('recepten').select('*')
        .eq('deel_status', 'aangevraagd').order('aangemaakt_op')
      if (error) throw error
      return data as Recept[]
    },
  })
}

export function useBeoordelen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ receptId, goedkeuren }: { receptId: string; goedkeuren: boolean }) => {
      const { error } = await db.from('recepten')
        .update({ deel_status: goedkeuren ? 'goedgekeurd' : 'afgewezen' })
        .eq('id', receptId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['aanmeldingen'] })
      void qc.invalidateQueries({ queryKey: ['ontdek'] })
      void qc.invalidateQueries({ queryKey: ['ontdek-telling'] })
    },
  })
}
