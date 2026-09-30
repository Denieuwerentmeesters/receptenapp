import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from './db'
import { huidigeUserId } from './auth'
import { altijdInHuis } from './altijdInHuis'
import { DROGE_KRUIDEN_KEY } from './kruiden'
import { ingredientKey, schaalIngredienten } from './schaal'
import { inVoorraad } from './voorraad'
import { weekStart } from './week'
import type { AhProduct, BoodschapItem, JumboProduct, Recept, Voorkeuren } from './database.types'

export const sleutels = {
  voorkeuren: ['voorkeuren'] as const,
  dezeWeek: (week: string) => ['deze-week', week] as const,
  boodschappen: (week: string) => ['boodschappen', week] as const,
  recept: (id: string) => ['recept', id] as const,
  ahMapping: ['ah-mapping'] as const,
  jumboMapping: ['jumbo-mapping'] as const,
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
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sleutels.voorkeuren })
      // Een leeg weekmenu wacht misschien op deze voorkeuren: opnieuw ophalen
      // laat de generator nog een keer lopen.
      void qc.invalidateQueries({ queryKey: ['deze-week'] })
    },
  })
}

/* --------------------------------------------------------------- deze week */

/**
 * Een recept zoals het in "Deze week" staat: uit de tien suggesties van de
 * generator, of zelf toegevoegd via Ontdekken of Favorieten.
 */
export interface WeekRecept extends Recept {
  /** Plek in de suggesties; null als je het recept ergens anders vandaan haalde. */
  positie: number | null
  gekozen: boolean
  /** Hoe vaak je het deze week maakt — "wil je deze 2x?". */
  aantal: number
  /** Staat nog op de boodschappenlijst: de gele rand. */
  opLijst: boolean
  gekooktOp: string | null
}

export function useDezeWeek(week = weekStart()) {
  return useQuery({
    queryKey: sleutels.dezeWeek(week),
    queryFn: async (): Promise<WeekRecept[]> => {
      const id = await userId()

      // De generator is idempotent: bestaat de week al, dan doet 'ie niets.
      // Zo staat er ook een menu klaar als de cron nog niet gedraaid heeft.
      // Faalt de generator, dan willen we dat zien: stil doorlopen gaf een
      // leeg weekmenu zonder uitleg.
      const generator = await db.rpc('genereer_weekmenu', { p_user_id: id, p_week_start: week })
      if (generator.error) throw generator.error

      const [getoond, gekozen] = await Promise.all([
        db
          .from('weekmenu_getoond')
          .select('positie, recept_id, verborgen_op, recepten(*)')
          .eq('week_start_datum', week)
          .order('positie'),
        db
          .from('weekmenu_gekozen')
          .select('recept_id, aantal, van_lijst_op, gekookt_op, gekozen_op, recepten(*)')
          .eq('week_start_datum', week)
          .order('gekozen_op'),
      ])
      if (getoond.error) throw getoond.error
      if (gekozen.error) throw gekozen.error

      const keuzes = new Map(
        (gekozen.data as unknown as {
          recept_id: string; aantal: number; van_lijst_op: string | null
          gekookt_op: string | null; recepten: Recept
        }[]).map((g) => [g.recept_id, g]),
      )
      const metKeuze = (recept: Recept, positie: number | null): WeekRecept => {
        const keuze = keuzes.get(recept.id)
        return {
          ...recept,
          positie,
          gekozen: Boolean(keuze),
          aantal: keuze?.aantal ?? 0,
          opLijst: Boolean(keuze) && !keuze?.van_lijst_op,
          gekooktOp: keuze?.gekookt_op ?? null,
        }
      }

      // Weggeklikte suggesties tellen niet mee — tenzij je ze toch koos.
      const suggesties = (getoond.data as unknown as {
        positie: number; verborgen_op: string | null; recepten: Recept
      }[])
        .filter((rij) => rij.recepten && (!rij.verborgen_op || keuzes.has(rij.recepten.id)))
        .map((rij) => metKeuze(rij.recepten, rij.positie))
      const inSuggesties = new Set(suggesties.map((r) => r.id))

      // Wat je zelf toevoegde komt bovenaan: dat heb je bewust gekozen.
      const zelfGekozen = [...keuzes.values()]
        .filter((g) => g.recepten && !inSuggesties.has(g.recept_id))
        .map((g) => metKeuze(g.recepten, null))

      return [...zelfGekozen, ...suggesties]
    },
  })
}

/** Een recept-id, of een id met de vlag dat de app het koos ("Vul mijn week"). */
export type OpLijstInvoer = string | { receptId: string; automatisch: boolean }

function leesInvoer(invoer: OpLijstInvoer) {
  return typeof invoer === 'string' ? { receptId: invoer, automatisch: false } : invoer
}

/**
 * Een recept op de lijst zetten, en er weer af halen.
 *
 * De boodschappenlijst krijgt één rij per ingrediënt per recept; het
 * samenvoegen gebeurt pas bij het tonen (lib/lijst.ts). Daardoor kan een
 * recept er weer af zonder dat de hoeveelheden van een ander recept meegaan.
 */
export function useLijstActies(week = weekStart()) {
  const qc = useQueryClient()
  const ververs = () => {
    void qc.invalidateQueries({ queryKey: sleutels.dezeWeek(week) })
    void qc.invalidateQueries({ queryKey: sleutels.boodschappen(week) })
    void qc.invalidateQueries({ queryKey: ['geschiedenis'] })
  }
  const pasAan = (receptId: string, wijziging: Partial<WeekRecept>) => {
    qc.setQueryData<WeekRecept[]>(sleutels.dezeWeek(week), (oud) =>
      oud?.map((r) => (r.id === receptId ? { ...r, ...wijziging } : r)))
  }

  const zetOpLijst = useMutation({
    mutationFn: async (wat: OpLijstInvoer) => {
      const { receptId, automatisch } = leesInvoer(wat)
      const id = await userId()

      const [recept, voorkeuren, voorraad, keuze] = await Promise.all([
        db.from('recepten').select('*').eq('id', receptId).single(),
        db.from('gebruiker_voorkeuren').select('aantal_personen').single(),
        db.from('voorraad_item').select('ingredient_key').eq('in_huis', true),
        db.from('weekmenu_gekozen').select('aantal, van_lijst_op')
          .eq('week_start_datum', week).eq('recept_id', receptId).maybeSingle(),
      ])
      if (recept.error) throw recept.error
      if (keuze.error) throw keuze.error

      // Nog niet gekozen: nieuw. Staat al op de lijst: nog een keer (2x).
      // Al gekocht of gewist: opnieuw op de lijst, vanaf één keer.
      const bestaand = keuze.data as { aantal: number; van_lijst_op: string | null } | null
      const { error } = !bestaand
        ? await db.from('weekmenu_gekozen')
          .insert({
            user_id: id, week_start_datum: week, recept_id: receptId, aantal: 1,
            ...(automatisch ? { automatisch: true } : {}),
          })
        : await db.from('weekmenu_gekozen')
          .update(bestaand.van_lijst_op
            ? { aantal: 1, van_lijst_op: null }
            : { aantal: Math.min(9, bestaand.aantal + 1) })
          .eq('week_start_datum', week).eq('recept_id', receptId)
      if (error) throw error

      const r = recept.data as Recept
      const personen = voorkeuren.data?.aantal_personen ?? 4
      // Wat in je voorraadkast staat hoeft niet op de lijst (design "Voorraadkast").
      // Droge kruiden wel: die blijven staan, ze gaan alleen niet naar het mandje.
      const inHuis = new Set(
        (voorraad.data as { ingredient_key: string }[] | null ?? [])
          .map((v) => v.ingredient_key)
          .filter((key) => key !== DROGE_KRUIDEN_KEY),
      )

      const rijen = schaalIngredienten(r.ingredienten, r.personen, personen)
        .map((ing) => ({ ing, key: ingredientKey(ing.naam) }))
        .filter(({ key }) => key && !inVoorraad(key, inHuis) && !altijdInHuis(key))
        .map(({ ing, key }) => ({
          user_id: id,
          week_start_datum: week,
          naam: ing.naam,
          ingredient_key: key,
          hoeveelheid: ing.geschaald,
          eenheid: ing.eenheid,
          categorie: null,
          bron_type: 'recept' as const,
          bron_recept_id: r.id,
          is_afgevinkt: false,
        }))
      if (rijen.length === 0) return
      const invoer = await db.from('boodschappenlijst_item').insert(rijen)
      if (invoer.error) throw invoer.error
    },
    onMutate: async (wat) => {
      const { receptId } = leesInvoer(wat)
      await qc.cancelQueries({ queryKey: sleutels.dezeWeek(week) })
      const vorige = qc.getQueryData<WeekRecept[]>(sleutels.dezeWeek(week))
      const nu = vorige?.find((r) => r.id === receptId)
      pasAan(receptId, {
        gekozen: true, opLijst: true,
        aantal: nu?.opLijst ? Math.min(9, nu.aantal + 1) : 1,
      })
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.dezeWeek(week), context.vorige)
    },
    onSettled: ververs,
  })

  /**
   * Haalt de ingrediënten van een recept van de lijst. Het recept blijft in je
   * week staan ("In je week"): een suggestie wordt weer een gewone suggestie,
   * iets wat je zelf toevoegde blijft een keuze die niet op de lijst staat.
   * Helemaal weg uit je week is haalUitWeek.
   */
  const haalVanLijst = useMutation({
    mutationFn: async (receptId: string) => {
      const items = await db.from('boodschappenlijst_item').delete()
        .eq('week_start_datum', week).eq('bron_recept_id', receptId)
      if (items.error) throw items.error
      const suggestie = await db.from('weekmenu_getoond').select('id')
        .eq('week_start_datum', week).eq('recept_id', receptId)
      if (suggestie.error) throw suggestie.error
      const keuze = db.from('weekmenu_gekozen')
      const { error } = (suggestie.data ?? []).length > 0
        ? await keuze.delete().eq('week_start_datum', week).eq('recept_id', receptId)
        : await keuze.update({ aantal: 1, van_lijst_op: new Date().toISOString() })
          .eq('week_start_datum', week).eq('recept_id', receptId)
      if (error) throw error
    },
    onMutate: async (receptId) => {
      await qc.cancelQueries({ queryKey: sleutels.dezeWeek(week) })
      const vorige = qc.getQueryData<WeekRecept[]>(sleutels.dezeWeek(week))
      qc.setQueryData<WeekRecept[]>(sleutels.dezeWeek(week), (oud) => oud?.map((r) => (r.id === receptId
        ? { ...r, gekozen: r.positie === null, opLijst: false, aantal: r.positie === null ? 1 : 0 }
        : r)))
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.dezeWeek(week), context.vorige)
    },
    onSettled: ververs,
  })

  /**
   * Zet een recept in je week zonder het op de lijst te zetten — het hartje in
   * Ontdekken. Was het een weggeklikte suggestie, dan komt die gewoon terug.
   * Anders wordt het een keuze die (nog) niet op de lijst staat; daarvoor
   * gebruiken we van_lijst_op, zodat "op de lijst" daarna precies zo werkt
   * als na een boodschappenronde.
   */
  const zetInWeek = useMutation({
    mutationFn: async (recept: Recept) => {
      const terug = await db.from('weekmenu_getoond').update({ verborgen_op: null })
        .eq('week_start_datum', week).eq('recept_id', recept.id).select('id')
      if (terug.error) throw terug.error
      if ((terug.data ?? []).length > 0) return

      const { error } = await db.from('weekmenu_gekozen').upsert({
        user_id: await userId(),
        week_start_datum: week,
        recept_id: recept.id,
        aantal: 1,
        van_lijst_op: new Date().toISOString(),
      }, { onConflict: 'user_id,week_start_datum,recept_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onMutate: async (recept) => {
      await qc.cancelQueries({ queryKey: sleutels.dezeWeek(week) })
      const vorige = qc.getQueryData<WeekRecept[]>(sleutels.dezeWeek(week))
      if (vorige && !vorige.some((r) => r.id === recept.id)) {
        qc.setQueryData<WeekRecept[]>(sleutels.dezeWeek(week), [{
          ...recept, positie: null, gekozen: true, aantal: 1, opLijst: false, gekooktOp: null,
        }, ...vorige])
      }
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.dezeWeek(week), context.vorige)
    },
    onSettled: ververs,
  })

  /**
   * Haalt een recept helemaal uit je week — het kruisje. De ingrediënten gaan
   * van de lijst, een eigen keuze verdwijnt, een suggestie wordt verborgen.
   * Bij ruilen onthoudt de suggestie wanneer dat gebeurde.
   */
  const haalUitWeek = useMutation({
    mutationFn: async (invoer: string | { receptId: string; geruild: boolean }) => {
      const { receptId, geruild } = typeof invoer === 'string' ? { receptId: invoer, geruild: false } : invoer
      const items = await db.from('boodschappenlijst_item').delete()
        .eq('week_start_datum', week).eq('bron_recept_id', receptId)
      if (items.error) throw items.error
      const keuze = await db.from('weekmenu_gekozen').delete()
        .eq('week_start_datum', week).eq('recept_id', receptId)
      if (keuze.error) throw keuze.error
      const nu = new Date().toISOString()
      const { error } = await db.from('weekmenu_getoond')
        .update(geruild ? { verborgen_op: nu, geruild_op: nu } : { verborgen_op: nu })
        .eq('week_start_datum', week).eq('recept_id', receptId)
      if (error) throw error
    },
    onMutate: async (invoer) => {
      const receptId = typeof invoer === 'string' ? invoer : invoer.receptId
      await qc.cancelQueries({ queryKey: sleutels.dezeWeek(week) })
      const vorige = qc.getQueryData<WeekRecept[]>(sleutels.dezeWeek(week))
      qc.setQueryData<WeekRecept[]>(sleutels.dezeWeek(week), (oud) => oud?.filter((r) => r.id !== receptId))
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.dezeWeek(week), context.vorige)
    },
    onSettled: ververs,
  })

  return { zetOpLijst, haalVanLijst, zetInWeek, haalUitWeek }
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
        .order('naam')
      if (error) throw error
      // Oudere lijsten kunnen nog "peper en zout" of "water" bevatten van
      // vóór lib/altijdInHuis.ts; die laten we niet meer zien. Wat je zelf
      // toevoegde wel: is het zout op, dan wil je het ook op je lijst.
      return (data as BoodschapItem[])
        .filter((i) => i.bron_type === 'extra' || !altijdInHuis(i.ingredient_key))
    },
  })
}

/**
 * Mutaties op de lijst. Afvinken en verwijderen werken op de rij-id's achter
 * één samengevoegde regel (lib/lijst.ts): "400 g tomaten" kan uit twee
 * recepten komen, en afvinken moet ze allebei raken.
 */
export function useBoodschapMuteren(week = weekStart()) {
  const qc = useQueryClient()
  const ververs = () => {
    void qc.invalidateQueries({ queryKey: sleutels.boodschappen(week) })
    void qc.invalidateQueries({ queryKey: sleutels.dezeWeek(week) })
  }

  const afvinken = useMutation({
    mutationFn: async ({ itemIds, afgevinkt }: { itemIds: string[]; afgevinkt: boolean }) => {
      const { error } = await db.from('boodschappenlijst_item')
        .update({ is_afgevinkt: afgevinkt }).in('id', itemIds)
      if (error) throw error
    },
    // Afvinken moet werken in de kelder van de Lidl: eerst de UI, dan de server.
    onMutate: async ({ itemIds, afgevinkt }) => {
      await qc.cancelQueries({ queryKey: sleutels.boodschappen(week) })
      const vorige = qc.getQueryData<BoodschapItem[]>(sleutels.boodschappen(week))
      const ids = new Set(itemIds)
      qc.setQueryData<BoodschapItem[]>(sleutels.boodschappen(week), (oud) =>
        oud?.map((i) => (ids.has(i.id) ? { ...i, is_afgevinkt: afgevinkt } : i)))
      return { vorige }
    },
    onError: (_e, _v, context) => {
      if (context?.vorige) qc.setQueryData(sleutels.boodschappen(week), context.vorige)
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: sleutels.boodschappen(week) }) },
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
    mutationFn: async (itemIds: string[]) => {
      const { error } = await db.from('boodschappenlijst_item').delete().in('id', itemIds)
      if (error) throw error
    },
    onSuccess: ververs,
  })

  /**
   * Haalt gekochte of doorgestuurde producten van de lijst. Een recept waar
   * daarna niets meer van op de lijst staat, gaat er ook af — het verliest de
   * gele rand in "Deze week", maar blijft gekozen, want je moet het nog koken.
   * Een recept met een product dat AH niet had, blijft dus op de lijst staan.
   */
  const opruimen = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (itemIds.length > 0) {
        // Wat via de "Op"-knop uit de voorraadkast kwam, is nu gekocht: weer in huis.
        const aanvulling = await db.from('boodschappenlijst_item').select('ingredient_key')
          .in('id', itemIds).eq('voorraad_aanvulling', true)
        if (aanvulling.error) throw aanvulling.error
        const { error } = await db.from('boodschappenlijst_item').delete().in('id', itemIds)
        if (error) throw error
        const keys = [...new Set((aanvulling.data as { ingredient_key: string }[]).map((r) => r.ingredient_key))]
        if (keys.length > 0) {
          const terug = await db.from('voorraad_item')
            .update({ in_huis: true, bijgewerkt_op: new Date().toISOString() })
            .in('ingredient_key', keys)
          if (terug.error) throw terug.error
        }
      }
      const over = await db.from('boodschappenlijst_item').select('bron_recept_id, ingredient_key')
        .eq('week_start_datum', week).not('bron_recept_id', 'is', null)
      if (over.error) throw over.error
      // Een onzichtbare "peper en zout" mag een recept niet op de lijst houden.
      const nogOpLijst = [...new Set(
        (over.data as { bron_recept_id: string; ingredient_key: string }[])
          .filter((r) => !altijdInHuis(r.ingredient_key))
          .map((r) => r.bron_recept_id),
      )]

      let vraag = db.from('weekmenu_gekozen')
        .update({ van_lijst_op: new Date().toISOString() })
        .eq('week_start_datum', week).is('van_lijst_op', null)
      if (nogOpLijst.length > 0) vraag = vraag.not('recept_id', 'in', `(${nogOpLijst.join(',')})`)
      const { error } = await vraag
      if (error) throw error
    },
    onSuccess: () => {
      ververs()
      void qc.invalidateQueries({ queryKey: ['voorraad'] })
    },
  })

  /** "Alles wissen": de lijst leeg, alle recepten eraf. */
  const allesWissen = useMutation({
    mutationFn: async () => {
      const items = await db.from('boodschappenlijst_item').delete().eq('week_start_datum', week)
      if (items.error) throw items.error
      const { error } = await db.from('weekmenu_gekozen')
        .update({ van_lijst_op: new Date().toISOString() })
        .eq('week_start_datum', week).is('van_lijst_op', null)
      if (error) throw error
    },
    onSuccess: ververs,
  })

  return { afvinken, toevoegen, verwijderen, opruimen, allesWissen }
}

/* ------------------------------------------------------------ AH-mapping */

/**
 * Let op: geen Map als querydata. De cache wordt naar localStorage geschreven
 * en een Map overleeft JSON.stringify niet — die komt terug als leeg object,
 * waarna `.has()` niet meer bestaat. Een gewoon object wél.
 */
export function useAhMapping(aan = true) {
  return useQuery({
    queryKey: sleutels.ahMapping,
    enabled: aan,
    // De mapping verandert hooguit als het script draait; een uur cache is ruim.
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Record<string, AhProduct>> => {
      const { data, error } = await db.from('ah_product_cache').select('*')
      if (error) throw error
      return Object.fromEntries((data as AhProduct[]).map((p) => [p.ingredient_key, p]))
    },
  })
}

/** Zelfde vorm als de AH-mapping; alleen opgehaald als Jumbo je winkel is. */
export function useJumboMapping(aan: boolean) {
  return useQuery({
    queryKey: sleutels.jumboMapping,
    enabled: aan,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Record<string, JumboProduct>> => {
      const { data, error } = await db.from('jumbo_product_cache').select('*')
      if (error) throw error
      return Object.fromEntries((data as JumboProduct[]).map((p) => [p.ingredient_key, p]))
    },
  })
}
