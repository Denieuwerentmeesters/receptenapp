import { useQuery } from '@tanstack/react-query'
import { db } from './db'
import { huidigeUserId } from './auth'

/** Gelijk aan GRATIS_RECEPTEN in lib/plus.ts; die functie handhaaft het, dit is alleen de weergave. */
export const GRATIS_RECEPTEN = 5

export interface PlusStand {
  /** Recepten die AI voor je maakte: gelukte uitleesacties plus de gerechten van gelukte menu's. */
  gebruikt: number
  /** Er loopt een abonnement. */
  plus: boolean
  /** Tot wanneer het abonnement loopt, ook als het is opgezegd; null zonder abonnement. */
  tot: Date | null
  /** Hoeveel gratis uitlezingen er nog zijn; 0 als de limiet bereikt is. */
  over: number
}

/** Hoeveel van de gratis recepten op zijn, en of Plus loopt. */
export function usePlusStand() {
  return useQuery({
    queryKey: ['plus-stand'],
    queryFn: async (): Promise<PlusStand> => {
      const userId = await huidigeUserId()
      const [scans, menus, abo] = await Promise.all([
        db.from('scan').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('telt_mee', true),
        db.from('samenstelling').select('antwoord').eq('user_id', userId).eq('soort', 'nieuw'),
        db.from('abonnement').select('loopt_tot').eq('user_id', userId).maybeSingle(),
      ])
      // Ontbreekt de tabel nog (migratie niet gedraaid), dan nergens blokkeren: de server beslist.
      const uitgelezen = scans.error ? 0 : scans.count ?? 0
      const samengesteld = menus.error ? 0 : (menus.data ?? []).reduce((som, m) => {
        const gerechten = (m.antwoord as { gerechten?: unknown } | null)?.gerechten
        return som + (Array.isArray(gerechten) ? gerechten.length : 0)
      }, 0)
      const gebruikt = uitgelezen + samengesteld
      const tot = !abo.error && abo.data ? new Date(abo.data.loopt_tot as string) : null
      const plus = !!tot && tot > new Date()
      return { gebruikt, plus, tot: plus ? tot : null, over: Math.max(0, GRATIS_RECEPTEN - gebruikt) }
    },
    staleTime: 30_000,
  })
}
