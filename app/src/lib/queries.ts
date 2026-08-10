import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from './db'
import { huidigeUserId } from './auth'
import { ingredientKey, schaalIngredienten } from './schaal'
import { weekStart } from './week'
import type { AhProduct, BoodschapItem, Recept, Voorkeuren } from './database.types'

export const sleutels = {
  voorkeuren: ['voorkeuren'] as const,
  weekmenu: (week: string) => ['weekmenu', week] as const,
  gekozen: (week: string) => ['gekozen', week] as const,
  boodschappen: (week: string) => ['boodschappen', week] as const,
  recept: (id: string) => ['recept', id] as const,
  ahMapping: ['ah-mapping'] as const,
}

const userId = huidigeUserId

/* -------------------------------------------------------------- voorkeuren */

export function useVoorkeuren() {
  return useQuery({
    queryKey: sleutels.voorkeuren,
    queryFn: async (): Promise<Voorkeuren> => {
      const { data, error } = await db
        .from('gebruiker_voorkeuren').select('*').single()
      if (error) throw error
      return data as Voorkeuren
    },
  })
}

export function useVoorkeurenOpslaan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (wijziging: Partial<Voorkeuren>) => {
      const { error } = await db
        .from('gebruiker_voorkeuren')
        .update({ ...wijziging, bijgewerkt_op: new Date().toISOString() })
        .eq('user_id', await userId())
      if (error) throw error
    },
    // Optimistisch: instellingen moeten direct reageren, ook op een trage verbinding.
    onMutate: async (wijziging) => {
      await qc.cancelQueries({ queryKey: sleutels.voorkeuren })
      const vorige = qc.getQueryData<Voorkeuren>(sleutels.voorkeuren)
      if (vorige) qc.setQueryData(sleutels.voorkeuren, { ...vorige, ...wijziging })
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.voorkeuren, context.vorige)
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: sleutels.voorkeuren }) },
  })
}

/* ---------------------------------------------------------------- weekmenu */

export interface WeekmenuRecept extends Recept {
  positie: number
  gekozen: boolean
}

export function useWeekmenu(week = weekStart()) {
  return useQuery({
    queryKey: sleutels.weekmenu(week),
    queryFn: async (): Promise<WeekmenuRecept[]> => {
      const id = await userId()

      // De generator is idempotent: bestaat de week al, dan doet 'ie niets.
      // Zo staat er ook een menu klaar als de cron nog niet gedraaid heeft.
      await db.rpc('genereer_weekmenu', { p_user_id: id, p_week_start: week })

      const [getoond, gekozen] = await Promise.all([
        db
          .from('weekmenu_getoond')
          .select('positie, recept_id, recepten(*)')
          .eq('week_start_datum', week)
          .order('positie'),
        db
          .from('weekmenu_gekozen')
          .select('recept_id')
          .eq('week_start_datum', week),
      ])
      if (getoond.error) throw getoond.error
      if (gekozen.error) throw gekozen.error

      const gekozenIds = new Set(gekozen.data.map((g) => g.recept_id))
      return (getoond.data as unknown as { positie: number; recept_id: string; recepten: Recept }[])
        .filter((rij) => rij.recepten)
        .map((rij) => ({
          ...rij.recepten,
          positie: rij.positie,
          gekozen: gekozenIds.has(rij.recept_id),
        }))
    },
  })
}

export function useKiesRecept(week = weekStart()) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ receptId, kiezen }: { receptId: string; kiezen: boolean }) => {
      const id = await userId()
      if (kiezen) {
        const { error } = await db.from('weekmenu_gekozen')
          .insert({ user_id: id, week_start_datum: week, recept_id: receptId })
        if (error) throw error
      } else {
        const { error } = await db.from('weekmenu_gekozen').delete()
          .eq('week_start_datum', week).eq('recept_id', receptId)
        if (error) throw error
      }
    },
    onMutate: async ({ receptId, kiezen }) => {
      await qc.cancelQueries({ queryKey: sleutels.weekmenu(week) })
      const vorige = qc.getQueryData<WeekmenuRecept[]>(sleutels.weekmenu(week))
      qc.setQueryData<WeekmenuRecept[]>(sleutels.weekmenu(week), (oud) =>
        oud?.map((r) => (r.id === receptId ? { ...r, gekozen: kiezen } : r)))
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.weekmenu(week), context.vorige)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sleutels.weekmenu(week) })
      void qc.invalidateQueries({ queryKey: sleutels.boodschappen(week) })
    },
  })
}

/* ------------------------------------------------------------------ recept */

export function useRecept(id: string | undefined) {
  return useQuery({
    queryKey: sleutels.recept(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<Recept> => {
      const { data, error } = await db.from('recepten').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Recept
    },
  })
}

/* ---------------------------------------------------------- boodschappen */

export function useBoodschappen(week = weekStart()) {
  return useQuery({
    queryKey: sleutels.boodschappen(week),
    queryFn: async (): Promise<BoodschapItem[]> => {
      const { data, error } = await db
        .from('boodschappenlijst_item').select('*')
        .eq('week_start_datum', week)
        .order('categorie', { nullsFirst: false })
        .order('naam')
      if (error) throw error
      return data as BoodschapItem[]
    },
  })
}

/**
 * Zet de ingrediënten van de gekozen recepten op de lijst: geschaald naar het
 * ingestelde aantal personen, samengevoegd op ingredient_key, en zonder de
 * items die je al hebt afgevinkt of zelf toevoegde.
 */
export function useLijstSamenstellen(week = weekStart()) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const id = await userId()

      const [voorkeuren, gekozen, bestaand, voorraad] = await Promise.all([
        db.from('gebruiker_voorkeuren').select('aantal_personen').single(),
        db.from('weekmenu_gekozen').select('recept_id, recepten(*)').eq('week_start_datum', week),
        db.from('boodschappenlijst_item').select('ingredient_key, bron_type')
          .eq('week_start_datum', week),
        db.from('voorraad_item').select('ingredient_key').eq('in_huis', true),
      ])
      if (gekozen.error) throw gekozen.error
      if (bestaand.error) throw bestaand.error

      const personen = voorkeuren.data?.aantal_personen ?? 4
      const alBekend = new Set(bestaand.data.map((b) => b.ingredient_key))
      // Wat in je voorraadkast staat hoeft niet op de lijst (design "Voorraadkast").
      const inHuis = new Set(
        (voorraad.data as { ingredient_key: string }[] | null ?? []).map((v) => v.ingredient_key),
      )

      // Samenvoegen over recepten heen: dezelfde sleutel telt op.
      const samengevoegd = new Map<string, Omit<BoodschapItem, 'id' | 'aangemaakt_op'>>()

      for (const rij of gekozen.data as unknown as { recepten: Recept }[]) {
        const recept = rij.recepten
        if (!recept) continue

        for (const ing of schaalIngredienten(recept.ingredienten, recept.personen, personen)) {
          const key = ingredientKey(ing.naam)
          if (!key || alBekend.has(key) || inHuis.has(key)) continue

          const bestaandeRegel = samengevoegd.get(key)
          if (bestaandeRegel) {
            // Optellen kan alleen als de eenheden gelijk zijn; anders laten we de
            // eerste staan en verliezen we geen informatie door te forceren.
            if (bestaandeRegel.eenheid === ing.eenheid && bestaandeRegel.hoeveelheid !== null && ing.geschaald !== null) {
              bestaandeRegel.hoeveelheid += ing.geschaald
            }
            continue
          }

          samengevoegd.set(key, {
            user_id: id,
            week_start_datum: week,
            naam: ing.naam,
            ingredient_key: key,
            hoeveelheid: ing.geschaald,
            eenheid: ing.eenheid,
            categorie: null,
            bron_type: 'recept',
            bron_recept_id: recept.id,
            is_afgevinkt: false,
          })
        }
      }

      if (samengevoegd.size === 0) return 0
      const { error } = await db.from('boodschappenlijst_item').insert([...samengevoegd.values()])
      if (error) throw error
      return samengevoegd.size
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: sleutels.boodschappen(week) }) },
  })
}

export function useBoodschapMuteren(week = weekStart()) {
  const qc = useQueryClient()
  const ververs = () => { void qc.invalidateQueries({ queryKey: sleutels.boodschappen(week) }) }

  const afvinken = useMutation({
    mutationFn: async ({ itemId, afgevinkt }: { itemId: string; afgevinkt: boolean }) => {
      const { error } = await db.from('boodschappenlijst_item')
        .update({ is_afgevinkt: afgevinkt }).eq('id', itemId)
      if (error) throw error
    },
    // Afvinken moet werken in de kelder van de Lidl: eerst de UI, dan de server.
    onMutate: async ({ itemId, afgevinkt }) => {
      await qc.cancelQueries({ queryKey: sleutels.boodschappen(week) })
      const vorige = qc.getQueryData<BoodschapItem[]>(sleutels.boodschappen(week))
      qc.setQueryData<BoodschapItem[]>(sleutels.boodschappen(week), (oud) =>
        oud?.map((i) => (i.id === itemId ? { ...i, is_afgevinkt: afgevinkt } : i)))
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.boodschappen(week), context.vorige)
    },
    onSettled: ververs,
  })

  const toevoegen = useMutation({
    mutationFn: async (naam: string) => {
      const schoon = naam.trim()
      if (!schoon) return
      const { error } = await db.from('boodschappenlijst_item').insert({
        user_id: await userId(),
        week_start_datum: week,
        naam: schoon.charAt(0).toUpperCase() + schoon.slice(1),
        ingredient_key: ingredientKey(schoon),
        hoeveelheid: null,
        eenheid: null,
        categorie: 'Zelf toegevoegd',
        bron_type: 'extra',
        bron_recept_id: null,
        is_afgevinkt: false,
      })
      if (error) throw error
    },
    onSuccess: ververs,
  })

  const verwijderen = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await db.from('boodschappenlijst_item').delete().eq('id', itemId)
      if (error) throw error
    },
    onSuccess: ververs,
  })

  return { afvinken, toevoegen, verwijderen }
}

/* ------------------------------------------------------------ AH-mapping */

/**
 * Let op: geen Map als querydata. De cache wordt naar localStorage geschreven
 * en een Map overleeft JSON.stringify niet — die komt terug als leeg object,
 * waarna `.has()` niet meer bestaat. Een gewoon object wél.
 */
export function useAhMapping() {
  return useQuery({
    queryKey: sleutels.ahMapping,
    // De mapping verandert hooguit als het script draait; een uur cache is ruim.
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Record<string, AhProduct>> => {
      const { data, error } = await db.from('ah_product_cache').select('*')
      if (error) throw error
      return Object.fromEntries((data as AhProduct[]).map((p) => [p.ingredient_key, p]))
    },
  })
}
