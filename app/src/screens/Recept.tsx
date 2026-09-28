import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, IconButton } from '../ds'
import { Inhoud, Kop, Label, Scherm, Titel, Voet } from '../components/Layout'
import { Grens } from '../components/Staten'
import { useOpLijst } from '../components/OpLijst'
import { useDezeWeek, useRecept, useVoorkeuren, useVoorkeurenOpslaan } from '../lib/queries'
import { useFavorietIds, useFavorietToggle } from '../lib/queries2'
import { schaalIngredienten } from '../lib/schaal'
import { weekStart } from '../lib/week'

export function Recept() {
  const { id } = useParams<{ id: string }>()
  const navigeer = useNavigate()
  const recept = useRecept(id)
  const voorkeuren = useVoorkeuren()
  const opslaan = useVoorkeurenOpslaan()
  const week = weekStart()
  const dezeWeek = useDezeWeek(week)
  const { voegToe, dialoog, bezig } = useOpLijst(week)
  // Favorieten wegen mee in het weekmenu. Het hartje in Ontdekken betekent
  // "in je week"; hier bewaar je een recept voor later.
  const favorieten = useFavorietIds()
  const favToggle = useFavorietToggle()
  const favoriet = Boolean(id && favorieten.data?.[id])

  // Hoe dit recept in je week staat. Komt het uit Ontdekken en heb je het
  // nog niet gekozen, dan staat het er niet in — dat is gewoon "niet gekozen".
  const inWeek = dezeWeek.data?.find((r) => r.id === id)
  const gekozen = inWeek?.gekozen ?? false
  const opLijst = inWeek?.opLijst ?? false

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
                  <IconButton
                    icon="heart" label={favoriet ? 'Uit favorieten' : 'Bewaren als favoriet'} size={36}
                    onClick={() => favToggle.mutate({ receptId: r.id, favoriet: !favoriet })}
                    style={{
                      background: favoriet ? 'var(--c-cream)' : 'rgba(255,246,232,0.22)',
                      color: favoriet ? 'var(--c-red-bright)' : 'var(--c-cream)',
                    }}
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant={opLijst ? 'secondary' : 'primary'}
                    disabled={bezig || dezeWeek.isPending}
                    icon={opLijst ? 'check' : 'plus'}
                    onClick={() => {
                      // Het aantal personen dat je hier koos wordt je voorkeur, zodat
                      // de boodschappenlijst met dezelfde hoeveelheden werkt.
                      if (lokaalPersonen && lokaalPersonen !== voorkeuren.data?.aantal_personen) {
                        opslaan.mutate({ aantal_personen: lokaalPersonen })
                      }
                      voegToe({
                        id: r.id,
                        titel: r.titel_nl ?? r.titel,
                        gekozen,
                        opLijst,
                        aantal: inWeek?.aantal ?? 0,
                      })
                    }}
                    style={{ flex: 1, padding: '17px 20px', fontSize: 16 }}
                  >
                    {opLijst
                      ? (inWeek && inWeek.aantal > 1 ? `Op je lijst · ${inWeek.aantal}x` : 'Op je lijst')
                      : 'Zet op de boodschappenlijst'}
                  </Button>
                  {gekozen && (
                    <Button
                      tone="yellow"
                      onClick={() => navigeer(`/koken/${r.id}`)}
                      style={{ flex: 'none', padding: '17px 20px', fontSize: 16 }}
                    >Koken</Button>
                  )}
                </div>
                {opLijst && (
                  <button
                    onClick={() => navigeer('/boodschappen')}
                    style={{
                      display: 'block', width: '100%', marginTop: 8, padding: 6, border: 'none',
                      background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)',
                      fontSize: 13, fontWeight: 700, color: 'var(--c-red)',
                    }}
                  >Bekijk je boodschappenlijst</button>
                )}
              </Voet>
              {dialoog}
            </>
          )
        })()}
      </Grens>
    </Scherm>
  )
}
