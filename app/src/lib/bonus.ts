import { useQuery } from '@tanstack/react-query'
import { db } from './db'
import { useVoorkeuren } from './queries'
import { canoniek } from './synoniemen'
import { eersteBezorgdag, isoDatum, type BonusActie, type BonusMap } from './bonusRegels'

export * from './bonusRegels'

/** Bonus voor de winkel uit je voorkeuren, op de eerste bezorgdag. */
export function useBonus() {
  const voorkeuren = useVoorkeuren()
  const winkel = voorkeuren.data?.voorkeurswinkel ?? 'ah'
  const peil = isoDatum(eersteBezorgdag())
  return useQuery({
    queryKey: ['bonus', winkel, peil],
    enabled: Boolean(voorkeuren.data),
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<BonusMap> => {
      const { data, error } = await db.from('bonus_actie')
        .select('ingredient_key, titel, prijs_nu, prijs_was, mechanisme, geldig_van, geldig_tot')
        .eq('winkel', winkel).lte('geldig_van', peil).gte('geldig_tot', peil)
      if (error) throw error
      const uit: BonusMap = {}
      for (const rij of data as BonusActie[]) {
        const key = canoniek(rij.ingredient_key)
        ;(uit[key] ??= []).push({ ...rij, prijs_nu: rij.prijs_nu === null ? null : Number(rij.prijs_nu), prijs_was: rij.prijs_was === null ? null : Number(rij.prijs_was) })
      }
      return uit
    },
  })
}

