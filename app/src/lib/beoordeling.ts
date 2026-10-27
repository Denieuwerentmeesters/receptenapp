import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from './db'
import { huidigeUserId } from './auth'

/**
 * Cijfer en notitie na het koken. Eén rij per keer koken (tabel `beoordeling`);
 * het laatste cijfer per recept telt. Alleen de kok beoordeelt, en de rijen
 * blijven persoonlijk: ze delen niet mee met een huishouden.
 *
 * - 8 of hoger: jouw favoriet, kortere cooldown in de generator.
 * - 6 of 7: niets bijzonders.
 * - 5 of lager: uit de suggesties en uit Vul mijn week.
 * - Leeg: als gekookt bewaard, verder niets. Nooit stiekem een 6.
 */

export interface Beoordeling {
  id: string
  recept_id: string
  cijfer: number | null
  notitie: string | null
  gekookt_op: string
  aangemaakt_op: string
}

export const FAVORIET_VANAF = 8
export const LAAG_TOT = 5
/** Het gemiddelde van alle koks zegt pas iets vanaf ongeveer zoveel cijfers. */
export const GEMIDDELDE_VANAF_AANTAL = 20

export const isFavorietCijfer = (cijfer: number | null | undefined) => cijfer != null && cijfer >= FAVORIET_VANAF
export const isLaagCijfer = (cijfer: number | null | undefined) => cijfer != null && cijfer <= LAAG_TOT

/** Eén regel bij het gekozen cijfer: wat het betekent. */
export function cijferBetekenis(cijfer: number): string {
  if (cijfer >= 9) return 'Geweldig, dit komt vaak terug'
  if (cijfer === 8) return 'Heel lekker, dit komt terug'
  if (cijfer >= 6) return 'Prima, niets bijzonders'
  return 'Niet lekker, dit zie je niet meer'
}

/** "8,4" — met komma, zoals in de rest van de app. */
export const cijferTekst = (cijfer: number) => String(Math.round(cijfer * 10) / 10).replace('.', ',')

/**
 * Het laatste beoordeelde moment per recept: voor het cijfer telt de laatste rij
 * met een cijfer, voor de notitie de laatste rij met een notitie. `rijen` mag in
 * elke volgorde staan.
 */
export interface LaatsteBeoordeling {
  cijfer: number | null
  notitie: string | null
}

export function laatstePerRecept(rijen: readonly Beoordeling[]): Map<string, LaatsteBeoordeling> {
  const nieuwsteEerst = [...rijen].sort((a, b) => b.aangemaakt_op.localeCompare(a.aangemaakt_op))
  const uit = new Map<string, LaatsteBeoordeling>()
  for (const r of nieuwsteEerst) {
    const nu = uit.get(r.recept_id) ?? { cijfer: null, notitie: null }
    uit.set(r.recept_id, {
      cijfer: nu.cijfer ?? r.cijfer,
      notitie: nu.notitie ?? (r.notitie?.trim() ? r.notitie.trim() : null),
    })
  }
  return uit
}

/** Het gemiddelde van alle koks, alleen als er genoeg cijfers zijn om iets te zeggen. */
export function gemiddeldeOpKaart(
  recept: { cijfer_gemiddeld?: number | string | null; cijfer_aantal?: number | null },
): { gemiddeld: number; aantal: number } | null {
  const aantal = recept.cijfer_aantal ?? 0
  const gem = recept.cijfer_gemiddeld == null ? null : Number(recept.cijfer_gemiddeld)
  if (gem == null || Number.isNaN(gem) || aantal < GEMIDDELDE_VANAF_AANTAL) return null
  return { gemiddeld: gem, aantal }
}

/* ----------------------------------------------------------------- queries */

/** Recepten met een laatste cijfer van 5 of lager: die vallen af in de suggesties en Vul mijn week. */
export function laagBeoordeeld(perRecept: ReadonlyMap<string, LaatsteBeoordeling>): Set<string> {
  return new Set([...perRecept].filter(([, b]) => isLaagCijfer(b.cijfer)).map(([id]) => id))
}

const SLEUTEL = ['beoordelingen']

export function useBeoordelingen() {
  const query = useQuery({
    queryKey: SLEUTEL,
    queryFn: async (): Promise<Beoordeling[]> => {
      const { data, error } = await db.from('beoordeling')
        .select('id, recept_id, cijfer, notitie, gekookt_op, aangemaakt_op')
        .order('aangemaakt_op', { ascending: false })
      if (error) throw error
      return data as Beoordeling[]
    },
  })
  const perRecept = useMemo(() => laatstePerRecept(query.data ?? []), [query.data])
  return { ...query, perRecept }
}

export interface BeoordelingInvoer {
  receptId: string
  cijfer: number | null
  notitie: string
  /** De dag waarop je kookte (jjjj-mm-dd), voor een cijfer achteraf; anders vandaag. */
  gekooktOp?: string
}

export function useBeoordelingBewaren() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ receptId, cijfer, notitie, gekooktOp }: BeoordelingInvoer) => {
      const tekst = notitie.trim()
      // Zonder cijfer en zonder notitie valt er niets te bewaren: het recept staat al op gekookt.
      if (cijfer == null && !tekst) return
      const { error } = await db.from('beoordeling').insert({
        user_id: await huidigeUserId(),
        recept_id: receptId,
        cijfer,
        notitie: tekst || null,
        ...(gekooktOp ? { gekookt_op: gekooktOp } : {}),
      })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: SLEUTEL })
      // Het gemiddelde op de kaarten en de suggesties veranderen mee.
      void qc.invalidateQueries({ queryKey: ['ontdek'] })
    },
  })
}

/**
 * "Zet terug": een recept dat je een 5 of lager gaf komt weer in de suggesties.
 * Het lage cijfer gaat weg; een notitie die erbij stond blijft staan.
 */
export function useLaagCijferWissen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (receptId: string) => {
      const weg = await db.from('beoordeling').delete()
        .eq('recept_id', receptId).lte('cijfer', LAAG_TOT).is('notitie', null)
      if (weg.error) throw weg.error
      const leeg = await db.from('beoordeling').update({ cijfer: null })
        .eq('recept_id', receptId).lte('cijfer', LAAG_TOT)
      if (leeg.error) throw leeg.error
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: SLEUTEL }) },
  })
}
