import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ds'
import { useBestellingen } from '../lib/queries2'
import { MAALTIJDBOX, euro, totaalBespaard } from '../lib/besparing'

/**
 * Niet elke keer: bij de eerste keer openen, en daarna eens per drie keer.
 * Elke start van de app telt één keer, niet elk bezoek aan Deze week.
 */
const ELKE_ZOVEEL_KEER = 3
const TELLER_SLEUTEL = 'bespaard-melding-teller'

function telOpening(): boolean {
  try {
    const teller = Number(localStorage.getItem(TELLER_SLEUTEL) ?? '0') || 0
    localStorage.setItem(TELLER_SLEUTEL, String(teller + 1))
    return teller % ELKE_ZOVEEL_KEER === 0
  } catch {
    // Geen opslag (privévenster): liever geen melding dan elke keer.
    return false
  }
}

/** Deze keer openen we de app: mag de melding? Eén keer bepaald bij het laden. */
const dezeKeerTonen = telOpening()
let alGetoond = false

const ZICHTBAAR_MS = 5000

const ANIMATIE = `
@keyframes bespaard-in { from { transform: translateY(-140%) } to { transform: translateY(0) } }
@media (prefers-reduced-motion: reduce) { .bespaard-melding { animation: none !important } }
`

/**
 * Open je de app, dan schuift even bovenin wat je in totaal al bespaarde.
 * Tik erop voor "Bespaard!". Nog niets besteld: dan geen melding — een
 * teller op nul motiveert niemand.
 */
export function BespaardMelding() {
  const navigeer = useNavigate()
  const bestellingen = useBestellingen()
  const [zichtbaar, setZichtbaar] = useState(false)

  const lijst = bestellingen.data ?? []
  const totaal = totaalBespaard(lijst)
  const tonen = dezeKeerTonen && !alGetoond && lijst.length > 0 && totaal > 0

  useEffect(() => {
    if (!tonen) return
    alGetoond = true
    setZichtbaar(true)
  }, [tonen])

  useEffect(() => {
    if (!zichtbaar) return
    const klok = window.setTimeout(() => setZichtbaar(false), ZICHTBAAR_MS)
    return () => window.clearTimeout(klok)
  }, [zichtbaar])

  if (!zichtbaar) return null
  return (
    <>
      <style>{ANIMATIE}</style>
      <button
        className="bespaard-melding"
        onClick={() => { setZichtbaar(false); navigeer('/bespaard') }}
        style={{
          position: 'fixed', zIndex: 40, left: 16, right: 16,
          top: 'calc(env(safe-area-inset-top) + 10px)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
          background: 'var(--c-green)', color: 'var(--c-cream)',
          boxShadow: '0 8px 24px rgba(20,20,20,0.25)',
          animation: 'bespaard-in 420ms var(--ease)',
        }}
      >
        <span style={{
          flex: 'none', width: 40, height: 40, borderRadius: 'var(--radius-full)',
          background: 'var(--c-yellow)', color: 'var(--c-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="piggyBank" size={22} /></span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, lineHeight: 1,
            color: 'var(--c-yellow)', textTransform: 'uppercase',
          }}>{euro(totaal)} bespaard</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.3 }}>
            ten opzichte van {MAALTIJDBOX.naam}, sinds je deze app gebruikt
          </span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </>
  )
}
