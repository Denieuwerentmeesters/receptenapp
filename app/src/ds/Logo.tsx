import type { CSSProperties } from 'react'

/**
 * Het woordmerk "pinch": zware letters met een zoutkorrel als punt op de i.
 * De letters nemen de tekstkleur over (currentColor); de korrel staat schuin
 * zodat hij als zoutkristal leest en niet als gewone punt.
 *
 * Dezelfde tekening staat in public/favicon.svg en ios/ontwerp/maak.mjs.
 */
export function Woordmerk({ hoogte = 36, korrel = 'var(--c-yellow)', style }: {
  hoogte?: number
  korrel?: string
  style?: CSSProperties
}) {
  return (
    <svg
      role="img" aria-label="Pinch" viewBox="-4 -16 240 104"
      height={hoogte} width={(hoogte * 240) / 104}
      style={{ display: 'block', flex: 'none', ...style }}
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
      <rect x={62} y={-7} width={16} height={16} rx={3} transform="rotate(20 70 1)" fill={korrel} />
    </svg>
  )
}
