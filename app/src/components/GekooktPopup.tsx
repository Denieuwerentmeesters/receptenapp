import { useEffect, useState } from 'react'
import { Button } from '../ds'
import type { FaseRecept } from '../lib/fases'
import { useBeoordelingBewaren } from '../lib/beoordeling'
import { receptTitel } from '../lib/receptTaal'
import { useWeekWissel } from '../lib/weekwissel'
import { t } from '../lib/taal'

/** Vanaf zoveel recepten bij Te koken vragen we of je ze gekookt hebt. */
export const GEKOOKT_DREMPEL = 8

/**
 * De oudste bestelling eerst: wat het langst geleden besteld is, is het
 * waarschijnlijkst al gekookt. Zonder datum onderaan.
 */
export function oudsteEerst(recepten: readonly FaseRecept[]): FaseRecept[] {
  return [...recepten].sort((a, b) => (a.besteldOp ?? '9999').localeCompare(b.besteldOp ?? '9999'))
}

/** Of de popup in deze keer-openen al weggeklikt is. Bij terugkeren in de app weer vrij. */
let weggeklikt = false

/**
 * "Recepten gekookt?": staan er {@link GEKOOKT_DREMPEL} of meer recepten bij
 * Te koken, dan vragen we bij het openen van de app (ook via de weekmenu-melding)
 * welke je al gekookt hebt. Per recept een cijfer, dat zet het op gekookt en van
 * de lijst, precies als het kruisje bij Te koken; "Niet beoordeeld" zet het
 * zonder cijfer op gekookt. Sluiten kan altijd en laat alles staan.
 */
export function GekooktPopup({ teKoken, geladen }: { teKoken: readonly FaseRecept[]; geladen: boolean }) {
  const [dicht, setDicht] = useState(weggeklikt)
  const { gekookt } = useWeekWissel()
  const bewaar = useBeoordelingBewaren()

  // Kom je later terug in de app, dan mag de vraag weer.
  useEffect(() => {
    const terug = () => { if (document.visibilityState === 'visible') { weggeklikt = false; setDicht(false) } }
    document.addEventListener('visibilitychange', terug)
    return () => document.removeEventListener('visibilitychange', terug)
  }, [])

  const sluit = () => { weggeklikt = true; setDicht(true) }
  const rijen = oudsteEerst(teKoken)
  // De vraag begint bij 8; tijdens het afvinken blijft hij staan tot je klaar bent of sluit.
  const [begonnen, setBegonnen] = useState(false)
  useEffect(() => { if (geladen && teKoken.length >= GEKOOKT_DREMPEL) setBegonnen(true) }, [geladen, teKoken.length])
  if (dicht || !begonnen || rijen.length === 0) return null

  const klaar = (r: FaseRecept, cijfer: number | null) => {
    gekookt.mutate({ receptId: r.id, opruimen: true, inWeek: r.week })
    if (cijfer != null) bewaar.mutate({ receptId: r.id, cijfer, notitie: '' })
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', zIndex: 60,
        background: 'rgba(43,20,32,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Recepten gekookt?')}
        style={{
          width: '100%', maxWidth: 520, background: 'var(--c-cream)', boxSizing: 'border-box',
          borderRadius: '24px 24px 0 0', padding: '20px 18px calc(16px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '88dvh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, lineHeight: 1,
              margin: 0, textTransform: 'uppercase', color: 'var(--color-ink)',
            }}>{t('Recepten gekookt?')}</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.35, margin: '6px 0 0', color: 'rgba(43,20,32,0.7)' }}>
              {t('Je hebt {n} recepten bij Te koken. Geef een cijfer aan wat je kookte: dan gaat het van je lijst. De oudste staan bovenaan.', { n: rijen.length })}
            </p>
          </div>
          <button
            onClick={sluit}
            aria-label={t('Sluit')}
            style={{
              flex: 'none', width: 40, height: 40, borderRadius: 'var(--radius-full)', cursor: 'pointer',
              border: '1.5px solid rgba(43,20,32,0.18)', background: 'var(--c-paper)', color: 'var(--c-ink)',
              fontSize: 20, lineHeight: 1,
            }}
          >×</button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {rijen.map((r) => (
            <div key={r.id} style={{
              background: 'var(--c-paper)', borderRadius: 16, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  flex: 'none', width: 40, height: 40, borderRadius: 10, background: 'var(--c-red)',
                  ...(r.afbeelding_url ? { background: `url(${r.afbeelding_url}) center/cover` } : {}),
                }} />
                <div style={{
                  flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, lineHeight: 1.1,
                  textTransform: 'uppercase',
                }}>{receptTitel(r)}</div>
                <button
                  onClick={() => klaar(r, null)}
                  style={{
                    flex: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px',
                    fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'rgba(43,20,32,0.6)',
                  }}
                >{t('Zonder cijfer')}</button>
              </div>
              <div role="group" aria-label={t('Cijfer van 1 tot 10')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    aria-label={String(n)}
                    onClick={() => klaar(r, n)}
                    style={{
                      width: 'calc((100% - 54px) / 10)', minWidth: 28, aspectRatio: '1', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, padding: 0,
                      border: '1.5px solid rgba(43,20,32,0.18)', background: 'var(--c-cream)', color: 'var(--c-ink)',
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button variant="primary" onClick={sluit} style={{ width: '100%', padding: '15px 24px' }}>{t('Later doen')}</Button>
      </div>
    </div>
  )
}
