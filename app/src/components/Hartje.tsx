import { useMemo } from 'react'
import { useFases } from '../lib/fases'
import { useLijstActies } from '../lib/queries'
import { volgendeWeek } from '../lib/week'
import type { Recept } from '../lib/database.types'

/**
 * Het hartje, vanaf elk scherm hetzelfde: het recept gaat naar Mijn recepten →
 * Nog bestellen, bovenaan bij wat je koos, in de week waarin je nu bestelt
 * (lib/fases.ts). Nog niet op je lijst: dat doe je daar. Nog een tik haalt
 * het weer uit je week; wat al besteld is (Te koken) blijft staan.
 *
 * Geeft de functie terug en welke recepten erin staan (gevuld hartje).
 */
export function useHartje() {
  const fases = useFases()
  const deze = useLijstActies(fases.week)
  const komende = useLijstActies(volgendeWeek(fases.week))

  const inFase = useMemo(
    () => new Map([...fases.teKoken, ...fases.nogBestellen].map((r) => [r.id, r])),
    [fases.teKoken, fases.nogBestellen],
  )
  const bewaard = useMemo(() => new Set(inFase.keys()), [inFase])

  function tik(recept: Recept) {
    const fase = inFase.get(recept.id)
    if (fase?.besteldOp) return
    const acties = (fase?.week ?? fases.bestelWeek) === fases.week ? deze : komende
    if (fase) acties.haalUitWeek.mutate(recept.id)
    else acties.zetInWeek.mutate(recept)
  }

  return { tik, bewaard }
}
