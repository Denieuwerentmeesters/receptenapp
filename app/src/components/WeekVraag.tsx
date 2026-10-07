import { useEffect, useRef, useState } from 'react'
import { Dialoog } from './Dialoog'
import { Icon } from '../ds'
import { useActieveWeek, useDezeWeek } from '../lib/queries'
import { nogTeKoken, useWeekWissel, weekVoorbij } from '../lib/weekwissel'
import { weekStart } from '../lib/week'

const LATER = 'pinch-weekvraag-later'
const DAG = 24 * 60 * 60 * 1000

function uitgesteld(): boolean {
  try { return Date.now() - Number(localStorage.getItem(LATER) ?? 0) < DAG } catch { return false }
}

/**
 * Een week na het bestellen, bij het openen van de app: "Alle recepten van
 * deze week gekookt?". Bij ja schuift komende week door. Bij nee wijs je aan
 * wat je nog gaat koken; dat gaat mee naar de nieuwe week.
 *
 * Zolang je niet antwoordt blijft de week staan. "Vraag het later" geeft een dag rust.
 *
 * Is de week voorbij en wacht er niets besteld meer op (alles weggehaald), dan
 * haalt de app de kalender stil in.
 */
export function WeekVraag() {
  const week = useActieveWeek()
  const dezeWeek = useDezeWeek(week)
  const { rondAf, haalIn } = useWeekWissel()
  const [stap, setStap] = useState<'vraag' | 'kies' | 'dicht'>('vraag')
  const [nogKoken, setNogKoken] = useState<string[] | null>(null)

  const open = nogTeKoken(dezeWeek.data ?? [])
  const tonen = stap !== 'dicht' && !rondAf.isPending && weekVoorbij(dezeWeek.data ?? []) && !uitgesteld()
  const gekozen = nogKoken ?? open.map((r) => r.id)

  const ingehaald = useRef<string | null>(null)
  const achter = week < weekStart() && dezeWeek.isSuccess && !dezeWeek.isFetching && open.length === 0
  useEffect(() => {
    if (!achter || ingehaald.current === week) return
    ingehaald.current = week
    haalIn.mutate()
  }, [achter, week, haalIn])

  const later = () => {
    try { localStorage.setItem(LATER, String(Date.now())) } catch { /* dan vragen we het zo weer */ }
    setStap('dicht')
  }

  if (!tonen) return null
  if (stap === 'vraag') {
    return (
      <Dialoog
        open
        kop="Alle recepten van deze week gekookt?"
        tekst="Dan zetten we komende week klaar als je nieuwe week."
        onSluit={later}
        acties={[
          { label: 'Ja, alles gekookt', hoofd: true, onClick: () => { rondAf.mutate([]); setStap('dicht') } },
          { label: 'Nee, nog niet alles', onClick: () => setStap('kies') },
          { label: 'Vraag het later', onClick: later },
        ]}
      />
    )
  }
  return (
    <Dialoog
      open
      kop="Wat ga je nog koken?"
      tekst="Dat blijft in Deze week staan, en de recepten van komende week komen erbij."
      onSluit={later}
      acties={[
        { label: 'Verder', hoofd: true, onClick: () => { rondAf.mutate(gekozen); setStap('dicht') } },
        { label: 'Terug', onClick: () => setStap('vraag') },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '36dvh', overflowY: 'auto', marginBottom: 6 }}>
        {open.map((r) => {
          const aan = gekozen.includes(r.id)
          return (
            <button
              key={r.id}
              aria-pressed={aan}
              onClick={() => setNogKoken(aan ? gekozen.filter((id) => id !== r.id) : [...gekozen, r.id])}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--c-paper)',
                border: `1.5px solid ${aan ? 'var(--c-red)' : 'rgba(20,20,20,0.14)'}`,
                fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--color-ink)',
              }}
            >
              <span style={{
                flex: 'none', width: 22, height: 22, borderRadius: 'var(--radius-full)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: aan ? 'var(--c-red)' : 'transparent', color: 'var(--c-paper)',
                border: aan ? 'none' : '1.5px solid rgba(20,20,20,0.3)',
              }}>{aan && <Icon name="check" size={14} />}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{r.titel_nl ?? r.titel}</span>
            </button>
          )
        })}
      </div>
    </Dialoog>
  )
}
