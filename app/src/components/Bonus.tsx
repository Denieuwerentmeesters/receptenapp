import { useState } from 'react'
import { Dialoog } from './Dialoog'
import { BONUS_BRON, actieTekst, type BonusActie } from '../lib/bonus'

/**
 * Bronvermelding onder alle bonusinformatie. Verplicht bij het gratis gebruik
 * van PrijsProfeet (API-voorwaarden art. 6), en we willen het ook zelf: de
 * prijs in je mandje bij AH of Jumbo is leidend, niet de onze.
 */
export function BonusBron({ klein = false }: { klein?: boolean }) {
  return (
    <a
      href={BONUS_BRON.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontFamily: 'var(--font-body)', fontSize: klein ? 11 : 12, color: 'rgba(20,20,20,0.55)',
        textDecoration: 'underline', textUnderlineOffset: 2,
      }}
    >{BONUS_BRON.kort}</a>
  )
}

/**
 * "Bonus" op een receptfoto: het hoofdingrediënt is in de bonus bij jouw
 * winkel. Tik erop voor welke producten en welke actie.
 */
export function BonusLabel({ naam, acties }: { naam: string; acties: BonusActie[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        aria-label={`${naam} is in de bonus`}
        style={{
          position: 'absolute', left: 8, bottom: 8, zIndex: 1, border: 'none', cursor: 'pointer',
          background: 'var(--c-yellow)', color: 'var(--c-ink)', borderRadius: 'var(--radius-full)',
          padding: '4px 9px', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
          letterSpacing: '.06em', textTransform: 'uppercase', boxShadow: '0 1px 4px rgba(20,20,20,0.18)',
        }}
      >Bonus</button>
      <Dialoog
        open={open}
        kop="In de bonus"
        tekst={`${naam.charAt(0).toUpperCase()}${naam.slice(1)} is deze week in de aanbieding bij je winkel:`}
        onSluit={() => setOpen(false)}
        acties={[{ label: 'Sluiten', hoofd: true, onClick: () => setOpen(false) }]}
      >
        <ul style={{ margin: '0 0 4px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {acties.slice(0, 4).map((a, i) => (
            <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4 }}>{actieTekst(a)}</li>
          ))}
        </ul>
        <BonusBron />
      </Dialoog>
    </>
  )
}
