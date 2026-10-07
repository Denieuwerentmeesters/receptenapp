import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Chip, Icon, IconButton, ProgressBar, Woordmerk } from '../ds'
import { Label, Titel } from '../components/Layout'
import { Grens, Laden } from '../components/Staten'
import { AANTAL_UITLEGKAARTEN, Uitleg, UitlegVoorladen } from '../components/Uitleg'
import { AllergieKeuze, KeukenKeuze } from '../components/voorkeuren'
import { haalDezeWeek, sleutels, useLijstActies, useVoorkeuren, useVoorkeurenOpslaan } from '../lib/queries'
import { useKeukens, useVoorraad, useVoorraadMuteren } from '../lib/queries2'
import { VOORRAAD_SUGGESTIES } from '../lib/voorraad'
import { ingredientKey } from '../lib/schaal'
import { DROGE_KRUIDEN } from '../lib/kruiden'
import { opsomming, vastVoorJou } from '../lib/allergenen'
import { kiesWeek, vegaDoel, vegaMinimumVoor } from '../lib/weekvullen'
import { weekStart } from '../lib/week'
import { foutTekst } from '../lib/fouten'
import { meet } from '../lib/meten'
import type { Voorkeuren } from '../lib/database.types'

/**
 * De onboarding: één keer na het aanmaken van een account. Eerst de uitleg,
 * dan zes vragen, en daarna sta je op Deze week met een weekmenu dat bij je
 * huishouden past.
 *
 * - De antwoorden gaan naar dezelfde kolommen als Instellingen
 *   (gebruiker_voorkeuren); er is geen tweede plek om iets in te stellen.
 * - Elke "Volgende" slaat op. Sluit je de app halverwege, dan begin je bij
 *   terugkomst bij de vraag waar je was, met je antwoorden ingevuld.
 * - Het weekmenu maakt de generator pas na de vragen (haalDezeWeek): hij is
 *   idempotent per week, dus eerder draaien geeft tien suggesties op de
 *   standaardwaarden.
 * - App.tsx stuurt hierheen zolang onboarding_klaar_op leeg is.
 */

const VRAGEN = ['personen', 'kookavonden', 'keukens', 'allergieen', 'voorraad', 'winkel'] as const
type Vraag = (typeof VRAGEN)[number]
type Winkel = Voorkeuren['voorkeurswinkel']

const MAX_PERSONEN = 8

/** De producten waar de voorraadvraag naar vraagt: de bovenste van de voorraadkast. */
const VOORRAAD_KEUZES = VOORRAAD_SUGGESTIES.slice(0, 15)

interface Antwoorden {
  personen: number
  avonden: number
  /** Hoeveel van je avonden vegetarisch; de kolom bewaart "x van de 10". */
  vega: number
  keukens: string[]
  allergieen: string[]
  winkel: Winkel
}

function uitVoorkeuren(v: Voorkeuren): Antwoorden {
  const avonden = v.kookavonden ?? 4
  return {
    personen: Math.min(v.aantal_personen, MAX_PERSONEN),
    avonden,
    vega: vegaDoel({ vega_minimum: v.vega_minimum, kookavonden: avonden }),
    keukens: v.favoriete_keukens ?? [],
    allergieen: v.allergieen ?? [],
    winkel: v.voorkeurswinkel,
  }
}

/* ------------------------------------------------- waar je gebleven was */

const OPSLAG = 'pinch-onboarding'

interface Voortgang {
  vraag: number
  /** Je was al bij het laatste scherm: dan heb je ook een winkel gekozen. */
  klaar: boolean
  overgeslagen: Vraag[]
}

function leesVoortgang(): Voortgang | null {
  try {
    const ruw = JSON.parse(localStorage.getItem(OPSLAG) ?? 'null') as Partial<Voortgang> | null
    if (!ruw || typeof ruw.vraag !== 'number') return null
    return {
      vraag: Math.min(Math.max(Math.trunc(ruw.vraag), 0), VRAGEN.length - 1),
      klaar: ruw.klaar === true,
      overgeslagen: (ruw.overgeslagen ?? []).filter((v) => VRAGEN.includes(v)),
    }
  } catch {
    return null
  }
}

function bewaarVoortgang(voortgang: Voortgang | null) {
  try {
    if (voortgang) localStorage.setItem(OPSLAG, JSON.stringify(voortgang))
    else localStorage.removeItem(OPSLAG)
  } catch { /* geen opslag: dan begin je na het sluiten weer vooraan */ }
}

/* -------------------------------------------------------------- het scherm */

export function Onboarding() {
  const voorkeuren = useVoorkeuren()
  // Zodra de voorkeuren er zijn blijft het verloop staan, ook als opnieuw
  // ophalen even mislukt: anders ben je midden in een vraag je scherm kwijt.
  if (voorkeuren.data) return <Verloop voorkeuren={voorkeuren.data} />
  return <Grens query={voorkeuren} ladenTekst="Even alles klaarzetten">{null}</Grens>
}

type Scherm = 'welkom' | 'uitleg' | 'vraag' | 'klaar' | 'vullen'

function Verloop({ voorkeuren }: { voorkeuren: Voorkeuren }) {
  const navigeer = useNavigate()
  const qc = useQueryClient()
  const week = weekStart()
  const opslaan = useVoorkeurenOpslaan()
  const { zetOpLijst } = useLijstActies(week)
  const keukens = useKeukens()
  const alleKeukens = (keukens.data ?? []).map((k) => k.keuken)

  // Eén keer lezen: daarna is de state hier de waarheid.
  const [hervat] = useState(leesVoortgang)
  const [scherm, setScherm] = useState<Scherm>(hervat ? (hervat.klaar ? 'klaar' : 'vraag') : 'welkom')
  const [uitlegStart, setUitlegStart] = useState(0)
  const [vraag, setVraag] = useState(hervat?.vraag ?? 0)
  const [wijzigen, setWijzigen] = useState(false)
  const [klaarBereikt, setKlaarBereikt] = useState(hervat?.klaar ?? false)
  const [overgeslagen, setOvergeslagen] = useState<Vraag[]>(hervat?.overgeslagen ?? [])
  const [antw, setAntw] = useState(() => uitVoorkeuren(voorkeuren))
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)

  // De voorraadkast staat niet bij de voorkeuren maar in voorraad_item. Wat
  // je aantikt is een concept; null = nog niet aangeraakt, dan geldt wat er al staat.
  const voorraad = useVoorraad()
  const { toevoegen, verwijderen } = useVoorraadMuteren()
  const [voorraadKeuze, setVoorraadKeuze] = useState<string[] | null>(null)
  const inKast = new Set((voorraad.data ?? []).filter((i) => i.in_huis).map((i) => i.ingredient_key))
  const voorraadGekozen = voorraadKeuze ?? VOORRAAD_KEUZES.filter((n) => inKast.has(ingredientKey(n)))
  const voorraadOpslag = useRef<Promise<void>>(Promise.resolve())

  /** Zet wat je koos in je voorraadkast en haalt eruit wat je weer uittikte. */
  function bewaarVoorraad(): Promise<void> {
    const erbij = voorraadGekozen.filter((n) => !inKast.has(ingredientKey(n)))
    const eraf = VOORRAAD_KEUZES.map(ingredientKey)
      .filter((key) => inKast.has(key) && !voorraadGekozen.some((n) => ingredientKey(n) === key))
    return Promise.all([
      ...erbij.map((n) => toevoegen.mutateAsync(n)),
      ...eraf.map((key) => verwijderen.mutateAsync(key)),
    ]).then(() => undefined)
  }

  const gestart = useRef(false)
  useEffect(() => {
    if (gestart.current || hervat) return
    gestart.current = true
    meet('onboarding_gestart')
  }, [hervat])

  useEffect(() => {
    if (scherm === 'vraag' || scherm === 'klaar') bewaarVoortgang({ vraag, klaar: klaarBereikt, overgeslagen })
  }, [scherm, vraag, klaarBereikt, overgeslagen])

  const naam = VRAGEN[vraag]
  const vegaMinimum = vegaMinimumVoor(antw.vega, antw.avonden)
  // Alles aan of niets aan is hetzelfde: geen voorkeur.
  const keukensOpslaan = alleKeukens.length > 0 && antw.keukens.length === alleKeukens.length ? [] : antw.keukens

  const wijziging: Record<Vraag, Partial<Voorkeuren>> = {
    personen: { aantal_personen: antw.personen },
    kookavonden: { kookavonden: antw.avonden, vega_minimum: vegaMinimum },
    keukens: { favoriete_keukens: keukensOpslaan },
    allergieen: { allergieen: antw.allergieen },
    voorraad: {},
    winkel: { voorkeurswinkel: antw.winkel },
  }

  function naarKlaar(aantalOvergeslagen: number) {
    if (!klaarBereikt) {
      meet('onboarding_klaar', { overgeslagen: aantalOvergeslagen })
      setKlaarBereikt(true)
    }
    setWijzigen(false)
    setScherm('klaar')
  }

  function verder(nuOvergeslagen: Vraag[]) {
    setOvergeslagen(nuOvergeslagen)
    if (wijzigen || vraag >= VRAGEN.length - 1) naarKlaar(nuOvergeslagen.length)
    else setVraag(vraag + 1)
  }

  function beantwoord(extra: Partial<Voorkeuren> = {}) {
    if (naam === 'voorraad') {
      voorraadOpslag.current = bewaarVoorraad()
      // Mislukt het hier, dan proberen we het bij het afronden nog een keer.
      voorraadOpslag.current.catch(() => undefined)
    } else {
      opslaan.mutate({ ...wijziging[naam], ...extra })
    }
    meet('vraag_beantwoord', { vraag: naam })
    verder(overgeslagen.filter((v) => v !== naam))
  }

  function slaOver() {
    // Wat je aantikte maar niet bevestigde gaat terug naar wat er stond.
    const stond = uitVoorkeuren(voorkeuren)
    if (naam === 'voorraad') setVoorraadKeuze(null)
    else {
      setAntw({
        ...antw,
        ...(naam === 'personen' ? { personen: stond.personen }
          : naam === 'kookavonden' ? { avonden: stond.avonden, vega: stond.vega }
          : naam === 'keukens' ? { keukens: stond.keukens }
          : { allergieen: stond.allergieen }),
      })
    }
    meet('vraag_overgeslagen', { vraag: naam })
    verder(overgeslagen.includes(naam) ? overgeslagen : [...overgeslagen, naam])
  }

  function terug() {
    if (wijzigen) { setWijzigen(false); setScherm('klaar') }
    else if (vraag === 0) { setUitlegStart(AANTAL_UITLEGKAARTEN - 1); setScherm('uitleg') }
    else setVraag(vraag - 1)
  }

  /** Zet uit de tien suggesties zoveel recepten op je lijst als je kookavonden hebt. */
  async function vulWeek(): Promise<number> {
    const recepten = await qc.fetchQuery({
      queryKey: sleutels.dezeWeek(week), queryFn: () => haalDezeWeek(week), staleTime: 0,
    })
    const passend = recepten.filter((r) => r.gekozen || vastVoorJou(r, antw.allergieen).length === 0)
    const ids = kiesWeek(
      passend.filter((r) => r.positie !== null && !r.gekozen && !r.gekooktOp),
      { vega_minimum: vegaMinimum, kookavonden: antw.avonden },
      passend.filter((r) => r.gekozen),
    )
    // Na elkaar: elk recept schrijft zijn eigen regels op de boodschappenlijst.
    for (const receptId of ids) await zetOpLijst.mutateAsync({ receptId, automatisch: true })
    return ids.length
  }

  async function rondAf(vullen: boolean) {
    setFout('')
    setBezig(true)
    if (vullen) setScherm('vullen')
    try {
      // Alles nog één keer in één schrijfactie: dan staat het er zeker voordat
      // de generator het weekmenu maakt.
      await opslaan.mutateAsync(Object.assign({}, ...VRAGEN.map((v) => wijziging[v])) as Partial<Voorkeuren>)
      // De voorraadkast moet er ook staan: wat in huis is komt niet op de lijst.
      await voorraadOpslag.current.catch(() => bewaarVoorraad())
      const aantal = vullen ? await vulWeek() : 0
      await opslaan.mutateAsync({ onboarding_klaar_op: new Date().toISOString() })
      if (vullen) meet('week_gevuld_onboarding', { recepten: aantal })
      bewaarVoortgang(null)
      navigeer(vullen ? '/deze-week' : '/ontdekken', { replace: true })
    } catch (e) {
      setFout(foutTekst(e))
      setBezig(false)
      setScherm('klaar')
    }
  }

  if (scherm === 'vullen') return <Laden tekst="We vullen je week" />

  if (scherm === 'welkom') {
    return (
      <div style={{
        height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', gap: 24, overflowY: 'auto',
        background: 'var(--c-red)', color: 'var(--c-cream)',
        padding: 'calc(env(safe-area-inset-top) + 28px) 26px calc(env(safe-area-inset-bottom) + 20px)',
      }}>
        <UitlegVoorladen />
        <Woordmerk hoogte={48} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Label>Welkom bij Pinch</Label>
          <Titel grootte={32}>Kook als met een box.</Titel>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.5, margin: 0 }}>
            Betaal als bij de supermarkt. Jij kiest de recepten, Pinch maakt de boodschappenlijst
            en zet alles klaar bij AH of Jumbo.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Button
            tone="yellow" size="lg" style={{ width: '100%', fontSize: 16 }}
            onClick={() => { setUitlegStart(0); setScherm('uitleg') }}
          >Laat zien hoe het werkt</Button>
          <button
            onClick={() => { meet('uitleg_overgeslagen', { kaart: 0 }); setScherm('vraag') }}
            style={{ ...linkStijl, color: 'var(--c-cream)' }}
          >Sla uitleg over</button>
        </div>
      </div>
    )
  }

  if (scherm === 'uitleg') {
    return (
      <Uitleg
        key={uitlegStart}
        start={uitlegStart}
        laatsteKnop="Naar de vragen"
        overslaanTekst="Sla uitleg over"
        onKlaar={() => setScherm('vraag')}
        onOverslaan={(kaart) => { meet('uitleg_overgeslagen', { kaart }); setScherm('vraag') }}
        onTerug={() => setScherm('welkom')}
      />
    )
  }

  if (scherm === 'klaar') {
    const p = antw.personen
    const chips: [Vraag, string][] = [
      ['personen', `${p} ${p === 1 ? 'persoon' : 'personen'}`],
      ['kookavonden', `${antw.avonden === 7 ? 'Elke avond' : `${antw.avonden} ${antw.avonden === 1 ? 'avond' : 'avonden'}`}, ${antw.vega} vegetarisch`],
      ['keukens', keukensOpslaan.length > 0 ? keukensOpslaan.join(', ') : 'Alle keukens'],
      ['allergieen', antw.allergieen.length > 0 ? `Zonder ${opsomming(antw.allergieen)}` : 'Geen allergieën'],
      ['voorraad', voorraadGekozen.length === 0 ? 'Voorraadkast leeg'
        : `${voorraadGekozen.length} ${voorraadGekozen.length === 1 ? 'product' : 'producten'} in huis`],
      ['winkel', antw.winkel === 'ah' ? 'Albert Heijn' : 'Jumbo'],
    ]
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-cream)', color: 'var(--c-ink)' }}>
        <div style={{
          flex: 'none', background: 'var(--c-red)', color: 'var(--c-cream)',
          padding: 'calc(env(safe-area-inset-top) + 28px) 22px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <Label>Klaar</Label>
          <Titel grootte={30}>Je week staat klaar</Titel>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.5, margin: 0 }}>
            Hiermee kiest Pinch je recepten.
          </p>
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px 12px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chips.map(([welke, tekst]) => (
              <button
                key={welke}
                onClick={() => { setVraag(VRAGEN.indexOf(welke)); setWijzigen(true); setFout(''); setScherm('vraag') }}
                style={{
                  minHeight: 44, padding: '8px 16px', border: 'none', borderRadius: 22, cursor: 'pointer',
                  background: 'var(--c-paper)', color: 'var(--c-ink)', textAlign: 'left',
                  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, lineHeight: 1.3,
                }}
              >{tekst}</button>
            ))}
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0, color: 'var(--c-ink-500)' }}>
            Tik op een antwoord om het te wijzigen. Alles pas je later aan in Instellingen.
          </p>
          {fout && (
            <div role="alert" style={{
              background: 'var(--c-yellow)', color: 'var(--c-ink)', borderRadius: 'var(--radius-sm)',
              padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
            }}>Dat lukte niet: {fout} Probeer het nog een keer.</div>
          )}
        </div>

        <div style={{
          flex: 'none', display: 'flex', flexDirection: 'column', gap: 10,
          padding: '8px 22px calc(env(safe-area-inset-bottom) + 20px)',
        }}>
          <Button size="lg" disabled={bezig} style={{ width: '100%', fontSize: 16 }} onClick={() => void rondAf(true)}>
            Vul mijn week
          </Button>
          <Button
            variant="secondary" tone="ink" size="lg" disabled={bezig}
            style={{ width: '100%', fontSize: 15 }} onClick={() => void rondAf(false)}
          >Zelf kiezen in Ontdekken</Button>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------ de vragen */

  const kop: Record<Vraag, [string, string]> = {
    personen: ['Voor hoeveel mensen kook je meestal?', 'Dan kloppen de hoeveelheden meteen.'],
    kookavonden: ['Hoeveel avonden wil je koken?', 'Per week. De rest laat je vrij.'],
    keukens: ['Welke keukens vind je lekker?', 'Kies er zoveel als je wilt. Daarvan krijg je meer in je weekmenu. De rest blijft gewoon te vinden.'],
    allergieen: ['Moet Pinch ergens rekening mee houden?', 'Kies de allergieën bij jou thuis.'],
    voorraad: ['Wat heb je standaard in huis?', 'Dat laat Pinch van je boodschappenlijst af. Aanvullen kan later in je voorraadkast.'],
    winkel: ['Waar doe je je boodschappen?', 'Naar deze supermarkt stuurt Pinch je boodschappenlijst.'],
  }

  return (
    <div style={{
      height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 22,
      background: 'var(--c-cream)', color: 'var(--c-ink)', fontFamily: 'var(--font-body)',
      padding: 'calc(env(safe-area-inset-top) + 16px) 22px calc(env(safe-area-inset-bottom) + 12px)',
    }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
        <IconButton icon="chevronLeft" label="Terug" onClick={terug} />
        <div style={{ flex: 1 }}>
          <ProgressBar value={vraag + 1} max={VRAGEN.length} trackTone="onLight" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700 }} aria-label={`Vraag ${vraag + 1} van ${VRAGEN.length}`}>
          {vraag + 1}/{VRAGEN.length}
        </span>
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, lineHeight: 1.08, margin: 0 }}>
          {kop[naam][0]}
        </h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{kop[naam][1]}</p>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {naam === 'personen' && (
          <>
            <div role="radiogroup" aria-label="Aantal personen" style={lijstStijl}>
              {([[1, 'Alleen ik'], [2, 'Met z’n tweeën'], [3, '3 personen'], [4, '4 personen']] as const).map(([n, label]) => (
                <Optie key={n} gekozen={antw.personen === n} onClick={() => setAntw({ ...antw, personen: n })}>{label}</Optie>
              ))}
              <Optie gekozen={antw.personen >= 5} onClick={() => setAntw({ ...antw, personen: Math.max(antw.personen, 5) })}>
                5 of meer
              </Optie>
            </div>
            {antw.personen >= 5 && (
              <TellerRij
                label="Hoeveel precies?" eenheid="personen"
                waarde={antw.personen} min={5} max={MAX_PERSONEN}
                onWijzig={(n) => setAntw({ ...antw, personen: n })}
              />
            )}
          </>
        )}

        {naam === 'kookavonden' && (
          <>
            <div role="radiogroup" aria-label="Aantal kookavonden" style={lijstStijl}>
              {([[2, '2 avonden'], [3, '3 avonden'], [4, '4 avonden'], [5, '5 avonden'], [7, 'Elke avond']] as const).map(([n, label]) => (
                <Optie
                  key={n} gekozen={antw.avonden === n}
                  onClick={() => setAntw({ ...antw, avonden: n, vega: Math.min(antw.vega, n) })}
                >{label}</Optie>
              ))}
            </div>
            <TellerRij
              label="Waarvan vegetarisch" eenheid="vegetarische avonden"
              waarde={antw.vega} min={0} max={antw.avonden}
              onWijzig={(n) => setAntw({ ...antw, vega: n })}
            />
            <p style={{ ...kleinStijl, flex: 'none' }}>
              {antw.vega} van je {antw.avonden} {antw.avonden === 1 ? 'avond' : 'avonden'} vegetarisch.
            </p>
          </>
        )}

        {naam === 'keukens' && (
          keukens.isPending
            ? <p style={kleinStijl}>Keukens ophalen…</p>
            : alleKeukens.length === 0
              ? <p style={kleinStijl}>De keukens zijn nu niet op te halen. Je kiest ze later in Instellingen.</p>
              : <KeukenKeuze groot keukens={alleKeukens} gekozen={antw.keukens} onWijzig={(nieuw) => setAntw({ ...antw, keukens: nieuw })} />
        )}

        {naam === 'allergieen' && (
          <>
            <AllergieKeuze groot metGeen gekozen={antw.allergieen} onWijzig={(nieuw) => setAntw({ ...antw, allergieen: nieuw })} />
            <div style={{
              flex: 'none', marginTop: 6, background: 'var(--c-paper)', borderRadius: 16, padding: '14px 16px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                Recepten met een allergeen zie je niet meer, voor gluten en koemelk krijg je een
                vervanger op je lijst. Op Ontdekken zet je het filter met één tik uit.
              </p>
              <p style={{ ...kleinStijl, fontSize: 13 }}>
                Pinch gebruikt dit alleen om recepten te filteren en je lijst aan te passen. Wissen kan in Instellingen.
              </p>
            </div>
          </>
        )}

        {naam === 'voorraad' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VOORRAAD_KEUZES.map((n) => {
                const aan = voorraadGekozen.includes(n)
                return (
                  <Chip
                    key={n} groot selected={aan}
                    onClick={() => setVoorraadKeuze(aan ? voorraadGekozen.filter((x) => x !== n) : [...voorraadGekozen, n])}
                  >{n}</Chip>
                )
              })}
            </div>
            {voorraadGekozen.includes(DROGE_KRUIDEN) && (
              <p style={{ ...kleinStijl, flex: 'none', marginTop: 4 }}>
                Droge kruiden staat voor je hele kruidenrek. Die blijven op je lijst staan, maar gaan niet in je mandje.
              </p>
            )}
          </>
        )}

        {naam === 'winkel' && (
          <>
            <div role="radiogroup" aria-label="Supermarkt" style={lijstStijl}>
              {([['ah', 'Albert Heijn'], ['jumbo', 'Jumbo']] as const).map(([w, label]) => (
                <Optie
                  key={w} hoog pijl gekozen={klaarBereikt && antw.winkel === w}
                  onClick={() => { setAntw({ ...antw, winkel: w }); beantwoord({ voorkeurswinkel: w }) }}
                >{label}</Optie>
              ))}
            </div>
            <p style={{ ...kleinStijl, flex: 'none', marginTop: 4 }}>Wisselen kan altijd in Instellingen.</p>
          </>
        )}
      </div>

      {/* Zonder winkel werkt de mandjeknop niet: die vraag sla je niet over, en een tik is meteen verder. */}
      {naam !== 'winkel' && (
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button size="lg" style={{ width: '100%', fontSize: 16 }} onClick={() => beantwoord()}>
            {wijzigen ? 'Klaar' : 'Volgende'}
          </Button>
          {wijzigen
            ? <div style={{ height: 44 }} />
            : (
              <button onClick={slaOver} style={{ ...linkStijl, color: 'var(--c-red)', textDecoration: 'none', fontSize: 14 }}>
                {naam === 'allergieen' || naam === 'voorraad' ? 'Sla over' : 'Sla over, kies voor mij'}
              </button>
            )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- onderdelen */

const lijstStijl: React.CSSProperties = { flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }

const kleinStijl: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, color: 'var(--c-ink-500)',
}

const linkStijl: React.CSSProperties = {
  height: 44, border: 'none', background: 'transparent', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
  textDecoration: 'underline', textUnderlineOffset: 3,
}

/** Eén keuze in een lijst: wit, en rood met een vinkje als je hem koos. */
function Optie({ gekozen, hoog, pijl, onClick, children }: {
  gekozen: boolean
  hoog?: boolean
  /** Een tik gaat meteen door: pijltje in plaats van vinkje. */
  pijl?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="radio"
      aria-checked={gekozen}
      onClick={onClick}
      style={{
        flex: 'none', height: hoog ? 72 : 54, border: 'none', borderRadius: 16, cursor: 'pointer',
        padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        fontFamily: 'var(--font-body)', fontSize: hoog ? 18 : 16, fontWeight: 700, textAlign: 'left',
        background: gekozen ? 'var(--c-red)' : 'var(--c-paper)',
        color: gekozen ? 'var(--c-cream)' : 'var(--c-ink)',
        transition: 'background var(--motion-fast) var(--ease)',
      }}
    >
      {children}
      {pijl ? <Icon name="chevronRight" size={20} /> : gekozen && <Icon name="check" size={18} />}
    </button>
  )
}

function TellerRij({ label, eenheid, waarde, min, max, onWijzig }: {
  label: string
  /** Voor de schermlezer: "minder personen", "meer vegetarische avonden". */
  eenheid: string
  waarde: number
  min: number
  max: number
  onWijzig: (n: number) => void
}) {
  const knop = (teken: string, nieuw: number, uit: boolean, omschrijving: string) => (
    <button
      onClick={() => onWijzig(nieuw)}
      disabled={uit}
      aria-label={omschrijving}
      style={{
        width: 44, height: 44, borderRadius: 'var(--radius-full)', background: 'var(--c-paper)',
        border: '1.5px solid var(--c-ink)', color: 'var(--c-ink)', cursor: uit ? 'not-allowed' : 'pointer',
        opacity: uit ? 0.35 : 1, fontFamily: 'var(--font-body)', fontSize: 22, lineHeight: 1,
      }}
    >{teken}</button>
  )
  return (
    <div style={{
      flex: 'none', background: 'var(--c-paper)', borderRadius: 16, padding: '10px 12px 10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {knop('−', Math.max(min, waarde - 1), waarde <= min, `Minder ${eenheid}`)}
        <span aria-live="polite" style={{
          width: 32, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
        }}>{waarde}</span>
        {knop('+', Math.min(max, waarde + 1), waarde >= max, `Meer ${eenheid}`)}
      </div>
    </div>
  )
}
