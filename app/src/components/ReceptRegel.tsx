import { Icon } from '../ds'
import type { Recept } from '../lib/database.types'
import { tokoIngredienten } from '../lib/toko'

/** De twee roodtinten wisselen af — het merkritme uit de designs. */
const VLAKKEN = ['var(--c-red)', 'var(--c-red-bright)']

/**
 * Horizontale receptregel: fotovlak, titel, meta, en rechts een actie.
 * Terugkerend patroon in Ontdekken, Favorieten, Vandaag en Geschiedenis.
 */
export function ReceptRegel({ recept, index = 0, favoriet, onOpen, onFavoriet, actie, actieKleur }: {
  recept: Recept
  index?: number
  favoriet?: boolean
  onOpen?: () => void
  onFavoriet?: () => void
  actie?: string
  actieKleur?: string
}) {
  const vega = recept.tags.includes('vegetarisch')
  const meta = [
    recept.bereidingstijd_minuten ? `${recept.bereidingstijd_minuten} min` : null,
    vega ? 'vegetarisch' : recept.keuken,
    tokoIngredienten(recept.ingredienten).length > 0 ? 'toko nodig' : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, background: 'var(--c-paper)',
      borderRadius: 'var(--radius-md)', padding: 12,
    }}>
      <button
        onClick={onOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0,
          background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{
          flex: 'none', width: 60, height: 60, borderRadius: 'var(--radius-sm)',
          background: recept.afbeelding_url
            ? `url(${recept.afbeelding_url}) center/cover`
            : VLAKKEN[index % VLAKKEN.length],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '.08em',
          textTransform: 'uppercase', color: 'var(--c-cream)',
        }}>{recept.afbeelding_url ? '' : 'foto'}</span>

        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--color-ink)',
          }}>{recept.titel_nl ?? recept.titel}</span>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(20,20,20,0.6)',
          }}>{meta}</span>
        </span>
      </button>

      {actie && (
        <span style={{
          flex: 'none', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
          color: actieKleur ?? 'var(--c-red-bright)',
        }}>{actie}</span>
      )}

      {onFavoriet && (
        <button
          onClick={onFavoriet}
          aria-label={favoriet ? 'Uit favorieten' : 'Bewaren als favoriet'}
          style={{
            flex: 'none', width: 36, height: 36, borderRadius: 'var(--radius-full)',
            border: '1.5px solid rgba(20,20,20,0.14)', background: favoriet ? 'var(--c-red)' : 'transparent',
            color: favoriet ? 'var(--c-cream)' : 'var(--c-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'background var(--motion-fast) var(--ease)',
          }}
        ><Icon name="heart" size={16} /></button>
      )}
    </div>
  )
}
