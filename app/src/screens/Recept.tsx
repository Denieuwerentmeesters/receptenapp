import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, IconButton } from '../ds'
import { Inhoud, Kop, Label, Scherm, Titel, Voet } from '../components/Layout'
import { Grens } from '../components/Staten'
import { useKiesRecept, useRecept, useVoorkeuren, useVoorkeurenOpslaan } from '../lib/queries'
import { schaalIngredienten } from '../lib/schaal'
import { weekStart } from '../lib/week'

export function Recept() {
  const { id } = useParams<{ id: string }>()
  const navigeer = useNavigate()
  const recept = useRecept(id)
  const voorkeuren = useVoorkeuren()
  const opslaan = useVoorkeurenOpslaan()
  const kies = useKiesRecept(weekStart())

  // Lokale overschrijving: je kunt per recept even schuiven met het aantal
  // personen zonder je vaste voorkeur te veranderen.
  const [lokaalPersonen, setLokaalPersonen] = useState<number | null>(null)
  const personen = lokaalPersonen ?? voorkeuren.data?.aantal_personen ?? 4

  return (
    <Scherm>
      <Grens query={recept} ladenTekst="Recept ophalen">
        {recept.data && (() => {
          const r = recept.data
          const ingredienten = schaalIngredienten(r.ingredienten, r.personen, personen)
          const vegetarisch = r.tags.includes('vegetarisch')

          return (
            <>
              <Kop kleur="var(--c-red-bright)" style={{ padding: 'calc(env(safe-area-inset-top) + 20px) 22px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <IconButton
                    icon="chevronLeft" label="Terug" size={36} onClick={() => navigeer(-1)}
                    style={{ background: 'rgba(255,246,232,0.22)', color: 'var(--c-cream)' }}
                  />
                </div>

                <div style={{
                  height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '16px 0 0', borderRadius: 'var(--radius-md)',
                  background: r.afbeelding_url ? `url(${r.afbeelding_url}) center/cover` : 'var(--c-red)',
                  fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
                }}>
                  {r.afbeelding_url ? '' : 'foto'}
                </div>

                <div style={{ marginTop: 18 }}>
                  <Label>{r.keuken ?? 'Recept'}{vegetarisch ? ' · vegetarisch' : ''}</Label>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Titel>{r.titel_nl ?? r.titel}</Titel>
                </div>
                <div style={{
                  display: 'flex', gap: 16, marginTop: 14,
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                }}>
                  <span>{r.bereidingstijd_minuten ?? '?'} min</span>
                  <span>{personen} {personen === 1 ? 'persoon' : 'personen'}</span>
                  <span>{r.ingredienten.length} ingrediënten</span>
                </div>
              </Kop>

              <Inhoud style={{ gap: 8, padding: '20px 22px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)',
                  }}>Ingrediënten</span>

                  {/* Portieschaling: on the fly, we slaan nooit herschaalde
                      hoeveelheden op — alleen de basis plus je voorkeur. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <IconButton
                      icon="minus" label="Minder personen" size={32}
                      onClick={() => setLokaalPersonen(Math.max(1, personen - 1))}
                      style={{ background: 'transparent', color: 'var(--c-ink)', border: '1.5px solid rgba(20,20,20,0.2)' }}
                    />
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                      minWidth: 64, textAlign: 'center',
                    }}>{personen} pers.</span>
                    <IconButton
                      icon="plus" label="Meer personen" size={32}
                      onClick={() => setLokaalPersonen(Math.min(12, personen + 1))}
                      style={{ background: 'var(--c-red)', color: 'var(--c-cream)' }}
                    />
                  </div>
                </div>

                {ingredienten.map((ing, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 2px',
                    borderBottom: '1.5px solid rgba(20,20,20,0.12)',
                  }}>
                    <span style={{
                      flex: 'none', width: 88, fontFamily: 'var(--font-body)', fontSize: 14,
                      fontWeight: 700, color: 'var(--c-red-bright)',
                    }}>{ing.weergave}</span>
                    <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 15 }}>{ing.naam}</span>
                  </div>
                ))}

                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)', marginTop: 18,
                }}>Zo maak je het</div>

                {r.bereiding_nl.map((stap, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
                    <span style={{
                      flex: 'none', width: 28, height: 28, borderRadius: 'var(--radius-full)',
                      background: 'var(--c-ink)', color: 'var(--c-yellow)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                    }}>{i + 1}</span>
                    <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5 }}>
                      {stap}
                    </span>
                  </div>
                ))}

              </Inhoud>

              <Voet>
                <Button
                  onClick={() => {
                    // Het aantal personen dat je hier koos wordt je voorkeur, zodat
                    // de boodschappenlijst met dezelfde hoeveelheden werkt.
                    if (lokaalPersonen && lokaalPersonen !== voorkeuren.data?.aantal_personen) {
                      opslaan.mutate({ aantal_personen: lokaalPersonen })
                    }
                    kies.mutate({ receptId: r.id, kiezen: true })
                    navigeer('/boodschappen')
                  }}
                  style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
                >
                  Zet op de boodschappenlijst
                </Button>
              </Voet>
            </>
          )
        })()}
      </Grens>
    </Scherm>
  )
}
