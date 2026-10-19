import type { CSSProperties } from 'react'
import { KORREL, LETTERS, VLAK } from './woordmerk'

/**
 * Het woordmerk "Kookmaatje": Unbounded Black met een gele korrel als punt
 * op de j. De letters nemen de tekstkleur over (currentColor); de korrel
 * staat schuin zodat hij als korrel leest en niet als gewone punt.
 *
 * De tekening staat in ./woordmerk.ts en wordt ook gebruikt door
 * lib/deelpagina.ts (de openbare receptpagina) en ios/ontwerp/maak.mjs.
 */
export function Woordmerk({ hoogte = 32, korrel = 'var(--c-yellow)', style }: {
  hoogte?: number
  korrel?: string
  style?: CSSProperties
}) {
  const [x, y, breed, hoog] = VLAK
  return (
    <svg
      role="img" aria-label="Kookmaatje" viewBox={`${x} ${y} ${breed} ${hoog}`}
      height={hoogte} width={(hoogte * breed) / hoog}
      style={{ display: 'block', flex: 'none', ...style }}
    >
      <g fill="currentColor">
        {LETTERS.map((l, i) => <path key={i} d={l.d} />)}
      </g>
      <Korrel kleur={korrel} />
    </svg>
  )
}

/** De gele korrel op de j. */
export function Korrel({ kleur }: { kleur: string }) {
  const { cx, cy, zijde, hoek } = KORREL
  return (
    <rect
      x={cx - zijde / 2} y={cy - zijde / 2} width={zijde} height={zijde} rx={zijde * 0.18}
      transform={`rotate(${hoek} ${cx} ${cy})`} fill={kleur}
    />
  )
}
