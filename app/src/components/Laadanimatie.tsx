import { useEffect, useMemo, useState } from 'react'

/**
 * De laadanimatie uit Claude Design ("Pinch Zout"): een snufje zout tussen
 * twee vingers. Een paar korrels vallen rustig boven de i, tikken van de
 * letters af en verdwijnen; één korrel blijft liggen als de punt op de i.
 * Na zes seconden begint het opnieuw.
 *
 * Het woordmerk is hetzelfde als ds/Logo.tsx, zonder de korrel: die valt
 * hier zelf. De korrels zijn vooraf doorgerekend (vaste seed, dus elke keer
 * dezelfde val) en worden per frame uit die tabel getekend, op een
 * requestAnimationFrame-klok. Wie "verminder beweging" aan heeft ziet het
 * stilstaande logo mét korrel.
 */

/** Zwaartekracht, snelheden en afstanden zijn in eenheden van de viewBox (-4 -16 240 104). */
const G = 470
/** Midden van de korrel op de i, zoals in ds/Logo.tsx (rect 62,-7 16×16, rotate 20 om 70,1). */
const PUNT = { cx: 70, cy: 1, s: 16, rot: 20 }
/** Waar de korrels loslaten: ver boven het logo, zodat ze van de bovenkant van het scherm komen. */
const START_Y = -305
/** Onder deze lijn is een korrel het scherm af. */
const WEG_Y = 500
/** Totale lus, en wanneer in de lus de blijvende korrel loslaat. */
const TOTAAL = 6
const PUNT_START = 0.86
/** Momenten waarop de losse korrels loslaten: kleine, rustige vlaagjes. */
const LOSLATEN = [0.15, 0.3, 0.38, 0.62, 0.74, 0.98, 1.12, 1.36, 1.5]
const SIM_HZ = 120
const FRAME_HZ = 60

/**
 * De bovenkant van de letters op een x: daar ketsen de korrels op. Afgeleid
 * uit de paden in ds/Logo.tsx, lijndikte 16 (buitenstraal van een boog 24).
 * Null is een gat: daar valt de korrel door.
 */
function bovenkant(x: number): number | null {
  const boog = (cx: number, cy: number) => cy - Math.sqrt(576 - (x - cx) ** 2)
  if (x >= 0 && x < 16) return 16 // stok van de p
  if (x >= 16 && x <= 56) return boog(32, 40) // rondje van de p
  if (x >= 62 && x < 78) return 16 // stok van de i
  if (x >= 84 && x <= 132) return boog(108, 38) // n
  if (x >= 136 && x <= 178) return boog(160, 40) // c, open aan de rechterkant
  if (x >= 184 && x < 200) return -6 // stok van de h
  if (x >= 200 && x <= 232) return boog(208, 38) // boog van de h
  return null
}

type Korrel = { t0: number; frames: [number, number, number][] }

/** Rekent de val van de losse korrels één keer door: per frame x, y en draaiing. */
function simuleer(): Korrel[] {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5
  const s = PUNT.s
  const dt = 1 / SIM_HZ
  const spec = LOSLATEN.map((t0) => ({ t0, x: PUNT.cx + gauss() * 9, vx: gauss() * 7, r: rnd() * 90 }))
  return spec.map((k) => {
    let x = k.x, y = START_Y + gauss() * 3, vx = k.vx, vy = 0, r = k.r, vr = gauss() * 40, tikken = 0
    const frames: [number, number, number][] = []
    for (let f = 0; f < 4 * SIM_HZ; f++) {
      vy += G * dt; x += vx * dt; y += vy * dt; r += vr * dt
      const top = bovenkant(x)
      if (top !== null && vy > 0 && y + s / 2 >= top && y - s / 2 < top + 5) {
        // Ketsen: elke tik zachter, en weg van het midden.
        y = top - s / 2; vy = (-vy * (0.22 + rnd() * 0.12)) / (tikken + 1); tikken++
        const kant = x < PUNT.cx ? -1 : 1
        vx = kant * (21 + rnd() * 31); vr = kant * (120 + rnd() * 160)
        if (Math.abs(vy) < 26) vy = 0
      }
      if (f % (SIM_HZ / FRAME_HZ) === 0) frames.push([x, y, r])
      if (y > WEG_Y) break
    }
    return { t0: k.t0, frames }
  })
}

/** Seconden sinds het begin, elke frame opnieuw; null bij "verminder beweging". */
function useKlok(): number | null {
  const [t, setT] = useState<number | null>(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setT(null); return }
    let raf = 0
    const start = performance.now()
    const stap = (nu: number) => { setT((nu - start) / 1000); raf = requestAnimationFrame(stap) }
    raf = requestAnimationFrame(stap)
    return () => cancelAnimationFrame(raf)
  }, [])
  return t
}

export function Snufje({ breedte = 220, kleur = 'var(--c-cream)', korrel = 'var(--c-yellow)' }: {
  breedte?: number
  kleur?: string
  korrel?: string
}) {
  const t = useKlok()
  const korrels = useMemo(simuleer, [])
  const stil = t === null
  const lt = stil ? TOTAAL : t % TOTAAL
  const s = PUNT.s
  const rx = 3

  // De blijvende korrel: valt, stuitert één keer en komt schuin tot rust als de punt op de i.
  const ft = stil ? 1e3 : lt - PUNT_START
  let punt: { y: number; rot: number; sx: number; sy: number } | null = null
  if (ft >= 0) {
    const tf = Math.sqrt((2 * (PUNT.cy - START_Y)) / G)
    if (ft < tf) {
      punt = { y: START_Y + 0.5 * G * ft * ft, rot: PUNT.rot + 220 * (1 - ft / tf), sx: 1, sy: 1 }
    } else {
      const a = ft - tf, v = G * tf * 0.22, tb = (2 * v) / G
      const kneep = Math.exp(-a * 9) * Math.cos(a * 30)
      punt = {
        y: a < tb ? PUNT.cy - (v * a - 0.5 * G * a * a) : PUNT.cy,
        rot: PUNT.rot + 14 * Math.exp(-a * 7) * Math.cos(a * 22),
        sx: 1 + 0.18 * kneep,
        sy: 1 - 0.18 * kneep,
      }
    }
  }

  return (
    <svg
      role="img" aria-label="Pinch laadt" viewBox="-4 -16 240 104"
      width={breedte} height={(breedte * 104) / 240}
      style={{ display: 'block', overflow: 'visible', color: kleur }}
    >
      <g fill="none" stroke="currentColor" strokeWidth={16}>
        <path d="M8 16V84" />
        <circle cx={32} cy={40} r={16} />
        <path d="M70 16V64" />
        <path d="M92 64V38A16 16 0 0 1 124 38V64" />
        <path d="M173.3 28.7A16 16 0 1 0 173.3 51.3" />
        <path d="M192 -6V64" />
        <path d="M192 64V38A16 16 0 0 1 224 38V64" />
      </g>
      {!stil && korrels.map((k, i) => {
        const f = Math.floor((lt - k.t0) * FRAME_HZ)
        if (f < 0 || f >= k.frames.length) return null
        const [x, y, r] = k.frames[f]
        return (
          <rect
            key={i} x={x - s / 2} y={y - s / 2} width={s} height={s} rx={rx}
            fill={korrel} transform={`rotate(${r} ${x} ${y})`}
          />
        )
      })}
      {punt && (
        <rect
          x={PUNT.cx - s / 2} y={punt.y - s / 2} width={s} height={s} rx={rx} fill={korrel}
          transform={`rotate(${punt.rot} ${PUNT.cx} ${punt.y}) translate(${PUNT.cx} ${punt.y + s / 2}) scale(${punt.sx} ${punt.sy}) translate(${-PUNT.cx} ${-(punt.y + s / 2)})`}
        />
      )}
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
      <Snufje breedte={200} />
      {tekst && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600, margin: 0, textAlign: 'center' }}>{tekst}</p>
      )}
      {subtekst && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, margin: '-14px 0 0', opacity: 0.8, textAlign: 'center' }}>{subtekst}</p>
      )}
    </div>
  )
}
