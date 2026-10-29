import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Chip, Icon } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { CijferSheet } from '../components/CijferSheet'
import { BespaardMelding } from '../components/BespaardMelding'
import { useOpLijst } from '../components/OpLijst'
import { useLijstActies, useVoorkeuren, type WeekRecept } from '../lib/queries'
import { useGeschiedenis, useVoorraad } from '../lib/queries2'
import { volgendeWeek } from '../lib/week'
import { WeekVraag } from '../components/WeekVraag'
import { useFases, type FaseRecept } from '../lib/fases'
import { useHartje } from '../components/Hartje'
import { useWeekWissel } from '../lib/weekwissel'
import { vulAan } from '../lib/weekvullen'
import { tokoIngredienten } from '../lib/toko'
import { TokoLabel } from '../components/TokoLabel'
import { BonusLabel } from '../components/Bonus'
import { receptBonusProducten, useBonus, type BonusProduct } from '../lib/bonus'
import { standaardPersonen } from '../lib/menu'
import {
  cijferTekst, isFavorietCijfer, isLaagCijfer, useBeoordelingBewaren, useBeoordelingen, useLaagCijferWissen,
  type LaatsteBeoordeling,
} from '../lib/beoordeling'
import type { Recept } from '../lib/database.types'

type Tab = 'koken' | 'bestellen' | 'gekookt'

const TABS: { id: Tab; label: string }[] = [
  { id: 'koken', label: 'Te koken' },
  { id: 'bestellen', label: 'Nog bestellen' },
  { id: 'gekookt', label: 'Eerder gekookt' },
]

type Sortering = 'nieuwste' | 'cijfer' | 'notitie'

/** Vanaf zoveel eerder gekookte recepten is sorteren zinvol. */
const SORTEER_VANAF = 3

/**
 * Eerder gekookt dat je wegtikte. Alleen op dit toestel: het recept blijft in
 * je geschiedenis (Profiel → Geschiedenis), het hoeft hier alleen niet meer te staan.
 */
const WEG_GEKOOKT = 'pinch-weg-gekookt'

function leesWegGekookt(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(WEG_GEKOOKT) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function bewaarWegGekookt(ids: Set<string>): void {
  try {
    localStorage.setItem(WEG_GEKOOKT, JSON.stringify([...ids]))
  } catch {
    // Privémodus of geblokkeerde opslag: dan is het alleen deze sessie weg.
  }
}

/** De kaarten wisselen af tussen de twee roodtinten — het merkritme uit de designs. */
const VLAKKEN = ['var(--c-red)', 'var(--c-red-bright)']

/** De baan met de twee onderdelen naast elkaar: geen schuifbalk, die zit in de chips. */
const BAAN_STIJL = '.weekbaan{scrollbar-width:none}.weekbaan::-webkit-scrollbar{display:none}'

const KOPJE: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'rgba(43,20,32,0.6)',
}

const ROOSTER: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12,
}

/** "14 okt": de dag van je bestelling. */
function datumLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '')
}

/** Een recept van elders (eerder gekookt) in de vorm van een kaart. */
function alsKaart(recept: Recept, status: FaseRecept | undefined): WeekRecept {
  return status ?? {
    ...recept, positie: null, gekozen: false, aantal: 0, opLijst: false,
    gekooktOp: null, besteldOp: null, opgeruimdOp: null,
  }
}

/**
 * Mijn recepten: waar een recept in staat hangt af van de fase, niet van de
 * kalenderweek (lib/fases.ts). Twee onderdelen naast elkaar; je veegt
 * ertussen, of tikt op een chip en de baan schuift zelf (scroll-snap).
 *
 * - Te koken: wat op een bevestigde bestelling stond. De knop kookt; het
 *   kruisje opent "Viel het in de smaak?" (cijfer en notitie, allebei niet
 *   verplicht) en zet het dan bij Eerder gekookt.
 * - Nog bestellen: wat je koos (ook met het hartje) en de suggesties van het
 *   weekmenu. Elk recept staat er één keer, in het bovenste blok waar het in
 *   hoort. Vul mijn week vult aan tot je kookavonden (lib/weekvullen.ts),
 *   alleen uit de suggesties.
 * - Eerder gekookt: wat je kookte, met je cijfer en notitie. Een recept met
 *   een 5 of lager staat er grijs, met "Zet terug".
 *
 * Je eigen recepten staan niet hier maar in Ontdekken (Mijn recepten).
 *
 * De kaarten zien er overal hetzelfde uit; alleen de knop eronder zegt in
 * welke fase een recept zit. De bonus staat alleen bij Nog bestellen: na het
 * bestellen zegt die je niets meer.
 */
export function MijnRecepten() {
  const fases = useFases()
  const { teKoken, nogBestellen, suggesties, bestelWeek, week } = fases
  const komende = volgendeWeek(week)
  const navigeer = useNavigate()
  const vanaf = useLocation().state as { tab?: Tab } | null
  const [tab, setTab] = useState<Tab>(vanaf?.tab ?? 'koken')
  const baan = useRef<HTMLDivElement>(null)

  const voorkeuren = useVoorkeuren()
  const personen = voorkeuren.data?.aantal_personen ?? 4
  // Twee weken onder de motorkap: elke rij weet in welke week die staat.
  const lijstDeze = useOpLijst(week)
  const lijstKomende = useOpLijst(komende)
  const actiesDeze = useLijstActies(week)
  const actiesKomende = useLijstActies(komende)
  const lijst = (r: { week: string }) => (r.week === komende ? lijstKomende : lijstDeze)
  const acties = (r: { week: string }) => (r.week === komende ? actiesKomende : actiesDeze)
  const { gekookt } = useWeekWissel()

  // Staat het op je lijst, dan vragen we eerst: dan gaan er ook boodschappen af.
  const [wegVraag, setWegVraag] = useState<FaseRecept | null>(null)
  // Het blad "Viel het in de smaak?": bij het kruisje (je kookte net) of achteraf bij Eerder gekookt.
  const [cijferVoor, setCijferVoor] = useState<
    | { soort: 'koken'; recept: FaseRecept }
    | { soort: 'achteraf'; recept: Recept; gekooktOp: string | null; daarnaWeg?: boolean }
    | null
  >(null)
  const beoordelingen = useBeoordelingen()
  const bewaar = useBeoordelingBewaren()
  const zetTerug = useLaagCijferWissen()
  const hartje = useHartje()

  const plek = (doel: Tab) => TABS.findIndex((t) => t.id === doel)

  // Kom je ergens vandaan met een onderdeel ("Nog bestellen"), dan sta je er meteen, zonder schuiven.
  useLayoutEffect(() => {
    if (vanaf?.tab && baan.current) baan.current.scrollLeft = plek(vanaf.tab) * baan.current.clientWidth
  }, [vanaf?.tab])

  // Niets te koken maar wel iets te bestellen: dan begin je daar. Eén keer, bij het openen.
  const gekozenStart = useRef(Boolean(vanaf?.tab))
  const geladen = fases.query.isSuccess && fases.komendeQuery.isSuccess
  useEffect(() => {
    if (gekozenStart.current || !geladen) return
    gekozenStart.current = true
    if (teKoken.length === 0 && baan.current) {
      baan.current.scrollLeft = plek('bestellen') * baan.current.clientWidth
      setTab('bestellen')
    }
  }, [geladen, teKoken.length])

  function naar(doel: Tab) {
    const el = baan.current
    if (!el) return
    const rustig = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: plek(doel) * el.clientWidth, behavior: rustig ? 'auto' : 'smooth' })
  }

  // Terug van een recept moet je weer in hetzelfde onderdeel staan, niet bij
  // Te koken: dat onthoudt deze pagina in haar eigen geschiedenis.
  function open(receptId: string) {
    navigeer('/mijn-recepten', { replace: true, state: { tab } })
    navigeer(`/recept/${receptId}`)
  }

  /* ------------------------------------------------- eerder gekookt */

  const geschiedenis = useGeschiedenis()
  const [wegGekookt, setWegGekookt] = useState(leesWegGekookt)
  function haalGekooktWeg(id: string) {
    const nieuw = new Set(wegGekookt).add(id)
    bewaarWegGekookt(nieuw)
    setWegGekookt(nieuw)
  }
  const [sortering, setSortering] = useState<Sortering>('nieuwste')
  const eerderGekookt = useMemo(() => {
    // Wat nu bij Te koken staat is net opnieuw besteld: dat staat daar.
    const gezien = new Set(teKoken.map((r) => r.id))
    // Het laatst gekookte eerst; elk recept één keer, met de dag van de laatste keer.
    const rijen = (geschiedenis.data ?? []).flatMap((w) => w.gekozen).filter((g) => g.gekooktOp)
    rijen.sort((a, b) => b.gekooktOp!.localeCompare(a.gekooktOp!))
    const lijst = rijen
      .filter((g) => !wegGekookt.has(g.recept.id))
      .filter((g) => !gezien.has(g.recept.id) && Boolean(gezien.add(g.recept.id)))
      .map((g) => ({ recept: g.recept, gekooktOp: g.gekooktOp! }))
    const cijferVan = (id: string) => beoordelingen.perRecept.get(id)?.cijfer ?? 0
    if (sortering === 'cijfer') return lijst.sort((a, b) => cijferVan(b.recept.id) - cijferVan(a.recept.id))
    if (sortering === 'notitie') {
      return lijst.sort((a, b) =>
        Number(Boolean(beoordelingen.perRecept.get(b.recept.id)?.notitie))
        - Number(Boolean(beoordelingen.perRecept.get(a.recept.id)?.notitie)))
    }
    return lijst
  }, [teKoken, geschiedenis.data, wegGekookt, sortering, beoordelingen.perRecept])

  const gemiddeldCijfer = useMemo(() => {
    const cijfers = eerderGekookt.map((g) => beoordelingen.perRecept.get(g.recept.id)?.cijfer).filter((c): c is number => c != null)
    return cijfers.length > 0 ? cijfers.reduce((a, b) => a + b, 0) / cijfers.length : null
  }, [eerderGekookt, beoordelingen.perRecept])

  const bonus = useBonus()
  const bonusPerRecept = useMemo(
    () => new Map([...nogBestellen, ...suggesties, ...eerderGekookt.map((g) => g.recept)]
      .map((r) => [r.id, receptBonusProducten(r.ingredienten, bonus.data)])),
    [nogBestellen, suggesties, eerderGekookt, bonus.data],
  )

  /* ------------------------------------------------------- Vul mijn week */

  const voorraad = useVoorraad()
  const [vullen, setVullen] = useState(false)
  async function vulMijnWeek() {
    const v = voorkeuren.data
    if (!v || vullen) return
    const inHuis = new Set((voorraad.data ?? []).filter((i) => i.in_huis).map((i) => i.ingredient_key))
    const ids = vulAan(
      suggesties.map((r) => ({ ...r, inBonus: (bonusPerRecept.get(r.id) ?? []).length > 0 })),
      { vega_minimum: v.vega_minimum, kookavonden: v.kookavonden ?? 4 },
      nogBestellen,
      inHuis,
    )
    setVullen(true)
    try {
      // Na elkaar: elk recept schrijft zijn eigen regels op de boodschappenlijst.
      const { zetOpLijst } = bestelWeek === komende ? actiesKomende : actiesDeze
      for (const receptId of ids) await zetOpLijst.mutateAsync({ receptId, automatisch: true })
    } finally {
      setVullen(false)
    }
  }

  /* ------------------------------------------------------------- kaarten */

  const kaartTeKoken = (recept: FaseRecept, i: number) => (
    <ReceptKaart
      key={recept.id}
      recept={recept}
      vlak={VLAKKEN[i % VLAKKEN.length]}
      personen={standaardPersonen(recept, personen)}
      knop={{ tekst: 'Koken', icoon: 'chefHat' }}
      onOpen={() => open(recept.id)}
      onKnop={() => navigeer(`/koken/${recept.id}`)}
      cijferKnop={{ label: 'Gekookt', onClick: () => setCijferVoor({ soort: 'koken', recept }) }}
    />
  )

  const kaartBestellen = (recept: FaseRecept, i: number) => (
    <ReceptKaart
      key={recept.id}
      recept={recept}
      vlak={VLAKKEN[i % VLAKKEN.length]}
      bonus={bonusPerRecept.get(recept.id) ?? []}
      personen={standaardPersonen(recept, personen)}
      knop={{ tekst: knopTekst(recept), icoon: recept.opLijst ? 'check' : 'plus' }}
      onOpen={() => open(recept.id)}
      onKnop={() => lijst(recept).voegToe({ ...recept, titel: recept.titel_nl ?? recept.titel })}
      weg={{
        label: 'Weghalen',
        onClick: () => (recept.opLijst ? setWegVraag(recept) : acties(recept).haalUitWeek.mutate(recept.id)),
      }}
    />
  )

  /**
   * Een eerder gekookt recept: met je cijfer en notitie. Linksboven het kruisje
   * (uit dit onderdeel; zonder cijfer vraagt het eerst om een cijfer, voor een
   * volgende keer), rechtsboven het hartje (terug naar Nog bestellen). Onder de
   * kaart alleen "Cijfer", zolang je dat niet gaf. Met een 5 of lager staat het
   * grijs, met "Zet terug".
   */
  const kaartGekookt = ({ recept, gekooktOp }: { recept: Recept; gekooktOp: string }, i: number) => {
    const status = [...nogBestellen, ...suggesties].find((r) => r.id === recept.id)
    const kaart = alsKaart(recept, status)
    const mijn: LaatsteBeoordeling | undefined = beoordelingen.perRecept.get(recept.id)
    const laag = isLaagCijfer(mijn?.cijfer)
    return (
      <ReceptKaart
        key={recept.id}
        recept={kaart}
        vlak={VLAKKEN[i % VLAKKEN.length]}
        bonus={bonusPerRecept.get(recept.id) ?? []}
        personen={standaardPersonen(recept, personen)}
        knop={laag ? { tekst: 'Zet terug', icoon: 'arrowRight' } : undefined}
        onOpen={() => open(recept.id)}
        onKnop={() => zetTerug.mutate(recept.id)}
        weg={{
          label: 'Weghalen',
          links: true,
          onClick: () => mijn?.cijfer == null
            ? setCijferVoor({ soort: 'achteraf', recept, gekooktOp, daarnaWeg: true })
            : haalGekooktWeg(recept.id),
        }}
        hartje={laag ? undefined : { aan: hartje.bewaard.has(recept.id), onClick: () => hartje.tik(recept) }}
        cijfer={mijn?.cijfer ?? null}
        metaRegel={[`Gekookt ${datumLabel(gekooktOp)}`, mijn?.cijfer != null ? `Cijfer ${mijn.cijfer}` : null, mijn?.notitie].filter(Boolean).join(' · ')}
        gedempt={laag}
        cijferKnop={mijn?.cijfer == null ? { label: 'Cijfer', onClick: () => setCijferVoor({ soort: 'achteraf', recept, gekooktOp }) } : undefined}
      />
    )
  }

  /* ---------------------------------------------------------------- kop */

  const laatsteBestelling = teKoken.map((r) => r.besteldOp!).sort().at(-1)
  const opLijst = nogBestellen.filter((r) => r.opLijst).length
  const voor = `voor ${personen} ${personen === 1 ? 'persoon' : 'personen'}`
  const kop: Record<Tab, { label: string | null; titel: string; sub: string }> = {
    koken: {
      label: laatsteBestelling ? `Besteld ${datumLabel(laatsteBestelling)}` : null,
      titel: 'Wat kook jij vanavond?',
      sub: `${teKoken.length} te koken · ${voor}`,
    },
    bestellen: {
      label: null,
      titel: 'Wat eet jij hierna?',
      sub: `${nogBestellen.length} nog te bestellen · ${voor}`,
    },
    gekookt: {
      label: null,
      titel: 'Wat kook jij nog eens?',
      sub: `${eerderGekookt.length} eerder gekookt${gemiddeldCijfer != null ? ` · gemiddeld ${cijferTekst(gemiddeldCijfer)}` : ''}`,
    },
  }

  return (
    <Scherm>
      <BespaardMelding />
      <Grens query={fases.query} ladenTekst="Je recepten ophalen">
        {/* Compact: de recepten zijn waar het om gaat, niet de kop. */}
        <Kop kleur="var(--c-red-bright)" style={{ paddingBottom: 14 }}>
          <Label>{kop[tab].label ?? 'Mijn recepten'}</Label>
          <div style={{ marginTop: 6 }}>
            <Titel grootte={22}>{kop[tab].titel}</Titel>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, margin: '6px 0 0' }}>
            {kop[tab].sub}
          </p>
        </Kop>

        <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '12px 22px 4px', overflowX: 'auto' }}>
          {TABS.map((t) => (
            <Chip key={t.id} selected={tab === t.id} onClick={() => naar(t.id)}>{t.label}</Chip>
          ))}
        </div>

        <style>{BAAN_STIJL}</style>
        <div
          ref={baan}
          className="weekbaan"
          onScroll={(e) => {
            const el = e.currentTarget
            const nu = TABS[Math.min(TABS.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))].id
            if (nu !== tab) setTab(nu)
          }}
          style={{
            flex: 1, minHeight: 0, display: 'flex', overflowX: 'auto', overflowY: 'hidden',
            scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch',
          }}
        >
          <Paneel verborgen={tab !== 'koken'}>
            {teKoken.length === 0 ? (
              <Leeg
                icoon="chefHat"
                kop="Niets te koken"
                tekst="Zodra je boodschappen binnen zijn, staan de recepten hier. Kies bij Nog bestellen wat je wilt eten."
                knop="Naar Nog bestellen"
                onKnop={() => naar('bestellen')}
              />
            ) : (
              <Inhoud style={{ padding: '8px 22px 16px', gap: 0 }}>
                <span style={{ ...KOPJE, paddingBottom: 10 }}>{teKoken.length} te koken</span>
                <div style={ROOSTER}>{teKoken.map(kaartTeKoken)}</div>
              </Inhoud>
            )}
          </Paneel>

          <Paneel verborgen={tab !== 'bestellen'}>
            {fases.komendeQuery.isError ? (
              <Leeg
                icoon="utensils"
                kop="Dat lukte niet"
                tekst="We konden je recepten niet ophalen. Er is niets kwijt."
                knop="Probeer opnieuw"
                onKnop={() => void fases.komendeQuery.refetch()}
              />
            ) : nogBestellen.length + suggesties.length === 0 ? (
              <Leeg
                icoon="utensils"
                kop={fases.komendeQuery.isLoading ? 'Even zoeken…' : 'Nog niets om te bestellen'}
                tekst="Zoek in Ontdekken wat je wilt eten en tik op het hartje: dan staat het hier."
                knop="Naar Ontdekken"
                onKnop={() => navigeer('/ontdekken')}
              />
            ) : (
              <Inhoud style={{ padding: '8px 22px 16px', gap: 0 }}>
                {suggesties.length > 0 && (
                  <Button
                    variant="secondary" icon="shuffle" disabled={vullen || !voorkeuren.data}
                    onClick={() => void vulMijnWeek()}
                    style={{ width: '100%', marginBottom: 16 }}
                  >{vullen ? 'Even kiezen…' : 'Vul mijn week'}</Button>
                )}
                {nogBestellen.length > 0 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 10 }}>
                      <span style={KOPJE}>{nogBestellen.length} nog te bestellen</span>
                      {opLijst > 0 && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)' }}>
                          {opLijst} op je lijst
                        </span>
                      )}
                    </div>
                    <div style={{ ...ROOSTER, paddingBottom: 18 }}>{nogBestellen.map(kaartBestellen)}</div>
                  </>
                )}
                {suggesties.length > 0 && (
                  <>
                    <span style={{ ...KOPJE, paddingBottom: 10 }}>Suggesties · {suggesties.length}</span>
                    <div style={ROOSTER}>{suggesties.map((r, i) => kaartBestellen(r, i + nogBestellen.length))}</div>
                  </>
                )}
              </Inhoud>
            )}
          </Paneel>

          <Paneel verborgen={tab !== 'gekookt'}>
            {eerderGekookt.length === 0 ? (
              <Leeg
                icoon="chefHat"
                kop="Nog niets gekookt"
                tekst="Zodra je een recept als gekookt aftikt, staat het hier, met je cijfer en notitie voor de volgende keer."
                knop="Naar Te koken"
                onKnop={() => naar('koken')}
              />
            ) : (
              <>
                {/* Buiten de scroll, zodat de kaarten er nooit overheen schuiven. */}
                {eerderGekookt.length >= SORTEER_VANAF && (
                  <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '8px 22px 4px', overflowX: 'auto' }}>
                    {([['nieuwste', 'Nieuwste eerst'], ['cijfer', 'Hoogste cijfer'], ['notitie', 'Met notitie']] as const).map(([id, label]) => (
                      <Chip key={id} selected={sortering === id} onClick={() => setSortering(id)}>{label}</Chip>
                    ))}
                  </div>
                )}
                <Inhoud style={{ padding: '8px 22px 16px', gap: 0 }}>
                  <div style={ROOSTER}>{eerderGekookt.map(kaartGekookt)}</div>
                </Inhoud>
              </>
            )}
          </Paneel>

        </div>
      </Grens>

      {lijstDeze.dialoog}
      {lijstKomende.dialoog}
      <WeekVraag />
      {cijferVoor && (
        <CijferSheet
          recept={cijferVoor.recept}
          personen={standaardPersonen(cijferVoor.recept, personen)}
          gekooktOp={cijferVoor.soort === 'achteraf' && cijferVoor.gekooktOp ? new Date(cijferVoor.gekooktOp) : undefined}
          onSluit={() => setCijferVoor(null)}
          onOverslaan={() => {
            if (cijferVoor.soort === 'koken') {
              gekookt.mutate({ receptId: cijferVoor.recept.id, opruimen: true, inWeek: cijferVoor.recept.week })
            } else if (cijferVoor.daarnaWeg) haalGekooktWeg(cijferVoor.recept.id)
            setCijferVoor(null)
          }}
          onKlaar={({ cijfer, notitie }) => {
            if (cijferVoor.soort === 'koken') {
              gekookt.mutate({ receptId: cijferVoor.recept.id, opruimen: true, inWeek: cijferVoor.recept.week })
            }
            bewaar.mutate({
              receptId: cijferVoor.recept.id, cijfer, notitie,
              gekooktOp: cijferVoor.soort === 'achteraf' ? cijferVoor.gekooktOp?.slice(0, 10) : undefined,
            })
            if (cijferVoor.soort === 'achteraf' && cijferVoor.daarnaWeg) haalGekooktWeg(cijferVoor.recept.id)
            setCijferVoor(null)
          }}
        />
      )}
      <Dialoog
        open={bewaar.isError}
        kop="Cijfer bewaren lukte niet"
        tekst={`Je recept staat wel bij gekookt. Probeer het cijfer straks nog eens via Cijfer op de kaart.${
          bewaar.error ? ` (${(bewaar.error as { message?: string }).message ?? 'onbekende fout'})` : ''}`}
        onSluit={() => bewaar.reset()}
        acties={[{ label: 'Oké', hoofd: true, onClick: () => bewaar.reset() }]}
      />
      <Dialoog
        open={Boolean(wegVraag)}
        kop="Weghalen?"
        tekst={wegVraag
          ? `${wegVraag.titel_nl ?? wegVraag.titel} staat op je boodschappenlijst. De ingrediënten gaan er dan ook af.`
          : undefined}
        onSluit={() => setWegVraag(null)}
        acties={[
          { label: 'Ja, haal weg', hoofd: true, onClick: () => { if (wegVraag) acties(wegVraag).haalUitWeek.mutate(wegVraag.id); setWegVraag(null) } },
          { label: 'Laat maar', onClick: () => setWegVraag(null) },
        ]}
      />
      <OnderBalk />
    </Scherm>
  )
}

/**
 * Eén onderdeel in de baan: precies een scherm breed, met een eigen scroll omlaag.
 * Wat niet in beeld is doet niet mee voor toetsenbord en schermlezer.
 */
function Paneel({ children, verborgen }: { children: React.ReactNode; verborgen: boolean }) {
  return (
    <section
      aria-hidden={verborgen}
      inert={verborgen}
      style={{
        flex: '0 0 100%', width: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
      }}
    >{children}</section>
  )
}

/**
 * Tekst op de knop onder een kaart: wat er met dit recept aan de hand is.
 * Staat het nog niet op je lijst, dan zegt de knop wat een tik doet.
 */
function knopTekst(recept: WeekRecept): string {
  if (recept.opLijst) return recept.aantal > 1 ? `Op je lijst · ${recept.aantal}x` : 'Op je lijst'
  return 'Zet op je lijst'
}

function ReceptKaart({ recept, vlak, bonus = [], personen, knop, onOpen, onKnop, weg, hartje, cijfer = null, metaRegel, gedempt = false, cijferKnop }: {
  recept: WeekRecept
  vlak: string
  /** Producten van het recept in de bonus bij je winkel: het gele label op de foto. Alleen bij Nog bestellen. */
  bonus?: BonusProduct[]
  personen: number
  /** De knop onder de kaart: wat een tik doet, of hoe het recept ervoor staat. Zonder knop alleen de cijferknop. */
  knop?: { tekst: string; icoon: string }
  onOpen: () => void
  onKnop: () => void
  /** Het kruisje op de foto: weghalen. Rechtsboven, of met `links` linksboven. */
  weg?: { label: string; onClick: () => void; links?: boolean }
  /** Het hartje rechtsboven: naar Nog bestellen. */
  hartje?: { aan: boolean; onClick: () => void }
  /** Jouw cijfer: de bol op de foto (geel vanaf 8, wit daaronder). Alleen bij Eerder gekookt. */
  cijfer?: number | null
  /** Een regel onder de meta, zoals "Gekookt 20 okt · minder chili". */
  metaRegel?: string
  /** Grijs: een recept dat je niet meer terug wilt zien. */
  gedempt?: boolean
  /** Een tweede knop naast de eerste: "Gekookt" bij Te koken, of achteraf een cijfer geven. */
  cijferKnop?: { label: string; onClick: () => void }
}) {
  const toko = useMemo(() => tokoIngredienten(recept.ingredienten).length > 0, [recept.ingredienten])
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 20, padding: 4,
      // Een gele ring betekent: staat op je boodschappenlijst.
      background: recept.opLijst ? 'var(--c-yellow)' : 'transparent',
      transition: 'background var(--motion-base) var(--ease)',
      ...(gedempt ? { opacity: 0.55, filter: 'grayscale(1)' } : {}),
    }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
      {toko && <TokoLabel links={weg?.links ? 50 : 8} />}
      <BonusLabel producten={bonus} />
      <button
        onClick={onOpen}
        style={{
          // Een knop centreert zijn inhoud verticaal; zonder flex-start schuift
          // de foto omlaag in een hogere kaart en zie je een rode rand erboven.
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
          background: vlak, borderRadius: 'var(--radius-md)', border: 'none',
          overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--c-paper)',
        }}
      >
        <div style={{
          width: '100%', aspectRatio: '4 / 3', flex: 'none',
          background: recept.afbeelding_url ? `url(${recept.afbeelding_url}) center/cover` : 'rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-body)', fontSize: 12, opacity: recept.afbeelding_url ? 1 : 0.5,
          position: 'relative',
        }}>
          {cijfer != null && (
            <span aria-label={`Jouw cijfer: ${cijfer}`} style={{
              position: 'absolute', right: 8, bottom: 8, minWidth: 28, height: 28, boxSizing: 'border-box', padding: '0 6px',
              borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, opacity: 1,
              background: isFavorietCijfer(cijfer) ? 'var(--c-yellow)' : 'var(--c-paper)', color: 'var(--c-ink)',
            }}>{cijfer}</span>
          )}
          {/* Een samengesteld recept krijgt nooit een foto: dan ook geen belofte. */}
          {recept.afbeelding_url || recept.bron_type === 'samengesteld' ? '' : 'foto'}
        </div>
        {/* Het gele bonuslabel staat linksonder over de kaart: laat er ruimte voor als er een metaregel is. */}
        <div style={{ padding: `10px 12px ${metaRegel && bonus.length > 0 ? 40 : 12}px`, width: '100%', boxSizing: 'border-box' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, lineHeight: 1,
            margin: 0, textTransform: 'uppercase', minHeight: '2em',
            // Twee regels, dan afkappen: alle kaarten even hoog, vier in beeld.
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{recept.titel_nl ?? recept.titel}</h3>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, opacity: 0.85 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Icon name="clock" size={13} />{recept.bereidingstijd_minuten ?? '?'} min
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Icon name="users" size={13} />{personen}
            </span>
          </div>
          {metaRegel && (
            <div style={{
              fontSize: 12, marginTop: 4, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{metaRegel}</div>
          )}
        </div>
      </button>

      {weg && <button
        onClick={weg.onClick}
        aria-label={weg.label}
        style={{
          position: 'absolute', top: 10, ...(weg.links ? { left: 10 } : { right: 10 }), width: 32, height: 32,
          borderRadius: 'var(--radius-full)', background: 'rgba(43,20,32,0.34)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: 'var(--c-paper)',
        }}
      ><Icon name="x" size={16} /></button>}
      {hartje && <button
        onClick={hartje.onClick}
        aria-label={hartje.aan ? 'Haal uit Nog bestellen' : 'Zet bij Nog bestellen'}
        aria-pressed={hartje.aan}
        style={{
          position: 'absolute', top: 10, right: 10, width: 32, height: 32,
          borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hartje.aan ? 'var(--c-red)' : 'rgba(255,255,255,0.92)',
          color: hartje.aan ? 'var(--c-cream)' : 'var(--c-red)',
          boxShadow: '0 2px 8px rgba(43,20,32,0.18)',
        }}
      ><Icon name="heart" size={16} /></button>}
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '0 4px 4px' }}>
      {knop && <button
        onClick={onKnop}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34,
          borderRadius: 'var(--radius-full)', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, background: 'var(--c-paper)',
          border: `1.5px solid ${recept.opLijst ? 'var(--c-red)' : 'rgba(43,20,32,0.14)'}`,
          color: recept.opLijst ? 'var(--c-red)' : 'var(--c-ink)',
        }}
      >
        <Icon name={knop.icoon} size={14} />
        {knop.tekst}
      </button>}
      {cijferKnop && (
        <button
          onClick={cijferKnop.onClick}
          style={{
            flex: knop ? 'none' : 1, height: 34, padding: '0 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, background: 'var(--c-paper)',
            border: '1.5px solid rgba(43,20,32,0.14)', color: 'var(--c-ink)',
          }}
        >{cijferKnop.label}</button>
      )}
      </div>
    </div>
  )
}
