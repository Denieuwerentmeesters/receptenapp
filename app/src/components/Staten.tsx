import type { ReactNode } from 'react'
import { Button, Icon } from '../ds'
import { Titel, useOnderRuimte } from './Layout'
import { LaadScherm } from './Laadanimatie'
import { foutTekst } from '../lib/fouten'

/**
 * Systeemschermen uit `Systeemschermen.dc.html`. Ze zijn hier één component met
 * varianten in plaats van vier losse schermen, omdat ze alleen in tekst en
 * icoon verschillen.
 */

export function Laden({ tekst }: { tekst?: string }) {
  // Een snufje zout valt op het logo (components/Laadanimatie.tsx). Geen
  // "Even geduld" meer: de animatie zegt het al.
  return <LaadScherm kleur="rood" tekst={tekst} />
}

export function Leeg({ icoon, kop, tekst, knop, onKnop }: {
  icoon: string
  kop: string
  tekst: string
  knop?: string
  onKnop?: () => void
}) {
  // De onderbalk ligt over de onderkant heen; centreer boven die balk.
  const ruimte = useOnderRuimte()
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 14, padding: `32px 30px ${32 + ruimte}px`, textAlign: 'center',
    }}>
      <div style={{
        width: 76, height: 76, borderRadius: 'var(--radius-full)', background: 'var(--c-paper)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icoon} size={30} />
      </div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, lineHeight: 1,
        margin: '6px 0 0', textTransform: 'uppercase', color: 'var(--color-ink)',
      }}>{kop}</h2>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, margin: 0,
        maxWidth: 280, color: 'rgba(20,20,20,0.6)',
      }}>{tekst}</p>
      {knop && (
        <Button onClick={onKnop} style={{ marginTop: 10, width: '100%', maxWidth: 280, padding: '17px 24px' }}>
          {knop}
        </Button>
      )}
    </div>
  )
}

/**
 * Foutscherm. De tekst vermijdt schuldtaal en zegt expliciet dat er niets kwijt
 * is — dat is de belangrijkste informatie op dit moment.
 */
export function Fout({ kop, tekst, stappen, onOpnieuw, onTerug }: {
  kop: string
  tekst: string
  stappen?: string[]
  onOpnieuw?: () => void
  onTerug?: () => void
}) {
  const ruimte = useOnderRuimte()
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'var(--c-red-bright)', color: 'var(--c-cream)',
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 14, padding: '60px 26px 0',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius-full)', background: 'var(--c-yellow)',
          color: 'var(--c-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28,
        }}>!</div>
        <Titel grootte={30}>{kop}</Titel>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, margin: 0, maxWidth: 300 }}>
          {tekst}
        </p>
        {stappen && (
          <div style={{ marginTop: 8 }}>
            {stappen.map((stap, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '11px 0',
                borderBottom: '1.5px solid rgba(255,246,232,0.3)',
              }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--c-yellow)' }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5 }}>{stap}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', padding: `22px 26px ${44 + ruimte}px`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button tone="yellow" onClick={onOpnieuw} style={{ width: '100%', padding: '17px 24px' }}>
          Opnieuw proberen
        </Button>
        {onTerug && (
          <button onClick={onTerug} style={{
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--c-cream)',
            background: 'transparent', border: 'none', padding: 12, cursor: 'pointer',
          }}>Terug naar mijn lijst</button>
        )}
      </div>
    </div>
  )
}

export function Grens({ query, children, ladenTekst }: {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => void }
  children: ReactNode
  ladenTekst?: string
}) {
  if (query.isPending) return <Laden tekst={ladenTekst} />
  if (query.isError) {
    return (
      <Fout
        kop="Even geen verbinding"
        tekst={foutTekst(query.error)}
        onOpnieuw={() => query.refetch()}
      />
    )
  }
  return <>{children}</>
}
