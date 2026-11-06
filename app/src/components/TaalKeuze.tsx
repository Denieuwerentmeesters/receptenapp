import { useTaal, zetTaal, type Taal } from '../lib/taal'

const OPTIES: [Taal, string][] = [['nl', 'Nederlands'], ['en', 'English']]

/** Wissel tussen Nederlands en English. `opRood` voor de rode welkomstkaart. */
export function TaalKeuze({ opRood = false }: { opRood?: boolean }) {
  const huidig = useTaal()
  return (
    <div role="radiogroup" aria-label="Taal / Language" style={{
      display: 'flex', flex: 'none', padding: 3, gap: 2, borderRadius: 'var(--radius-full)',
      background: opRood ? 'rgba(255,255,255,0.18)' : 'rgba(43,20,32,0.08)',
    }}>
      {OPTIES.map(([w, label]) => {
        const gekozen = w === huidig
        return (
          <button
            key={w} role="radio" aria-checked={gekozen}
            onClick={() => zetTaal(w)}
            style={{
              border: 'none', borderRadius: 'var(--radius-full)', padding: '7px 14px', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              background: gekozen ? (opRood ? 'var(--c-cream)' : 'var(--c-paper)') : 'transparent',
              color: gekozen ? 'var(--c-ink, #2b1420)' : (opRood ? 'var(--c-cream)' : 'rgba(43,20,32,0.6)'),
            }}
          >{label}</button>
        )
      })}
    </div>
  )
}
