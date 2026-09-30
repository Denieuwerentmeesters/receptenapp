import { Button } from '../ds'

export interface DialoogActie {
  label: string
  onClick: () => void
  /** De hoofdactie is een volle knop; de rest een omlijnde. */
  hoofd?: boolean
}

/**
 * Een vraag die onderin het scherm opschuift, met de acties onder elkaar —
 * groot genoeg voor een duim, ook met natte handen in de keuken.
 * Tik naast de vraag om 'm te sluiten zonder iets te doen.
 */
export function Dialoog({ open, kop, tekst, acties, onSluit, children }: {
  open: boolean
  kop: string
  tekst?: string
  /** Extra inhoud tussen de tekst en de knoppen, zoals een lijstje of een bronvermelding. */
  children?: React.ReactNode
  acties: DialoogActie[]
  onSluit: () => void
}) {
  if (!open) return null
  return (
    <div
      role="presentation"
      onClick={onSluit}
      style={{
        // Niet `inset: 0`: in iOS Safari loopt dat door tot onder de zwevende
        // adresbalk en valt de onderste knop erachter. 100dvh is het zichtbare deel.
        position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh',
        zIndex: 50, background: 'rgba(20,20,20,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={kop}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, background: 'var(--c-cream)',
          borderRadius: '24px 24px 0 0', padding: '24px 22px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, lineHeight: 1,
          margin: 0, textTransform: 'uppercase', color: 'var(--color-ink)',
        }}>{kop}</h2>
        {tekst && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, margin: '0 0 6px',
            color: 'rgba(20,20,20,0.7)',
          }}>{tekst}</p>
        )}
        {children}
        {acties.map((actie) => (
          <Button
            key={actie.label}
            variant={actie.hoofd ? 'primary' : 'secondary'}
            onClick={actie.onClick}
            style={{ width: '100%', padding: '15px 24px' }}
          >{actie.label}</Button>
        ))}
      </div>
    </div>
  )
}
