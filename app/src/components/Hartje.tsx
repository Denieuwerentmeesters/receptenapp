import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialoog } from './Dialoog'
import { useDezeWeek, useLijstActies } from '../lib/queries'
import { useFavorietIds, useFavorietToggle } from '../lib/queries2'
import { volgendeWeek } from '../lib/week'
import type { Recept } from '../lib/database.types'

const UITLEG_GEZIEN = 'pinch-komende-week-uitleg'

function uitlegGezien(): boolean {
  try { return localStorage.getItem(UITLEG_GEZIEN) !== null } catch { return true }
}

/**
 * Het hartje, vanaf elk scherm hetzelfde: het recept gaat naar "Komende week"
 * en wordt een favoriet. Nog een tik haalt het weer uit komende week; een
 * favoriet blijft het (weghalen kan bij Favorieten).
 *
 * De eerste keer leggen we uit waar het recept gebleven is.
 *
 * Geeft de functie terug, welke recepten er al staan, en het dialoogelement;
 * zet dat ergens in je scherm.
 */
export function useHartje() {
  const navigeer = useNavigate()
  const week = volgendeWeek()
  const komendeWeek = useDezeWeek(week)
  const { zetInWeek, haalUitWeek } = useLijstActies(week)
  const favorietIds = useFavorietIds()
  const favoriet = useFavorietToggle()
  const [uitleg, setUitleg] = useState(false)

  const bewaard = useMemo(() => new Set((komendeWeek.data ?? []).map((r) => r.id)), [komendeWeek.data])

  function tik(recept: Recept) {
    if (bewaard.has(recept.id)) { haalUitWeek.mutate(recept.id); return }
    zetInWeek.mutate(recept)
    if (favorietIds.data && !favorietIds.data[recept.id]) favoriet.mutate({ receptId: recept.id, favoriet: true })
    if (!uitlegGezien()) {
      setUitleg(true)
      try { localStorage.setItem(UITLEG_GEZIEN, new Date().toISOString()) } catch { /* dan de volgende keer nog eens */ }
    }
  }

  const dialoog = (
    <Dialoog
      open={uitleg}
      kop="Bewaard voor komende week"
      tekst="Dit gerecht is opgeslagen in 'Komende week'. Swipe tussen deze en komende week in de tab 'Deze week'."
      onSluit={() => setUitleg(false)}
      acties={[
        { label: 'Oké', hoofd: true, onClick: () => setUitleg(false) },
        { label: 'Bekijk komende week', onClick: () => { setUitleg(false); navigeer('/deze-week', { state: { tab: 'komende' } }) } },
      ]}
    />
  )

  return { tik, bewaard, dialoog }
}
