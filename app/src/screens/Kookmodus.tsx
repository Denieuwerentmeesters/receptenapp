import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../ds'
import { Scherm } from '../components/Layout'
import { Grens } from '../components/Staten'
import { useRecept, useVoorkeuren } from '../lib/queries'
import { useGekooktMarkeren } from '../lib/queries2'
import { schaalIngredienten } from '../lib/schaal'
import { formatteerDuur, tijdenUitStap } from '../lib/kookmodus'
import { bereidGeluidVoor, houdSchermAan, planWekker, trekWekkerIn, wekkerAfgelopen } from '../lib/kookwekker'

/**
 * Eén timer tegelijk. Loopt hij, dan onthouden we het eindtijdstip in plaats
 * van af te tellen: een webview die even in de achtergrond stond telt niet
 * door, de klok wel.
 */
interface Timer {
  label: string
  /** De stap waar de timer bij hoort, voor de balk bovenin. */
  stap: number
  eindOp: number | null
  /** Resterende seconden zolang de timer gepauzeerd of afgelopen is. */
  resterend: number
}

/**
 * Koken op paarse achtergrond, één stap tegelijk, grote letters.
 *
 * Twee dingen die het scherm bruikbaar maken met vette handen: de tekst is
 * 19px in plaats van 15, en het scherm blijft aan zolang je kookt.
 *
 * Noemt een stap een tijd ("15 minuten laten sudderen"), dan staat die als
 * eerste timerknop klaar. Loopt de timer af, dan hoor je dat ook met het
 * scherm op slot: de iOS-app plant er een lokale melding voor.
 */
export function Kookmodus() {
  const { id } = useParams<{ id: string }>()
  const navigeer = useNavigate()
  const recept = useRecept(id)
  const voorkeuren = useVoorkeuren()
  const gekooktMarkeren = useGekooktMarkeren()

  const [stap, setStap] = useState(0)
  const [timer, setTimer] = useState<Timer | null>(null)
  const [nu, setNu] = useState(() => Date.now())

  // Scherm aan houden tijdens het koken.
  useEffect(() => houdSchermAan(), [])

  // Verlaat je de kookmodus, dan gaat de timer mee weg, en de melding ook.
  useEffect(() => () => { void trekWekkerIn() }, [])

  const loopt = timer?.eindOp != null
  useEffect(() => {
    if (!loopt) return
    const tik = window.setInterval(() => setNu(Date.now()), 250)
    return () => window.clearInterval(tik)
  }, [loopt])

  const resterend = timer === null ? null
    : timer.eindOp === null ? timer.resterend
    : Math.max(0, Math.ceil((timer.eindOp - nu) / 1000))

  useEffect(() => {
    if (loopt && resterend === 0) {
      wekkerAfgelopen()
      setTimer((t) => t && { ...t, eindOp: null, resterend: 0 })
    }
  }, [loopt, resterend])

  const titel = recept.data ? (recept.data.titel_nl ?? recept.data.titel) : ''

  function startTimer(seconden: number, label: string, bijStap: number) {
    bereidGeluidVoor()
    const eindOp = Date.now() + seconden * 1000
    setNu(Date.now())
    setTimer({ label, stap: bijStap, eindOp, resterend: seconden })
    void planWekker(eindOp, `${label} · ${titel}`)
  }

  function pauzeer() {
    if (!timer || resterend === null) return
    setTimer({ ...timer, eindOp: null, resterend })
    void trekWekkerIn()
  }

  function hervat() {
    if (!timer || !resterend) return
    startTimer(resterend, timer.label, timer.stap)
  }

  function zetUit() {
    setTimer(null)
    void trekWekkerIn()
  }

  return (
    <Scherm achtergrond="var(--c-purple)">
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

          // Tijden uit de stap eerst, de vaste 5/10/15 erachter als terugval.
          const stapTijden = tijdenUitStap(stappen[stap]).slice(0, 3)
          const terugval = [5, 10, 15].filter((m) => !stapTijden.some((t) => t.seconden === m * 60))
          const deTimer = timer?.stap === stap ? timer : null

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

              {timer && timer.stap !== stap && resterend !== null && (
                <div style={{ flex: 'none', padding: '12px 22px 0' }}>
                  <button
                    onClick={() => setStap(timer.stap)}
                    style={{
                      width: '100%', border: 'none', borderRadius: 'var(--radius-full)',
                      background: resterend === 0 ? 'var(--c-yellow)' : 'rgba(255,246,232,0.14)',
                      color: resterend === 0 ? 'var(--c-ink)' : 'var(--c-cream)',
                      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, textAlign: 'left',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18 }}>
                      {resterend === 0 ? 'Klaar' : formatteer(resterend)}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {timer.label} · stap {timer.stap + 1}
                    </span>
                    {!loopt && resterend > 0 && <span>gepauzeerd</span>}
                  </button>
                </div>
              )}

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
                  background: 'rgba(20,20,20,0.22)', borderRadius: 'var(--radius-lg)', padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                      letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-yellow)',
                    }}>{deTimer ? deTimer.label : 'Timer'}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 34, lineHeight: 1 }}>
                      {deTimer && resterend !== null ? formatteer(resterend) : '––:––'}
                    </span>
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {deTimer && resterend !== null ? (
                      <>
                        {resterend > 0 && (
                          <button onClick={loopt ? pauzeer : hervat} style={timerKnop}>
                            {loopt ? 'Pauze' : 'Start'}
                          </button>
                        )}
                        <button onClick={zetUit} style={timerKnop}>{resterend === 0 ? 'Klaar' : 'Uit'}</button>
                      </>
                    ) : (
                      <>
                        {stapTijden.map((t) => (
                          <button key={t.seconden} onClick={() => startTimer(t.seconden, t.label, stap)} style={timerKnop}>
                            {t.label}
                          </button>
                        ))}
                        {terugval.map((m) => (
                          <button
                            key={m}
                            onClick={() => startTimer(m * 60, formatteerDuur(m * 60), stap)}
                            style={stapTijden.length > 0 ? timerKnopStil : timerKnop}
                          >{m}m</button>
                        ))}
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
                    navigeer('/deze-week')
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

const timerKnopStil: React.CSSProperties = {
  ...timerKnop,
  background: 'transparent', color: 'var(--c-cream)',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,246,232,0.5)',
}

function formatteer(s: number): string {
  const twee = (n: number) => `${n < 10 ? '0' : ''}${n}`
  const u = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return u > 0 ? `${u}:${twee(m)}:${twee(s % 60)}` : `${m}:${twee(s % 60)}`
}
