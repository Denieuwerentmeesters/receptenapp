import { useQuery } from '@tanstack/react-query'
import { db } from './db'
import { huidigeUserId } from './auth'

/** Gelijk aan GRATIS_RECEPTEN in api/extraheer.ts; die functie handhaaft het, dit is alleen de weergave. */
export const GRATIS_RECEPTEN = 10

export interface PlusStand {
  /** Gelukte scans tot nu toe (alleen de eigen rijen zijn leesbaar). */
  gebruikt: number
  /** Er loopt een abonnement. */
  plus: boolean
  /** Hoeveel gratis uitlezingen er nog zijn; 0 als de limiet bereikt is. */
  over: number
}

/** Hoeveel van de gratis recepten op zijn, en of Plus loopt. */
export function usePlusStand() {
  return useQuery({
    queryKey: ['plus-stand'],
    queryFn: async (): Promise<PlusStand> => {
      const userId = await huidigeUserId()
      const [scans, abo] = await Promise.all([
        db.from('scan').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('telt_mee', true),
        db.from('abonnement').select('loopt_tot').eq('user_id', userId).maybeSingle(),
      ])
      // Ontbreekt de tabel nog (migratie niet gedraaid), dan nergens blokkeren: de server beslist.
      const gebruikt = scans.error ? 0 : scans.count ?? 0
      const plus = !abo.error && !!abo.data && new Date(abo.data.loopt_tot as string) > new Date()
      return { gebruikt, plus, over: Math.max(0, GRATIS_RECEPTEN - gebruikt) }
    },
    staleTime: 30_000,
  })
}
