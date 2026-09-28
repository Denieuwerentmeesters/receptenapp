import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Icon } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel, Voet } from '../components/Layout'
import { Fout, Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import {
  useAhMapping, useBoodschapMuteren, useBoodschappen, useDezeWeek, useVoorkeuren,
} from '../lib/queries'
import { bouwMandjeLink, openBijAh, zoekLink, zoekProduct } from '../lib/ah'
import { groepeerOpSchap, voegSamen } from '../lib/lijst'
import { weekStart } from '../lib/week'

const SUGGESTIES = ['Koffie', 'Brood', 'Melk', 'Bananen', 'Wc-papier']

/** Wat er naar AH ging, zodat we na terugkomst kunnen vragen of het aankwam. */
interface Doorgestuurd {
  /** Rijen die van de lijst mogen als het mandje klopt: doorgestuurd + al afgevinkt. */
  ids: string[]
  gemapt: number
  ongemapt: number
}

export function Boodschappen() {
  const week = weekStart()
  const navigeer = useNavigate()

  const boodschappen = useBoodschappen(week)
  const dezeWeek = useDezeWeek(week)
  const voorkeuren = useVoorkeuren()
  const mapping = useAhMapping()
  const { afvinken, toevoegen, verwijderen, opruimen, allesWissen } = useBoodschapMuteren(week)

  const [nieuw, setNieuw] = useState('')
  const [mandjeFout, setMandjeFout] = useState<string | null>(null)
  const [melding, setMelding] = useState<string | null>(null)
  const [doorgestuurd, setDoorgestuurd] = useState<Doorgestuurd | null>(null)
  const [wisVraag, setWisVraag] = useState(false)

  const receptenOpLijst = (dezeWeek.data ?? []).filter((r) => r.opLijst).length
  const items = useMemo(() => boodschappen.data ?? [], [boodschappen.data])
  const regels = useMemo(() => voegSamen(items), [items])
  const open = regels.filter((r) => !r.afgevinkt)
  const groepen = useMemo(() => groepeerOpSchap(regels), [regels])

  async function naarMandje() {
    setMandjeFout(null)
    setMelding(null)
    const { url, gemapt, ongemapt } = bouwMandjeLink(
      open.map((r) => r.voorbeeld), mapping.data ?? {}, voorkeuren.data?.biologisch_voorkeur ?? false,
    )
    if (gemapt.length === 0) {
      setMelding(
        'Geen van deze producten heeft nog een AH-productnummer. ' +
        'Gebruik de zoeklinks bij de producten.',
      )
      return
    }
    try {
      await openBijAh(url)
      const gemapteIds = new Set(gemapt.map((i) => i.id))
      const weg = regels
        .filter((r) => r.afgevinkt || gemapteIds.has(r.voorbeeld.id))
        .flatMap((r) => r.ids)
      // Bewust eerst vragen: we kunnen niet controleren of het aankwam. AH
      // voegt niets toe als je daar niet ingelogd bent, zonder foutmelding.
      setDoorgestuurd({ ids: weg, gemapt: gemapt.length, ongemapt: ongemapt.length })
    } catch {
      setMandjeFout('Het mandje is niet aangekomen. Je lijst is bewaard — er is niets kwijt.')
    }
  }

  if (mandjeFout && open.length > 0) {
    return (
      <Fout
        kop="Je mandje is niet aangekomen"
        tekst={mandjeFout}
        stappen={[
          'Log eerst in bij Albert Heijn — uitgelogd voegt AH niets toe, zonder melding.',
          'Probeer het daarna opnieuw.',
          'Lukt het niet? Vink de lijst zelf af in de winkel.',
        ]}
        onOpnieuw={() => { void naarMandje() }}
        onTerug={() => setMandjeFout(null)}
      />
    )
  }

  return (
    <Scherm>
      <Grens query={boodschappen} ladenTekst="Boodschappenlijst ophalen">
        <Kop kleur="var(--c-green)">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Label>{receptenOpLijst} {receptenOpLijst === 1 ? 'recept' : 'recepten'}</Label>
            {items.length > 0 && (
              <button
                onClick={() => setWisVraag(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid rgba(255,246,232,0.5)',
                  background: 'transparent', color: 'var(--c-cream)', borderRadius: 'var(--radius-full)',
                  padding: '6px 12px', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                }}
              ><Icon name="trash" size={13} />Alles wissen</button>
            )}
          </div>
          <div style={{ marginTop: 14 }}><Titel>Boodschappen</Titel></div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
            {regels.length === 0
              ? 'Nog niets op je lijst.'
              : `${open.length} van de ${regels.length} producten nog nodig · op volgorde van de winkel`}
          </p>
        </Kop>

        {regels.length === 0 ? (
          <Leeg
            icoon="cart"
            kop="Je lijst is leeg"
            tekst="Zet een recept op je lijst, dan komen de ingrediënten hier vanzelf te staan."
            knop="Naar deze week"
            onKnop={() => navigeer('/deze-week')}
          />
        ) : (
          <Inhoud style={{ gap: 18 }}>
            {melding && (
              <div style={{
                background: 'var(--c-warm-300)', borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
              }}>{melding}</div>
            )}

            {groepen.map((groep) => (
              <div key={groep.schap} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'var(--c-green)',
                  }}>{groep.schap}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'rgba(20,20,20,0.6)' }}>
                    {groep.regels.filter((r) => !r.afgevinkt).length} van {groep.regels.length}
                  </span>
                </div>

                {groep.regels.map((regel) => (
                  <div key={regel.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px',
                    borderBottom: '1.5px solid rgba(20,20,20,0.12)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Checkbox
                        checked={regel.afgevinkt}
                        onChange={() => afvinken.mutate({ itemIds: regel.ids, afgevinkt: !regel.afgevinkt })}
                      >
                        {regel.label}
                      </Checkbox>
                    </div>
                    {!zoekProduct(regel.voorbeeld, mapping.data ?? {}) && (
                      <a
                        href={zoekLink(regel.naam)}
                        onClick={(e) => { e.preventDefault(); void openBijAh(zoekLink(regel.naam)) }}
                        style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                      >zoek</a>
                    )}
                    <button
                      onClick={() => verwijderen.mutate(regel.ids)}
                      aria-label={`${regel.naam} verwijderen`}
                      style={{
                        flex: 'none', width: 28, height: 28, borderRadius: 'var(--radius-full)',
                        border: 'none', background: 'transparent', color: 'rgba(20,20,20,0.45)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    ><Icon name="x" size={14} /></button>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--c-green)',
              }}>Zelf toevoegen</span>

              <form
                onSubmit={(e) => { e.preventDefault(); toevoegen.mutate(nieuw); setNieuw('') }}
                style={{ display: 'flex', gap: 8 }}
              >
                <input
                  value={nieuw}
                  onChange={(e) => setNieuw(e.target.value)}
                  placeholder="Bijv. koffiebonen"
                  style={{
                    flex: 1, minWidth: 0, background: 'var(--c-paper)',
                    border: '1.5px solid rgba(20,20,20,0.14)', borderRadius: 14,
                    padding: '13px 15px', fontFamily: 'var(--font-body)', fontSize: 15,
                  }}
                />
                <button type="submit" style={{
                  flex: 'none', border: 'none', borderRadius: 14, padding: '0 18px',
                  background: 'var(--c-red)', color: 'var(--c-cream)',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>Toevoegen</button>
              </form>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SUGGESTIES
                  .filter((s) => !regels.some((r) => r.naam.toLowerCase() === s.toLowerCase()))
                  .slice(0, 4)
                  .map((s) => (
                    <button key={s} onClick={() => toevoegen.mutate(s)} style={{
                      border: '1.5px solid rgba(20,20,20,0.14)', background: 'transparent',
                      borderRadius: 'var(--radius-full)', padding: '8px 14px',
                      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>+ {s}</button>
                  ))}
              </div>
            </div>
          </Inhoud>
        )}

        {regels.length > 0 && (
          <Voet>
            {open.length === 0 ? (
              // Alles afgevinkt: je bent klaar in de winkel. Dan mag de lijst leeg.
              <Button
                tone="green"
                onClick={() => opruimen.mutate(regels.flatMap((r) => r.ids))}
                style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
              >Klaar met boodschappen</Button>
            ) : (
              <Button
                onClick={() => { void naarMandje() }}
                style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
              >{`Naar AH-mandje (${open.length})`}</Button>
            )}
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, margin: '8px 0 0',
              textAlign: 'center', color: 'rgba(20,20,20,0.6)',
            }}>
              {open.length === 0
                ? 'Je lijst wordt leeggemaakt. Je recepten blijven in Deze week staan.'
                : 'Afgevinkte producten laten we uit je mandje.'}
            </p>
          </Voet>
        )}
      </Grens>

      <Dialoog
        open={Boolean(doorgestuurd)}
        kop="Staat alles in je AH-mandje?"
        tekst={doorgestuurd
          ? `${doorgestuurd.gemapt} product${doorgestuurd.gemapt === 1 ? '' : 'en'} doorgestuurd naar Albert Heijn. ` +
            'Zie je ze in je mandje, dan halen we ze van je lijst.' +
            (doorgestuurd.ongemapt > 0
              ? ` ${doorgestuurd.ongemapt} product${doorgestuurd.ongemapt === 1 ? '' : 'en'} konden we niet bij AH vinden — die blijven staan.`
              : '')
          : undefined}
        onSluit={() => setDoorgestuurd(null)}
        acties={[
          {
            label: 'Ja, haal van mijn lijst',
            hoofd: true,
            onClick: () => {
              if (doorgestuurd) opruimen.mutate(doorgestuurd.ids)
              setDoorgestuurd(null)
            },
          },
          {
            label: 'Nee, mijn mandje is leeg',
            onClick: () => {
              setDoorgestuurd(null)
              setMelding(
                'Dan ben je bij AH waarschijnlijk niet ingelogd — dan voegt AH niets toe, zonder melding. ' +
                'Log daar in en tik opnieuw op Naar AH-mandje. Je lijst is niet veranderd.',
              )
            },
          },
        ]}
      />

      <Dialoog
        open={wisVraag}
        kop="Weet je het zeker?"
        tekst="Alle producten gaan van je lijst. Je recepten blijven in Deze week staan, zonder gele rand."
        onSluit={() => setWisVraag(false)}
        acties={[
          { label: 'Ja, alles wissen', hoofd: true, onClick: () => { allesWissen.mutate(); setWisVraag(false) } },
          { label: 'Annuleer', onClick: () => setWisVraag(false) },
        ]}
      />

      <OnderBalk />
    </Scherm>
  )
}
