import { useState } from 'react'
import { useHartje } from '../components/Hartje'
import { useQueryClient } from '@tanstack/react-query'
import type { ReceptAllergie } from '../lib/allergenen'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Icon, IconButton } from '../ds'
import { Inhoud, Label, Scherm, Titel, Voet } from '../components/Layout'
import { Grens } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { useOpLijst } from '../components/OpLijst'
import { sleutels, useDezeWeek, useRecept, useVoorkeuren, useVoorkeurenOpslaan } from '../lib/queries'
import { deel, deelLink, heeftDeelvenster, heeftLink, maakDeellink, magDelen, whatsappLink } from '../lib/delen'
import { foutTekst } from '../lib/fouten'
import { isBudget } from '../lib/prijsschatting'
import { ingredientKey, schaalIngredienten } from '../lib/schaal'
import { weekStart } from '../lib/week'
import { tokoIngredienten, tokoProduct } from '../lib/toko'
import { openBijWinkel } from '../lib/ah'
import { dieetLabels } from '../lib/dieet'
import { allergeenNaam, opsomming, receptAllergie, useAllergeenRegels, useAllergieen } from '../lib/allergenen'
import { BonusBron } from '../components/Bonus'
import { receptBonusProducten, totTekst, useBonus } from '../lib/bonus'
import { standaardPersonen } from '../lib/menu'

export function Recept() {
  const { id } = useParams<{ id: string }>()
  const navigeer = useNavigate()
  const recept = useRecept(id)
  const voorkeuren = useVoorkeuren()
  const opslaan = useVoorkeurenOpslaan()
  const week = weekStart()
  const dezeWeek = useDezeWeek(week)
  const { voegToe, dialoog, bezig } = useOpLijst(week)
  // Het hartje werkt hier net als in Ontdekken: bewaren voor "Komende week".
  const hartje = useHartje()
  const allergieen = useAllergieen()
  const regels = useAllergeenRegels(allergieen.length > 0)
  const bonus = useBonus()
  const client = useQueryClient()
  // Delen: 'vraag' is de keuze hoe (WhatsApp of iets anders), daarna wat er gebeurde.
  const [deelStap, setDeelStap] = useState<null | 'vraag' | 'kookboek' | 'gekopieerd' | { fout: string }>(null)

  // Meteen vanuit de tik WhatsApp of het deelvenster openen (Safari staat geen
  // wachten toe); de link van een eigen recept gaat intussen aan.
  const deelRecept = (r: NonNullable<typeof recept.data>, via: 'whatsapp' | 'anders') => {
    const url = deelLink(r)
    if (!heeftLink(r)) {
      maakDeellink(r.id)
        .then(() => client.invalidateQueries({ queryKey: sleutels.recept(r.id) }))
        .catch((e) => setDeelStap({ fout: `De link werkt nog niet: ${foutTekst(e)}` }))
    }
    if (via === 'whatsapp') {
      void openBijWinkel(whatsappLink(r.titel_nl ?? r.titel, url))
      setDeelStap((stap) => (stap === 'vraag' ? null : stap))
      return
    }
    void deel(r.titel_nl ?? r.titel, url).then((uitkomst) => {
      if (uitkomst === 'gekopieerd') setDeelStap('gekopieerd')
      else if (uitkomst === 'mislukt') setDeelStap({ fout: `Delen lukte niet. De link is ${url}` })
      else setDeelStap((stap) => (stap === 'vraag' ? null : stap))
    })
  }

  // Hoe dit recept in je week staat. Komt het uit Ontdekken en heb je het
  // nog niet gekozen, dan staat het er niet in — dat is gewoon "niet gekozen".
  const inWeek = dezeWeek.data?.find((r) => r.id === id)
  const gekozen = inWeek?.gekozen ?? false
  const opLijst = inWeek?.opLijst ?? false
  const bewaard = Boolean(id && hartje.bewaard.has(id))

  // Lokale overschrijving: je kunt per recept even schuiven met het aantal
  // personen zonder je vaste voorkeur te veranderen.
  const [lokaalPersonen, setLokaalPersonen] = useState<number | null>(null)
  const personen = lokaalPersonen ?? standaardPersonen(recept.data, voorkeuren.data?.aantal_personen ?? 4)

  return (
    <Scherm>
      <Grens query={recept} ladenTekst="Recept ophalen">
        {recept.data && (() => {
          const r = recept.data
          const ingredienten = schaalIngredienten(r.ingredienten, r.personen, personen)
          const dieet = dieetLabels(r)
          const toko = tokoIngredienten(r.ingredienten)
          const allergie = allergieen.length > 0 && regels.data
            ? receptAllergie(r.ingredienten.map((i) => i.naam), regels.data, allergieen)
            : null
          // Wat er van dit recept in de bonus is, per ingrediënt: dezelfde
          // producten als het gele label op de foto in Deze week en Ontdekken.
          const inBonus = new Map(receptBonusProducten(r.ingredienten, bonus.data).map((p) => [ingredientKey(p.naam), p.acties[0]]))

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
                      {(gekozen || bewaard) && (
                        <span style={{
                          padding: '8px 12px', borderRadius: 'var(--radius-full)',
                          background: 'rgba(20,20,20,0.5)', backdropFilter: 'blur(8px)',
                          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                        }}>{opLijst ? 'Op je lijst' : gekozen ? "In 'Deze week'" : "In 'Komende week'"}</span>
                      )}
                      <IconButton
                        icon="share" label="Deel dit recept" size={42}
                        onClick={() => {
                          setDeelStap(magDelen(r) ? 'vraag' : 'kookboek')
                        }}
                        style={{ background: 'rgba(20,20,20,0.5)', color: 'var(--c-paper)', backdropFilter: 'blur(8px)' }}
                      />
                      <IconButton
                        icon="heart" size={42}
                        label={bewaard ? 'Uit komende week halen' : 'Bewaren voor komende week'}
                        onClick={() => hartje.tik(r)}
                        style={{
                          background: bewaard ? 'var(--c-red-bright)' : 'rgba(20,20,20,0.5)',
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
                      {r.keuken ?? 'Recept'}{dieet.map((d) => ` · ${d}`).join('')}{isBudget(r) ? ' · budget' : ''}{toko.length > 0 ? ' · toko nodig' : ''}
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

                {toko.length > 0 && (
                  <div style={{
                    background: 'var(--c-warm-300)', borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                    margin: '4px 0 8px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45,
                  }}>
                    <strong>Niet bij AH of Jumbo:</strong>{' '}
                    {toko.map((t) => t.naam.toLowerCase()).join(', ')}. Die haal je bij een toko, bijvoorbeeld
                    online bij Tjin's Toko — tik op "toko" bij het ingrediënt.
                  </div>
                )}

                {allergie && <AllergieBlok allergie={allergie} allergieen={allergieen} />}

                {ingredienten.map((ing, i) => {
                  const tokoIng = tokoProduct({ ingredient_key: ingredientKey(ing.naam), naam: ing.naam })
                  const actie = inBonus.get(ingredientKey(ing.naam))
                  return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 2px',
                    borderBottom: '1.5px solid rgba(20,20,20,0.12)',
                  }}>
                    <span style={{
                      flex: 'none', width: 88, fontFamily: 'var(--font-body)', fontSize: 14,
                      fontWeight: 700, color: 'var(--c-red-bright)',
                    }}>{ing.weergave}</span>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 15 }}>
                      {ing.naam}
                      {actie && (
                        <span style={{
                          display: 'block', marginTop: 3, fontSize: 12, fontWeight: 700, color: 'var(--c-red)',
                        }}>Bonus: {actie.mechanisme ?? 'in de aanbieding'} {totTekst(actie.geldig_tot)}</span>
                      )}
                    </span>
                    {tokoIng && (
                      <a
                        href={tokoIng.url}
                        onClick={(e) => { e.preventDefault(); void openBijWinkel(tokoIng.url) }}
                        aria-label={`${tokoIng.naam} bij Tjin's Toko`}
                        style={{ flex: 'none', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                      >toko</a>
                    )}
                  </div>
                  )
                })}

                {inBonus.size > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(20,20,20,0.55)' }}>
                      Bonus {bonus.peildatum.zelfHalen ? 'vandaag' : 'op je bezorgdag'} ·{' '}
                    </span>
                    <BonusBron klein />
                  </div>
                )}

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
                  {/* Staat het al op je lijst, dan wil je alleen nog koken. */}
                  {!opLijst && (
                    <Button
                      disabled={bezig || dezeWeek.isPending}
                      icon="plus"
                      onClick={() => {
                        // Het aantal personen dat je hier koos wordt je voorkeur, zodat
                        // de boodschappenlijst met dezelfde hoeveelheden werkt.
                        // Niet bij een samengesteld menu: dat is voor je gasten, niet je huishouden.
                        if (lokaalPersonen && r.bron_type !== 'samengesteld' && lokaalPersonen !== voorkeuren.data?.aantal_personen) {
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
                    >Zet op de boodschappenlijst</Button>
                  )}
                  {gekozen && (
                    <Button
                      tone="yellow"
                      onClick={() => navigeer(`/koken/${r.id}`)}
                      style={{ flex: opLijst ? 1 : 'none', padding: '17px 20px', fontSize: 16 }}
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
                open={deelStap === 'vraag'}
                kop="Deel dit recept"
                tekst={heeftLink(r)
                  ? 'Je stuurt een link naar het recept op de website. Wie hem opent hoeft niet in te loggen.'
                  : 'Dit is je eigen recept. Iedereen die de link heeft kan het lezen, ook zonder account. Je naam staat er niet bij.'}
                onSluit={() => setDeelStap(null)}
                acties={[
                  { label: 'Deel via WhatsApp', hoofd: true, onClick: () => deelRecept(r, 'whatsapp') },
                  { label: heeftDeelvenster() ? 'Andere app' : 'Kopieer de link', onClick: () => deelRecept(r, 'anders') },
                  { label: 'Laat maar', onClick: () => setDeelStap(null) },
                ]}
              />
              <Dialoog
                open={deelStap === 'kookboek'}
                kop="Dit recept kun je niet delen"
                tekst="Het komt uit een kookboek en blijft daarom alleen voor jou. Wil je het gerecht toch delen, voeg het dan toe als eigen recept met de bereiding in je eigen woorden."
                onSluit={() => setDeelStap(null)}
                acties={[{ label: 'Oké', hoofd: true, onClick: () => setDeelStap(null) }]}
              />
              <Dialoog
                open={deelStap === 'gekopieerd'}
                kop="Link gekopieerd"
                tekst="Plak de link in een bericht. Wie hem opent ziet het recept op de website, zonder in te loggen."
                onSluit={() => setDeelStap(null)}
                acties={[{ label: 'Oké', hoofd: true, onClick: () => setDeelStap(null) }]}
              />
              <Dialoog
                open={typeof deelStap === 'object' && deelStap !== null}
                kop="Delen lukte niet"
                tekst={typeof deelStap === 'object' && deelStap !== null ? deelStap.fout : ''}
                onSluit={() => setDeelStap(null)}
                acties={[{ label: 'Oké', hoofd: true, onClick: () => setDeelStap(null) }]}
              />
              {hartje.dialoog}
            </>
          )
        })()}
      </Grens>
    </Scherm>
  )
}

/**
 * Wat dit recept met jouw allergieën doet: wat erin zit, wat we op je lijst
 * vervangen en van welke producten je het etiket moet lezen. Niets aan de
 * hand? Dan zeggen we dat ook, kort.
 */
function AllergieBlok({ allergie, allergieen }: { allergie: ReceptAllergie; allergieen: string[] }) {
  const { bevat, vervangen, etiket } = allergie
  const klein = (naam: string) => naam.charAt(0).toLowerCase() + naam.slice(1)
  const regel: React.CSSProperties = { margin: 0 }
  const niets = bevat.length + vervangen.length + etiket.length === 0

  return (
    <div style={{
      background: bevat.length > 0 ? 'var(--c-warm-300)' : 'var(--c-paper)',
      border: bevat.length > 0 ? 'none' : '1.5px solid rgba(20,20,20,0.12)',
      borderRadius: 'var(--radius-sm)', padding: '12px 14px', margin: '4px 0 8px',
      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {niets && <p style={regel}><strong>Geen {opsomming(allergieen)}</strong>, volgens de ingrediëntenlijst.</p>}
      {bevat.length > 0 && (
        <p style={regel}>
          <strong>Bevat {opsomming([...new Set(bevat.flatMap((b) => b.allergenen))])}:</strong>{' '}
          {bevat.map((b) => klein(b.naam)).join(', ')}.
        </p>
      )}
      {vervangen.length > 0 && (
        <p style={regel}>
          <strong>Op je lijst vervangen:</strong>{' '}
          {vervangen.map((v) => `${klein(v.naam)} door ${v.vervanger}`).join(', ')}.
        </p>
      )}
      {etiket.length > 0 && (
        <p style={regel}>
          <strong>Check het etiket:</strong>{' '}
          {etiket.map((e) => `${klein(e.naam)} (${e.allergenen.map(allergeenNaam).join(', ')})`).join(', ')}.
        </p>
      )}
    </div>
  )
}
