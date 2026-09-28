import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Icon, IconButton } from '../ds'
import { Inhoud, Label, Scherm, Titel, Voet } from '../components/Layout'
import { Grens } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { useOpLijst } from '../components/OpLijst'
import { useDezeWeek, useLijstActies, useRecept, useVoorkeuren, useVoorkeurenOpslaan } from '../lib/queries'
import { isBudget } from '../lib/prijsschatting'
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
  // Het hartje werkt hier net als in Ontdekken: het recept in "Deze week" zetten.
  const { zetInWeek, haalUitWeek } = useLijstActies(week)
  const [wegVraag, setWegVraag] = useState(false)

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
              {/* Alleen de statusbalk blijft staan; de rest scrollt mee met het
                  recept, zodat de ingrediënten daarna de ruimte krijgen. */}
              <div style={{ flex: 'none', height: 'env(safe-area-inset-top)', background: 'var(--c-ink)' }} />

              <Inhoud style={{ gap: 0, padding: 0 }}>
                {/* De foto is de verleiding: groot, met titel en knoppen erin.
                    Twee verlopen houden tekst en knoppen leesbaar op elke foto. */}
                <div style={{
                  position: 'relative', flex: 'none', height: 'min(64dvh, 560px)', minHeight: 340,
                  background: r.afbeelding_url ? `url(${r.afbeelding_url}) center/cover` : 'var(--c-red-bright)',
                  color: 'var(--c-paper)',
                }}>
                  <div aria-hidden style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.78) 100%)',
                  }} />

                  <div style={{
                    position: 'absolute', top: 16, left: 16, right: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                    <IconButton
                      icon="chevronLeft" label="Terug" size={42} onClick={() => navigeer(-1)}
                      style={{ background: 'rgba(20,20,20,0.5)', color: 'var(--c-paper)', backdropFilter: 'blur(8px)' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {inWeek && (
                        <span style={{
                          padding: '8px 12px', borderRadius: 'var(--radius-full)',
                          background: 'rgba(20,20,20,0.5)', backdropFilter: 'blur(8px)',
                          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                        }}>{opLijst ? 'Op je lijst' : "In 'Deze week'"}</span>
                      )}
                      <IconButton
                        icon="heart" size={42}
                        label={inWeek ? 'Uit deze week halen' : 'In deze week zetten'}
                        onClick={() => {
                          if (!inWeek) zetInWeek.mutate(r)
                          else if (opLijst) setWegVraag(true)
                          else haalUitWeek.mutate(r.id)
                        }}
                        style={{
                          background: inWeek ? 'var(--c-red-bright)' : 'rgba(20,20,20,0.5)',
                          color: 'var(--c-paper)', backdropFilter: 'blur(8px)',
                        }}
                      />
                    </div>
                  </div>

                  {!r.afbeelding_url && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0.5,
                    }}><Icon name="utensils" size={48} /></div>
                  )}

                  <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22 }}>
                    <Label>
                      {r.keuken ?? 'Recept'}{vegetarisch ? ' · vegetarisch' : ''}{isBudget(r) ? ' · budget' : ''}
                    </Label>
                    <div style={{ marginTop: 8, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>
                      <Titel grootte={30}>{r.titel_nl ?? r.titel}</Titel>
                    </div>
                    <div style={{
                      display: 'flex', gap: 16, marginTop: 12,
                      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Icon name="clock" size={14} />{r.bereidingstijd_minuten ?? '?'} min
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Icon name="users" size={14} />{personen} {personen === 1 ? 'persoon' : 'personen'}
                      </span>
                      <span>{r.ingredienten.length} ingrediënten</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 22px 8px' }}>
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

                </div>
              </Inhoud>

              <Voet meeschuiven>
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
              <Dialoog
                open={wegVraag}
                kop="Uit je week halen?"
                tekst={`${r.titel_nl ?? r.titel} staat op je boodschappenlijst. De ingrediënten gaan er dan ook af.`}
                onSluit={() => setWegVraag(false)}
                acties={[
                  { label: 'Ja, haal weg', hoofd: true, onClick: () => { haalUitWeek.mutate(r.id); setWegVraag(false) } },
                  { label: 'Laat maar', onClick: () => setWegVraag(false) },
                ]}
              />
            </>
          )
        })()}
      </Grens>
    </Scherm>
  )
}
