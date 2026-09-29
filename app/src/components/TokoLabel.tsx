/**
 * Klein label op een receptfoto: voor dit recept heb je iets van de toko nodig,
 * dat AH en Jumbo niet hebben. Zo weet je het al bij het kiezen, niet pas als
 * je mandje half leeg blijkt.
 */
export function TokoLabel() {
  return (
    <span style={{
      position: 'absolute', top: 8, left: 8, zIndex: 1, pointerEvents: 'none',
      background: 'var(--c-ink)', color: 'var(--c-yellow)', borderRadius: 'var(--radius-full)',
      padding: '4px 9px', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
      letterSpacing: '.06em', textTransform: 'uppercase',
    }}>Toko</span>
  )
}
