import { useState } from 'react'
import { Dialoog } from './Dialoog'
import { BONUS_BRON, actieTekst, type BonusProduct } from '../lib/bonus'
import { t } from '../lib/taal'

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
        fontFamily: 'var(--font-body)', fontSize: klein ? 11 : 12, color: 'rgba(43,20,32,0.55)',
        textDecoration: 'underline', textUnderlineOffset: 2,
      }}
    >{BONUS_BRON.kort}</a>
  )
}

/**
 * "Bonus" op een receptfoto: een of meer producten van het recept zijn in de
 * bonus bij jouw winkel. Tik erop voor welke producten en welke actie.
 */
export function BonusLabel({ producten }: { producten: BonusProduct[] }) {
  const [open, setOpen] = useState(false)
  if (producten.length === 0) return null
  const een = producten.length === 1
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        aria-label={een ? t('Een product van dit recept is in de bonus') : t('{n} producten van dit recept zijn in de bonus', { n: producten.length })}
        style={{
          position: 'absolute', left: 8, bottom: 8, zIndex: 1, border: 'none', cursor: 'pointer',
          background: 'var(--c-yellow)', color: 'var(--c-ink)', borderRadius: 'var(--radius-full)',
          padding: '4px 9px', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
          letterSpacing: '.06em', textTransform: 'uppercase', boxShadow: '0 1px 4px rgba(43,20,32,0.18)',
        }}
      >{t('Bonus')}</button>
      <Dialoog
        open={open}
        kop={t('In de bonus')}
        tekst={een
          ? t('Een product van dit recept is deze week in de aanbieding bij je winkel:')
          : t('{n} producten van dit recept zijn deze week in de aanbieding bij je winkel:', { n: producten.length })}
        onSluit={() => setOpen(false)}
        acties={[{ label: t('Sluiten'), hoofd: true, onClick: () => setOpen(false) }]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '0 0 4px' }}>
          {producten.map((p) => (
            <div key={p.naam}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700 }}>
                {p.naam.charAt(0).toUpperCase()}{p.naam.slice(1)}
              </div>
              <ul style={{ margin: '2px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.acties.slice(0, 3).map((a, i) => (
                  <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4 }}>{actieTekst(a)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <BonusBron />
      </Dialoog>
    </>
  )
}
