import { useMemo } from 'react'
import { useFavorietIds, useFavorietToggle } from '../lib/queries2'
import type { Recept } from '../lib/database.types'

/**
 * Het hartje, vanaf elk scherm hetzelfde: favoriet, of weer niet. Favorieten
 * staan in Mijn recepten → Nog bestellen. Op je lijst zetten is een eigen knop
 * (het plusje): twee acties, twee iconen.
 *
 * Geeft de functie terug en welke recepten favoriet zijn.
 */
export function useHartje() {
  const favorietIds = useFavorietIds()
  const favoriet = useFavorietToggle()

  const bewaard = useMemo(() => new Set(Object.keys(favorietIds.data ?? {})), [favorietIds.data])

  function tik(recept: Pick<Recept, 'id'>) {
    favoriet.mutate({ receptId: recept.id, favoriet: !bewaard.has(recept.id) })
  }

  return { tik, bewaard }
}
