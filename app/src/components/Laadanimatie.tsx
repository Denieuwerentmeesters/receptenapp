import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * De laadanimatie uit Claude Design ("Pinch Loader", variant 2: gekookt): het
 * woordmerk pruttelt even, dan verdampt het letter voor letter, komt terug en
 * begint opnieuw. Hetzelfde woordmerk als ds/Logo.tsx, maar per letter een
 * eigen groep, zodat elke letter apart kan wiebelen, vervagen en opstijgen.
 *
 * Draait op requestAnimationFrame, niet op CSS-animaties: het vervagen is
 * een SVG-filter per letter en die kun je niet met keyframes sturen. Wie
 * "verminder beweging" aan heeft ziet het stilstaande logo.
 */

/** Letters van het woordmerk (viewBox -4 -16 240 104): de tekening en het midden op de x-as. */
const LETTERS: { cx: number; x0: number; x1: number; teken: (korrel: string) => ReactNode }[] = [
  { cx: 28, x0: -4, x1: 56, teken: () => <><path d="M8 16V84" /><circle cx={32} cy={40} r={16} /></> },
  {
    cx: 70, x0: 56, x1: 82,
    teken: (korrel) => <>
      <path d="M70 16V64" />
      <rect x={62} y={-7} width={16} height={16} rx={3} transform="rotate(20 70 1)" fill={korrel} stroke="none" />
    </>,
  },
  { cx: 108, x0: 82, x1: 136, teken: () => <path d="M92 64V38A16 16 0 0 1 124 38V64" /> },
  { cx: 160, x0: 136, x1: 184, teken: () => <path d="M173.3 28.7A16 16 0 1 0 173.3 51.3" /> },
  { cx: 208, x0: 184, x1: 236, teken: () => <><path d="M192 -6V64" /><path d="M192 64V38A16 16 0 0 1 224 38V64" /></> },
]

/** Volgorde van verdampen: n, p, h, i, c — niet van links naar rechts, dat oogt te netjes. */
const VOLGORDE = [2, 0, 4, 1, 3]
const PRUTTEL = 1.8
const TUSSEN = 0.9
const VERDAMP = 1.8
const VERDAMP_KLAAR = PRUTTEL + TUSSEN * (LETTERS.length - 1) + VERDAMP
const LEEG = 0.6
const TERUG = 0.7
const TOTAAL = VERDAMP_KLAAR + LEEG + TERUG
/** Het midden van de letters op de y-as. */
const MIDDEN_Y = 36

const klem = (x: number) => Math.min(Math.max(x, 0), 1)
const inlopen = (x: number) => x * x

/** Seconden sinds het begin, elke frame opnieuw; staat stil bij "verminder beweging". */
function useKlok(): number {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const start = performance.now()
    const stap = (nu: number) => { setT((nu - start) / 1000); raf = requestAnimationFrame(stap) }
    raf = requestAnimationFrame(stap)
    return () => cancelAnimationFrame(raf)
  }, [])
  return t
}

export function Pruttel({ breedte = 220, kleur = 'var(--c-cream)', korrel = 'var(--c-yellow)' }: {
  breedte?: number
  kleur?: string
  korrel?: string
}) {
  const t = useKlok()
  const id = useRef(`pr${Math.random().toString(36).slice(2, 8)}`).current
  const lt = t % TOTAAL
  const terug = lt > VERDAMP_KLAAR + LEEG ? klem((lt - VERDAMP_KLAAR - LEEG) / TERUG) : 0

  return (
    <svg
      role="img" aria-label="Pinch laadt" viewBox="-4 -16 240 104"
      width={breedte} height={(breedte * 104) / 240}
      style={{ display: 'block', overflow: 'visible', color: kleur }}
    >
      <defs>
        {LETTERS.map((_, i) => {
          const start = PRUTTEL + VOLGORDE.indexOf(i) * TUSSEN
          const e = terug ? 0 : klem((lt - start) / VERDAMP)
          return (
            <filter key={i} id={`${id}f${i}`} x="-50%" y="-80%" width="200%" height="260%">
              <feGaussianBlur stdDeviation={e * 4} />
            </filter>
          )
        })}
      </defs>
      {LETTERS.map((letter, i) => {
        const start = PRUTTEL + VOLGORDE.indexOf(i) * TUSSEN
        const e = terug ? 0 : klem((lt - start) / VERDAMP)
        const vooraf = terug ? 0 : klem((lt - start + 0.6) / 0.6)
        const wiebel = Math.sin(lt * 9 + i * 1.7) * (0.7 + vooraf * 1.4)
        const dy = -inlopen(e) * 28 + (e ? 0 : wiebel)
        const op = terug ? terug : 1 - inlopen(e)
        return (
          <g
            key={i}
            opacity={op}
            filter={e > 0.01 ? `url(#${id}f${i})` : undefined}
            transform={`translate(0 ${dy}) translate(${letter.cx} ${MIDDEN_Y}) scale(${1 + e * 0.12} ${1 + e * 0.35}) translate(${-letter.cx} ${-MIDDEN_Y})`}
          >
            <g fill="none" stroke="currentColor" strokeWidth={16}>{letter.teken(korrel)}</g>
          </g>
        )
      })}
      {/* Belletjes onder de letters zolang ze nog pruttelen. */}
      {LETTERS.flatMap((letter, i) => {
        const start = PRUTTEL + VOLGORDE.indexOf(i) * TUSSEN
        const e = terug ? 0 : klem((lt - start) / VERDAMP)
        if (terug || e >= 0.3) return []
        return [0, 1].map((b) => {
          const periode = 1.1 + ((i + b) % 3) * 0.25
          const bt = ((lt + i * 0.37 + b * 0.55) % periode) / periode
          const bx = letter.x0 + (letter.x1 - letter.x0) * (0.3 + 0.4 * b) + Math.sin(bt * 6 + i) * 2
          return (
            <circle
              key={`${i}-${b}`} cx={bx} cy={82 - bt * 14} r={1.6 + bt * 2.2}
              fill="none" stroke="currentColor" strokeWidth={1.4} opacity={(1 - bt) * (1 - e / 0.3)}
            />
          )
        })
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
      <Pruttel breedte={200} />
      {tekst && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600, margin: 0, textAlign: 'center' }}>{tekst}</p>
      )}
      {subtekst && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, margin: '-14px 0 0', opacity: 0.8, textAlign: 'center' }}>{subtekst}</p>
      )}
    </div>
  )
}
