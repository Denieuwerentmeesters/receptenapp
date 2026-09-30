import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { db } from './db'
import { useVoorkeuren } from './queries'
import { canoniek } from './synoniemen'
import { isoDatum, type BonusActie, type BonusMap } from './bonusRegels'
import { usePeildatum } from './bezorgdag'

export * from './bonusRegels'

/** Alle lopende en komende acties voor je winkel, één keer opgehaald. */
function useAlleBonus(winkel: 'ah' | 'jumbo', aan: boolean) {
  const vandaag = isoDatum(new Date())
  return useQuery({
    queryKey: ['bonus', winkel, vandaag],
    enabled: aan,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<BonusActie[]> => {
      const { data, error } = await db.from('bonus_actie')
        .select('ingredient_key, titel, prijs_nu, prijs_was, mechanisme, geldig_van, geldig_tot')
        .eq('winkel', winkel).gte('geldig_tot', vandaag)
      if (error) throw error
      return (data as BonusActie[]).map((r) => ({
        ...r,
        prijs_nu: r.prijs_nu === null ? null : Number(r.prijs_nu),
        prijs_was: r.prijs_was === null ? null : Number(r.prijs_was),
      }))
    },
  })
}

/** Per ingrediënt de acties die op deze dag gelden. */
export function bonusOp(acties: BonusActie[] | undefined, dag: string): BonusMap {
  const uit: BonusMap = {}
  for (const a of acties ?? []) {
    if (a.geldig_van > dag || a.geldig_tot < dag) continue
    ;(uit[canoniek(a.ingredient_key)] ??= []).push(a)
  }
  return uit
}

/**
 * Bonus voor de winkel uit je voorkeuren, op je peildatum (lib/bezorgdag.ts):
 * de bezorgdag, of vandaag als je zelf haalt. `vroegst` is de bonus op de
 * eerste bezorgdag, om te zien wat er afloopt als je later laat bezorgen.
 */
export function useBonus() {
  const voorkeuren = useVoorkeuren()
  const winkel = voorkeuren.data?.voorkeurswinkel ?? 'ah'
  const peildatum = usePeildatum()
  const alle = useAlleBonus(winkel, Boolean(voorkeuren.data))
  const data = useMemo(() => (alle.data ? bonusOp(alle.data, peildatum.peil) : undefined), [alle.data, peildatum.peil])
  const vroegst = useMemo(() => (alle.data ? bonusOp(alle.data, peildatum.eerste) : undefined), [alle.data, peildatum.eerste])
  return { data, vroegst, peildatum }
}
