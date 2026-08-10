import type { CSSProperties } from 'react'

type Shape = [string, string]

// Lucide (MIT), 2px stroke, currentColor — overgenomen uit het design system.
const PATHS: Record<string, Shape[]> = {
  house: [['path', 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8'], ['path', 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z']],
  grid: [['rect', '3,3,7,7,1'], ['rect', '14,3,7,7,1'], ['rect', '14,14,7,7,1'], ['rect', '3,14,7,7,1']],
  cart: [['circle', '8,21,1'], ['circle', '19,21,1'], ['path', 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12']],
  user: [['path', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'], ['circle', '12,7,4']],
  check: [['path', 'M20 6 9 17l-5-5']],
  plus: [['path', 'M5 12h14'], ['path', 'M12 5v14']],
  minus: [['path', 'M5 12h14']],
  clock: [['circle', '12,12,10'], ['path', 'M12 6v6l4 2']],
  users: [['path', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'], ['path', 'M16 3.128a4 4 0 0 1 0 7.744'], ['path', 'M22 21v-2a4 4 0 0 0-3-3.87'], ['circle', '9,7,4']],
  chevronLeft: [['path', 'm15 18-6-6 6-6']],
  chevronRight: [['path', 'm9 18 6-6-6-6']],
  heart: [['path', 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5']],
  search: [['path', 'm21 21-4.34-4.34'], ['circle', '11,11,8']],
  sliders: [['path', 'M10 5H3'], ['path', 'M12 19H3'], ['path', 'M14 3v4'], ['path', 'M16 17v4'], ['path', 'M21 12h-9'], ['path', 'M21 19h-5'], ['path', 'M21 5h-7'], ['path', 'M8 10v4'], ['path', 'M8 12H3']],
  x: [['path', 'M18 6 6 18'], ['path', 'm6 6 12 12']],
  chefHat: [['path', 'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z'], ['path', 'M6 17h12']],
  utensils: [['path', 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2'], ['path', 'M7 2v20'], ['path', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7']],
  list: [['path', 'M3 5h.01'], ['path', 'M3 12h.01'], ['path', 'M3 19h.01'], ['path', 'M8 5h13'], ['path', 'M8 12h13'], ['path', 'M8 19h13']],
  flame: [['path', 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4']],
  bell: [['path', 'M10.268 21a2 2 0 0 0 3.464 0'], ['path', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326']],
  circleCheck: [['circle', '12,12,10'], ['path', 'm9 12 2 2 4-4']],
  pencil: [['path', 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'], ['path', 'm15 5 4 4']],
  trash: [['path', 'M10 11v6'], ['path', 'M14 11v6'], ['path', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'], ['path', 'M3 6h18'], ['path', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2']],
  arrowRight: [['path', 'M5 12h14'], ['path', 'm12 5 7 7-7 7']],
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, strokeWidth = 2, className, style }: {
  name: IconName | string
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}) {
  const shapes = PATHS[name]
  if (!shapes) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {shapes.map((s, i) => {
        if (s[0] === 'path') return <path key={i} d={s[1]} />
        if (s[0] === 'circle') { const [cx, cy, r] = s[1].split(',').map(Number); return <circle key={i} cx={cx} cy={cy} r={r} /> }
        const [x, y, w, h, rx] = s[1].split(',').map(Number)
        return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />
      })}
    </svg>
  )
}
