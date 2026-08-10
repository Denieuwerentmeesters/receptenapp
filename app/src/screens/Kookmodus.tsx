import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../ds'
import { Scherm } from '../components/Layout'
import { Grens } from '../components/Staten'
import { useRecept, useVoorkeuren } from '../lib/queries'
import { useGekooktMarkeren } from '../lib/queries2'
import { schaalIngredienten } from '../lib/schaal'

/**
 * Koken op donkere achtergrond, één stap tegelijk, grote letters.
 *
 * Twee dingen die het scherm bruikbaar maken met vette handen: de tekst is
 * 19px in plaats van 15, en het scherm blijft aan zolang je kookt (Wake Lock,
 * waar de browser dat ondersteunt).
 */
export function Kookmodus() {
  const { id } = useParams<{ id: string }>()
  const navigeer = useNavigate()
  const recept = useRecept(id)
  const voorkeuren = useVoorkeuren()
  const gekooktMarkeren = useGekooktMarkeren()

  const [stap, setStap] = useState(0)
  const [seconden, setSeconden] = useState<number | null>(null)
  const [loopt, setLoopt] = useState(false)

  // Scherm aan houden tijdens het koken.
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }).wakeLock
    void wakeLock?.request('screen').then((s) => { sentinel = s }).catch(() => { /* niet ondersteund */ })
    return () => { void sentinel?.release().catch(() => { /* al vrijgegeven */ }) }
  }, [])

  const tik = useRef<number | null>(null)
  useEffect(() => {
    if (!loopt || seconden === null) return
    tik.current = window.setInterval(() => {
      setSeconden((s) => {
        if (s === null || s <= 1) { setLoopt(false); return 0 }
        return s - 1
      })
    }, 1000)
    return () => { if (tik.current) window.clearInterval(tik.current) }
  }, [loopt, seconden === null])

  return (
    <Scherm achtergrond="var(--c-ink)">
      <Grens query={recept} ladenTekst="Recept ophalen">
        {recept.data && (() => {
          const r = recept.data
          const stappen = r.bereiding_nl.length > 0 ? r.bereiding_nl : ['Voor dit recept is nog geen bereiding vastgelegd.']
          const laatste = stap === stappen.length - 1
          const personen = voorkeuren.data?.aantal_personen ?? 4
          const ingredienten = schaalIngredienten(r.ingredienten, r.personen, personen)

          // Ingrediënten die in deze stap genoemd worden, tonen we als chips —
          // dan hoef je niet terug te bladeren voor de hoeveelheid.
          const tekst = stappen[stap].toLowerCase()
          const relevant = ingredienten.filter((i) => {
            const woord = i.naam.toLowerCase().split(/[\s(,]/)[0]
            return woord.length >= 4 && tekst.includes(woord)
          }).slice(0, 6)

          return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--c-cream)' }}>
              <div style={{
                flex: 'none', padding: 'calc(env(safe-area-inset-top) + 20px) 22px 10px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <button
                  onClick={() => navigeer(-1)}
                  aria-label="Kookmodus sluiten"
                  style={{
                    border: 'none', background: 'rgba(255,246,232,0.18)', color: 'var(--c-cream)',
                    width: 36, height: 36, borderRadius: 'var(--radius-full)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                ><Icon name="x" size={18} /></button>
                <span style={{
                  flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                  letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--c-yellow)',
                }}>
                  {r.titel_nl ?? r.titel} · stap {stap + 1} van {stappen.length}
                </span>
              </div>

              <div style={{ flex: 'none', padding: '0 22px' }}>
                <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'rgba(255,246,232,0.24)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--c-yellow)',
                    width: `${Math.round(((stap + 1) / stappen.length) * 100)}%`,
                    transition: 'width var(--motion-slow) var(--ease)',
                  }} />
                </div>
              </div>

              <div style={{
                flex: 1, overflowY: 'auto', padding: '26px 22px 8px',
                display: 'flex', flexDirection: 'column', gap: 20,
              }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 19, lineHeight: 1.5, margin: 0 }}>
                  {stappen[stap]}
                </p>

                {relevant.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {relevant.map((i, n) => (
                      <span key={n} style={{
                        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                        padding: '9px 14px', borderRadius: 'var(--radius-full)',
                        border: '1.5px solid rgba(255,246,232,0.4)',
                      }}>{i.weergave} {i.naam}</span>
                    ))}
                  </div>
                )}

                <div style={{
                  background: 'var(--c-red)', borderRadius: 'var(--radius-lg)', padding: 20,
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                      letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-yellow)',
                    }}>Timer</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 34, lineHeight: 1 }}>
                      {seconden === null ? '––:––' : formatteer(seconden)}
                    </span>
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {seconden === null ? (
                      [5, 10, 15].map((m) => (
                        <button
                          key={m}
                          onClick={() => { setSeconden(m * 60); setLoopt(true) }}
                          style={timerKnop}
                        >{m}m</button>
                      ))
                    ) : (
                      <>
                        <button onClick={() => setLoopt(!loopt)} style={timerKnop}>
                          {loopt ? 'Pauze' : seconden === 0 ? 'Klaar' : 'Start'}
                        </button>
                        <button onClick={() => { setSeconden(null); setLoopt(false) }} style={timerKnop}>Uit</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={{
                flex: 'none', padding: '10px 22px calc(env(safe-area-inset-bottom) + 24px)',
                display: 'flex', gap: 10,
              }}>
                <button
                  onClick={() => setStap(Math.max(0, stap - 1))}
                  disabled={stap === 0}
                  aria-label="Vorige stap"
                  style={{
                    flex: 'none', width: 56, height: 56, borderRadius: 'var(--radius-full)',
                    border: '1.5px solid rgba(255,246,232,0.5)', background: 'transparent',
                    color: 'var(--c-cream)', cursor: stap === 0 ? 'not-allowed' : 'pointer',
                    opacity: stap === 0 ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                ><Icon name="chevronLeft" size={20} /></button>

                <button
                  onClick={() => {
                    if (!laatste) { setStap(stap + 1); return }
                    gekooktMarkeren.mutate({ receptId: r.id, gekookt: true })
                    navigeer('/vandaag')
                  }}
                  style={{
                    flex: 1, height: 56, borderRadius: 'var(--radius-full)', border: 'none',
                    background: 'var(--c-yellow)', color: 'var(--c-ink)',
                    fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  }}
                >{laatste ? 'Klaar — eet smakelijk' : 'Volgende stap'}</button>
              </div>
            </div>
          )
        })()}
      </Grens>
    </Scherm>
  )
}

const timerKnop: React.CSSProperties = {
  border: 'none', borderRadius: 'var(--radius-full)', padding: '12px 14px',
  background: 'var(--c-yellow)', color: 'var(--c-ink)',
  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}

function formatteer(s: number): string {
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}:${rest < 10 ? '0' : ''}${rest}`
}
