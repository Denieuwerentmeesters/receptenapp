import { useEffect, useRef, useState } from 'react'
import { Korrel } from '../ds/Logo'
import { KORREL, LETTERS, VLAK } from '../ds/woordmerk'

/**
 * De laadanimatie uit Claude Design ("Kookmaatje Loader", variant 2:
 * gekookt): het woordmerk pruttelt even, dan verdampt het letter voor letter,
 * komt terug en begint opnieuw. Hetzelfde woordmerk als ds/Logo.tsx, maar
 * per letter een eigen groep, zodat elke letter apart kan wiebelen, vervagen
 * en opstijgen.
 *
 * Draait op requestAnimationFrame, niet op CSS-animaties: het vervagen is
 * een SVG-filter per letter en die kun je niet met keyframes sturen. Wie
 * "verminder beweging" aan heeft ziet het stilstaande logo.
 *
 * Maten in de eenheden van het woordmerk (ds/woordmerk.ts, hoofdletter 75).
 */

/** Volgorde van verdampen: niet van links naar rechts, dat oogt te netjes. */
const VOLGORDE = [4, 1, 7, 0, 5, 9, 2, 6, 3, 8]
const SNELHEID = 1.25
const PRUTTEL = 1.6
const TUSSEN = 0.5
const VERDAMP = 1.6
const VERDAMP_KLAAR = PRUTTEL + TUSSEN * (LETTERS.length - 1) + VERDAMP
const LEEG = 0.6
const TERUG = 0.7
const TOTAAL = VERDAMP_KLAAR + LEEG + TERUG
/** Eén "stap" in het ontwerp, omgerekend naar de maat van de letters. */
const F = 1.25

const klem = (x: number) => Math.min(Math.max(x, 0), 1)
const inlopen = (x: number) => x * x

/** Seconden sinds het begin, elke frame opnieuw; staat stil bij "verminder beweging". */
function useKlok(): number {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const start = performance.now()
    const stap = (nu: number) => { setT(((nu - start) / 1000) * SNELHEID); raf = requestAnimationFrame(stap) }
    raf = requestAnimationFrame(stap)
    return () => cancelAnimationFrame(raf)
  }, [])
  return t
}

export function Pruttel({ breedte = 260, kleur = 'var(--c-cream)', korrel = 'var(--c-yellow)' }: {
  breedte?: number
  kleur?: string
  korrel?: string
}) {
  const t = useKlok()
  const id = useRef(`pr${Math.random().toString(36).slice(2, 8)}`).current
  const lt = t % TOTAAL
  const terug = lt > VERDAMP_KLAAR + LEEG ? klem((lt - VERDAMP_KLAAR - LEEG) / TERUG) : 0
  const [vx, vy, vb, vh] = VLAK

  const letters = LETTERS.map((letter, i) => {
    const start = PRUTTEL + VOLGORDE.indexOf(i) * TUSSEN
    const e = terug ? 0 : klem((lt - start) / VERDAMP)
    const vooraf = terug ? 0 : klem((lt - start + 0.6) / 0.6)
    return { letter, i, e, vooraf, cx: letter.x + letter.breed / 2 }
  })

  return (
    <svg
      role="img" aria-label="Kookmaatje laadt" viewBox={`${vx} ${vy} ${vb} ${vh}`}
      width={breedte} height={(breedte * vh) / vb}
      style={{ display: 'block', overflow: 'visible', color: kleur }}
    >
      <defs>
        {letters.map(({ i, e }) => (
          <filter key={i} id={`${id}f${i}`} x="-50%" y="-80%" width="200%" height="260%">
            <feGaussianBlur stdDeviation={e * 6 * F} />
          </filter>
        ))}
      </defs>
      {letters.map(({ letter, i, e, vooraf, cx }) => {
        const wiebel = Math.sin(lt * 9 + i * 1.7) * (0.8 + vooraf * 2) * F
        const dy = -inlopen(e) * 40 * F + (e ? 0 : wiebel)
        const op = terug ? terug : 1 - inlopen(e)
        return (
          <g
            key={i}
            opacity={op}
            filter={e > 0.01 ? `url(#${id}f${i})` : undefined}
            transform={`translate(0 ${dy}) translate(${cx} 0) scale(${1 + e * 0.12} ${1 + e * 0.35}) translate(${-cx} 0)`}
          >
            <path d={letter.d} fill="currentColor" />
            {i === KORREL.index && <Korrel kleur={korrel} />}
          </g>
        )
      })}
      {/* Belletjes onder de letters zolang ze nog pruttelen. */}
      {letters.map(({ i, e, cx }) => {
        if (terug || e >= 0.3) return null
        const periode = 1.1 + (i % 3) * 0.25
        const bt = ((lt + i * 0.37) % periode) / periode
        return (
          <circle
            key={i} cx={cx + Math.sin(bt * 6 + i) * 2} cy={14 * F - bt * 18 * F} r={(2 + bt * 3) * F}
            fill="none" stroke="currentColor" strokeWidth={4} opacity={(1 - bt) * (1 - e / 0.3)}
          />
        )
      })}
    </svg>
  )
}

/**
 * Een heel scherm met de animatie in het midden: rood bij het openen van de
 * app, paars bij het toevoegen van een recept. De tekst eronder is optioneel;
 * bij het openen van de app staat er niets, dat is al duidelijk genoeg.
 */
export function LaadScherm({ kleur = 'rood', tekst, subtekst, vullend = true }: {
  kleur?: 'rood' | 'paars'
  tekst?: string
  subtekst?: string
  /** Vult de hele hoogte (het hele scherm) of alleen zijn eigen vak. */
  vullend?: boolean
}) {
  return (
    <div style={{
      height: vullend ? '100%' : undefined, flex: vullend ? 1 : undefined,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
      background: kleur === 'paars' ? 'var(--c-purple)' : 'var(--c-red)', color: 'var(--c-cream)',
      padding: '0 26px 46px',
    }}>
      <Pruttel breedte={260} />
      {tekst && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600, margin: 0, textAlign: 'center' }}>{tekst}</p>
      )}
      {subtekst && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, margin: '-14px 0 0', opacity: 0.8, textAlign: 'center' }}>{subtekst}</p>
      )}
    </div>
  )
}
