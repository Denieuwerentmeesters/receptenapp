import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Icon } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel, Voet } from '../components/Layout'
import { Fout, Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { useBoodschapMuteren, useBoodschappen, useDezeWeek, useJumboMapping, useVoorkeuren } from '../lib/queries'
import { useBestellingen, useBestellingVastleggen, useJumboPrijzen, useVoorraad } from '../lib/queries2'
import { MAALTIJDBOX, bespaardMet, euro, mandjeKosten, totaalBespaard } from '../lib/besparing'
import type { Bestelling } from '../lib/database.types'
import { DROGE_KRUIDEN_KEY, isDroogKruid } from '../lib/kruiden'
import { openBijWinkel } from '../lib/ah'
import { useWinkel } from '../lib/winkel'
import { groepeerOpSchap, voegSamen } from '../lib/lijst'
import { weekStart } from '../lib/week'

const SUGGESTIES = ['Koffie', 'Brood', 'Melk', 'Bananen', 'Wc-papier']

/** Wat er naar de winkel ging, zodat we na terugkomst kunnen vragen of het aankwam. */
interface Doorgestuurd {
  /** Rijen die van de lijst mogen als het mandje klopt: doorgestuurd + al afgevinkt. */
  ids: string[]
  gemapt: number
  ongemapt: number
  /** Wat niet mee kon naar de winkel: dat blijft op de lijst, en dat melden we. */
  nietMee: string[]
  /** Voor "Bespaard!": vastgelegd zodra je bevestigt dat het mandje aankwam. */
  recepten: Record<string, number>
  kosten: number
}

export function Boodschappen() {
  const week = weekStart()
  const navigeer = useNavigate()

  const boodschappen = useBoodschappen(week)
  const dezeWeek = useDezeWeek(week)
  const winkel = useWinkel()
  const voorraad = useVoorraad()
  const voorkeuren = useVoorkeuren()
  // Voor de besparingsteller altijd in Jumbo-prijzen, ook als je bij AH bestelt.
  const jumboMapping = useJumboMapping(true)
  const jumboPrijzen = useJumboPrijzen()
  const bestellingen = useBestellingen()
  const vastleggen = useBestellingVastleggen(week)
  const { afvinken, toevoegen, verwijderen, opruimen, allesWissen } = useBoodschapMuteren(week)

  const [nieuw, setNieuw] = useState('')
  const [mandjeFout, setMandjeFout] = useState<string | null>(null)
  const [melding, setMelding] = useState<string | null>(null)
  const [doorgestuurd, setDoorgestuurd] = useState<Doorgestuurd | null>(null)
  const [wisVraag, setWisVraag] = useState(false)
  const [nietMee, setNietMee] = useState<string[] | null>(null)
  const [bespaard, setBespaard] = useState<Bestelling | null>(null)

  const receptenOpLijst = (dezeWeek.data ?? []).filter((r) => r.opLijst).length
  const items = useMemo(() => boodschappen.data ?? [], [boodschappen.data])
  const regels = useMemo(() => voegSamen(items), [items])
  const open = regels.filter((r) => !r.afgevinkt)
  // Staan droge kruiden in je voorraadkast, dan blijven kruiden op de lijst
  // maar gaan ze niet mee naar het mandje.
  const kruidenThuis = (voorraad.data ?? []).some((v) => v.ingredient_key === DROGE_KRUIDEN_KEY && v.in_huis)
  const blijftThuis = (key: string) => kruidenThuis && isDroogKruid(key)
  const naarWinkel = open.filter((r) => !blijftThuis(r.key))
  const kruidenOpen = open.length - naarWinkel.length
  const groepen = useMemo(() => groepeerOpSchap(regels), [regels])

  async function naarMandje() {
    setMandjeFout(null)
    setMelding(null)
    const { url, gemapt, ongemapt } = winkel.mandjeLink(naarWinkel.map((r) => r.voorbeeld))
    if (gemapt.length === 0) {
      setMelding(
        `Geen van deze producten heeft nog een ${winkel.kort}-productnummer. ` +
        'Gebruik de zoeklinks bij de producten.',
      )
      return
    }
    try {
      await openBijWinkel(url)
      const gemapteIds = new Set(gemapt.map((i) => i.id))
      const weg = regels
        .filter((r) => r.afgevinkt || gemapteIds.has(r.voorbeeld.id))
        .flatMap((r) => r.ids)
      // Bewust eerst vragen: we kunnen niet controleren of het aankwam. AH
      // voegt niets toe als je daar niet ingelogd bent, zonder foutmelding, en
      // bij Jumbo kan het in een ander mandje landen dan dat in je Jumbo-app.
      // Alles wat naar de winkel gaat telt mee, ook wat je los koopt: een
      // maaltijdbox levert ook het hele recept.
      const aantalPerRecept = new Map((dezeWeek.data ?? []).map((r) => [r.id, r.aantal]))
      const recepten: Record<string, number> = {}
      for (const r of naarWinkel) {
        for (const i of r.items) {
          if (i.bron_recept_id) recepten[i.bron_recept_id] = aantalPerRecept.get(i.bron_recept_id) ?? 1
        }
      }
      setDoorgestuurd({
        ids: weg, gemapt: gemapt.length, ongemapt: ongemapt.length,
        nietMee: naarWinkel.filter((r) => !gemapteIds.has(r.voorbeeld.id)).map((r) => r.label),
        recepten,
        kosten: mandjeKosten(
          naarWinkel, jumboMapping.data ?? {}, jumboPrijzen.data ?? {},
          voorkeuren.data?.biologisch_voorkeur ?? false,
        ).totaal,
      })
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
          `Log eerst in bij ${winkel.naam} — uitgelogd kan je mandje leeg blijven, zonder melding.`,
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
                    {blijftThuis(regel.key) ? (
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'rgba(20,20,20,0.5)',
                      }}>thuis</span>
                    ) : !winkel.heeftProduct(regel.voorbeeld) && (
                      <a
                        href={winkel.zoekLink(regel.naam)}
                        onClick={(e) => { e.preventDefault(); void openBijWinkel(winkel.zoekLink(regel.naam)) }}
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
                    padding: '13px 15px', fontFamily: 'var(--font-body)', fontSize: 16,
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
          <Voet meeschuiven>
            {naarWinkel.length === 0 ? (
              // Alles afgevinkt (of alleen kruiden over): je bent klaar. Dan mag de lijst leeg.
              <Button
                tone="green"
                onClick={() => opruimen.mutate(regels.flatMap((r) => r.ids))}
                style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
              >Klaar met boodschappen</Button>
            ) : (
              <Button
                onClick={() => { void naarMandje() }}
                style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
              >{`Naar ${winkel.kort}-mandje (${naarWinkel.length})`}</Button>
            )}
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, margin: '8px 0 0',
              textAlign: 'center', color: 'rgba(20,20,20,0.6)',
            }}>
              {naarWinkel.length === 0
                ? 'Je lijst wordt leeggemaakt. Je recepten blijven in Deze week staan.'
                : kruidenOpen > 0
                  ? 'Afgevinkte producten en kruiden laten we uit je mandje. Check wel even je kruidenrek.'
                  : 'Afgevinkte producten laten we uit je mandje.'}
            </p>
          </Voet>
        )}
      </Grens>

      <Dialoog
        open={Boolean(doorgestuurd)}
        kop={`Staat alles in je ${winkel.kort}-mandje?`}
        tekst={doorgestuurd
          ? `${doorgestuurd.gemapt} product${doorgestuurd.gemapt === 1 ? '' : 'en'} doorgestuurd naar ${winkel.naam}. ` +
            'Zie je ze in je mandje, dan halen we ze van je lijst.' +
            (doorgestuurd.ongemapt > 0
              ? ` ${doorgestuurd.ongemapt} product${doorgestuurd.ongemapt === 1 ? '' : 'en'} konden we niet bij ${winkel.kort} vinden — die blijven staan.`
              : '')
          : undefined}
        onSluit={() => setDoorgestuurd(null)}
        acties={[
          {
            label: 'Ja, haal van mijn lijst',
            hoofd: true,
            onClick: () => {
              if (doorgestuurd) {
                opruimen.mutate(doorgestuurd.ids)
                if (doorgestuurd.nietMee.length > 0) setNietMee(doorgestuurd.nietMee)
                vastleggen.mutate({
                  winkel: winkel.id,
                  personen: voorkeuren.data?.aantal_personen ?? 4,
                  recepten: doorgestuurd.recepten,
                  mandjeKosten: doorgestuurd.kosten,
                }, {
                  // Alleen vieren als er maaltijden bij kwamen; een tweede ronde
                  // voor een vergeten ui is geen besparing.
                  onSuccess: (b) => { if (b.maaltijden > 0) setBespaard(b) },
                })
              }
              setDoorgestuurd(null)
            },
          },
          {
            label: 'Nee, mijn mandje is leeg',
            onClick: () => {
              setDoorgestuurd(null)
              setMelding(winkel.id === 'jumbo'
                ? 'Kijk ook in Safari op jumbo.com: staat de Jumbo-app los van Safari, dan kan je mandje ' +
                  'daar terechtgekomen zijn. Log in Safari in bij Jumbo en tik opnieuw op Naar Jumbo-mandje. ' +
                  'Je lijst is niet veranderd.'
                : 'Dan ben je bij AH waarschijnlijk niet ingelogd — dan voegt AH niets toe, zonder melding. ' +
                  'Log daar in en tik opnieuw op Naar AH-mandje. Je lijst is niet veranderd.',
              )
            },
          },
        ]}
      />

      <Dialoog
        open={Boolean(nietMee)}
        kop="Let op: dit moet je zelf nog kopen"
        tekst={nietMee
          ? `Deze producten zitten níét in je ${winkel.kort}-mandje: ${nietMee.join(', ')}. ` +
            `Ze blijven op je lijst. Koop ze los — bij ${winkel.kort} via 'zoek', of in een andere winkel.`
          : undefined}
        onSluit={() => setNietMee(null)}
        acties={[{ label: 'Oké, ik koop ze zelf', hoofd: true, onClick: () => setNietMee(null) }]}
      />

      <Dialoog
        open={Boolean(bespaard) && !nietMee}
        kop={bespaard ? `${euro(bespaardMet(bespaard))} bespaard!` : ''}
        tekst={bespaard
          ? `Deze boodschappen kosten zo'n ${euro(bespaard.mandje_kosten)}. ` +
            `Dezelfde ${bespaard.maaltijden} ${bespaard.maaltijden === 1 ? 'maaltijd' : 'maaltijden'} voor ` +
            `${bespaard.personen} bij ${MAALTIJDBOX.naam}: ${euro(bespaard.maaltijdbox_kosten)}. ` +
            // De lijst kan nog aan het verversen zijn; deze bestelling telt hoe dan ook mee.
            `Totaal bespaard met de app: ${euro(totaalBespaard([
              ...(bestellingen.data ?? []).filter((b) => b.id !== bespaard.id), bespaard,
            ]))}.`
          : undefined}
        onSluit={() => setBespaard(null)}
        acties={[
          { label: 'Top!', hoofd: true, onClick: () => setBespaard(null) },
          { label: 'Bekijk wat je bespaarde', onClick: () => { setBespaard(null); navigeer('/bespaard') } },
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
