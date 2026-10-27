import { useState } from 'react'
import { Button } from '../ds'
import { cijferBetekenis } from '../lib/beoordeling'

export interface CijferAntwoord {
  cijfer: number | null
  notitie: string
}

/** "di 27 okt": de dag waarop je kookte. */
function dagLabel(nu = new Date()): string {
  return nu.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
}

/**
 * "Viel het in de smaak?": het blad dat opschuift als een recept op gekookt
 * gaat (kruisje bij Te koken, einde van de kookmodus). Een cijfer van 1 tot 10
 * en een notitie voor de volgende keer, allebei niet verplicht.
 *
 * - Klaar zet het recept op gekookt, met wat je invulde. Zonder cijfer blijft
 *   het cijfer leeg; het wordt niet stiekem een 6.
 * - Sla over zet het recept op gekookt, zonder iets te bewaren. Je kunt het
 *   later nog doen bij Eerder gekookt.
 * - Tik naast het blad: niets gebeurt, het recept is nog niet gekookt.
 *
 * Het blad onthoudt niets tussen twee keer openen: de ouder rendert het alleen
 * als er een recept is (`key` per recept).
 */
export function CijferSheet({ recept, personen, gekooktOp, beginCijfer = null, beginNotitie = '', onKlaar, onOverslaan, onSluit, bezig = false }: {
  recept: { titel: string; titel_nl: string | null; afbeelding_url: string | null }
  personen: number
  /** Voor een cijfer achteraf: de dag waarop je kookte. Standaard vandaag. */
  gekooktOp?: Date
  beginCijfer?: number | null
  beginNotitie?: string
  onKlaar: (antwoord: CijferAntwoord) => void
  onOverslaan: () => void
  onSluit: () => void
  bezig?: boolean
}) {
  const [cijfer, setCijfer] = useState<number | null>(beginCijfer)
  const [notitie, setNotitie] = useState(beginNotitie)
  const titel = recept.titel_nl ?? recept.titel

  return (
    <div
      role="presentation"
      onClick={onSluit}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh',
        zIndex: 50, background: 'rgba(43,20,32,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Viel het in de smaak?"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, background: 'var(--c-cream)', boxSizing: 'border-box',
          borderRadius: '24px 24px 0 0', padding: '24px 22px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '100dvh', overflowY: 'auto',
        }}
      >
        <div>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--c-red)',
          }}>Gekookt</span>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, lineHeight: 1,
            margin: '6px 0 0', textTransform: 'uppercase', color: 'var(--color-ink)',
          }}>Viel het in de smaak?</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            flex: 'none', width: 48, height: 48, borderRadius: 12, background: 'var(--c-red)',
            ...(recept.afbeelding_url ? { background: `url(${recept.afbeelding_url}) center/cover` } : {}),
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, lineHeight: 1.1,
              textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{titel}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(43,20,32,0.6)', marginTop: 2 }}>
              Gekookt op {dagLabel(gekooktOp)} · {personen} {personen === 1 ? 'persoon' : 'personen'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div role="group" aria-label="Cijfer van 1 tot 10" style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 44px)', gap: 8, flex: 'none',
          }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const gekozen = cijfer === n
              return (
                <button
                  key={n}
                  aria-pressed={gekozen}
                  aria-label={String(n)}
                  // Nog een tik op het gekozen cijfer maakt het weer leeg.
                  onClick={() => setCijfer(gekozen ? null : n)}
                  style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-full)', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
                    border: `1.5px solid ${gekozen ? 'var(--c-red)' : 'rgba(43,20,32,0.18)'}`,
                    background: gekozen ? 'var(--c-red)' : 'var(--c-paper)',
                    color: gekozen ? 'var(--c-paper)' : 'var(--c-ink)',
                  }}
                >{n}</button>
              )
            })}
          </div>
          <div style={{ minWidth: 0, flex: 1 }} aria-live="polite">
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 44, lineHeight: 1,
              color: 'var(--c-red)', minHeight: 44,
            }}>{cijfer ?? ''}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.3, color: 'rgba(43,20,32,0.6)', marginTop: 4 }}>
              {cijfer ? cijferBetekenis(cijfer) : 'Tik een cijfer, of laat het leeg'}
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700 }}>Notitie voor de volgende keer</span>
          <textarea
            value={notitie}
            onChange={(e) => setNotitie(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Bijvoorbeeld: minder chili, dubbele bonen"
            style={{
              // 16px: kleiner zoomt iOS Safari in bij focus.
              fontFamily: 'var(--font-body)', fontSize: 16, padding: '10px 12px', resize: 'none',
              borderRadius: 'var(--radius-md)', border: '1.5px solid rgba(43,20,32,0.18)',
              background: 'var(--c-paper)', color: 'var(--c-ink)', boxSizing: 'border-box', width: '100%',
            }}
          />
        </label>

        <Button
          variant="primary"
          disabled={bezig}
          onClick={() => onKlaar({ cijfer, notitie })}
          style={{ width: '100%', padding: '15px 24px' }}
        >Klaar</Button>
        <button
          onClick={onOverslaan}
          disabled={bezig}
          style={{
            alignSelf: 'center', background: 'none', border: 'none', padding: '4px 16px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'rgba(43,20,32,0.6)',
          }}
        >Sla over</button>
      </div>
    </div>
  )
}
