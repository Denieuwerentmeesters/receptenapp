import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Chip, Icon, Woordmerk } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { BespaardMelding } from '../components/BespaardMelding'
import { useOpLijst } from '../components/OpLijst'
import { useLijstActies, useVoorkeuren, type WeekRecept } from '../lib/queries'
import { useGeschiedenis, useVoorraad } from '../lib/queries2'
import { volgendeWeek } from '../lib/week'
import { WeekVraag } from '../components/WeekVraag'
import { useFases, type FaseRecept } from '../lib/fases'
import { useWeekWissel } from '../lib/weekwissel'
import { vulAan } from '../lib/weekvullen'
import { tokoIngredienten } from '../lib/toko'
import { TokoLabel } from '../components/TokoLabel'
import { BonusLabel } from '../components/Bonus'
import { receptBonusProducten, useBonus, type BonusProduct } from '../lib/bonus'
import { standaardPersonen } from '../lib/menu'
import type { Recept } from '../lib/database.types'

type Tab = 'koken' | 'bestellen'

const TABS: { id: Tab; label: string }[] = [
  { id: 'koken', label: 'Te koken' },
  { id: 'bestellen', label: 'Nog bestellen' },
]

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
  textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)',
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
 *   kruisje vraagt "Gekookt?" en zet het dan bij Eerder gekookt.
 * - Nog bestellen: wat je koos (ook met het hartje), de suggesties van het
 *   weekmenu en onderaan wat je eerder kookte. Elk recept staat er één keer,
 *   in het bovenste blok waar het in hoort. Vul mijn week vult aan tot je
 *   kookavonden (lib/weekvullen.ts), alleen uit de suggesties.
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
  const opLijstVoorNieuw = bestelWeek === komende ? lijstKomende : lijstDeze
  const { gekookt } = useWeekWissel()

  // Staat het op je lijst, dan vragen we eerst: dan gaan er ook boodschappen af.
  const [wegVraag, setWegVraag] = useState<FaseRecept | null>(null)
  const [gekooktVraag, setGekooktVraag] = useState<FaseRecept | null>(null)

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
  const eerderGekookt = useMemo(() => {
    // Wat al bij Te koken, Nog bestellen of de suggesties staat, staat daar: niet nog eens.
    const gezien = new Set([...teKoken, ...nogBestellen, ...suggesties].map((r) => r.id))
    const eenKeer = (r: Recept) => !gezien.has(r.id) && Boolean(gezien.add(r.id))
    // Eerder gekookt: het laatst gekookte eerst.
    const rijen = (geschiedenis.data ?? []).flatMap((w) => w.gekozen).filter((g) => g.gekooktOp)
    rijen.sort((a, b) => b.gekooktOp!.localeCompare(a.gekooktOp!))
    return rijen.map((g) => g.recept).filter((r) => !wegGekookt.has(r.id)).filter(eenKeer)
  }, [teKoken, nogBestellen, suggesties, geschiedenis.data, wegGekookt])

  const bonus = useBonus()
  const bonusPerRecept = useMemo(
    () => new Map([...nogBestellen, ...suggesties, ...eerderGekookt]
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
      weg={{ label: 'Gekookt?', onClick: () => setGekooktVraag(recept) }}
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
   * Een eerder gekookt recept: staat nog nergens, dus het plusje zet het op je
   * lijst. Het kruisje haalt het uit dit blok.
   */
  const kaartGekookt = (recept: Recept, i: number) => {
    const kaart = alsKaart(recept, undefined)
    return (
      <ReceptKaart
        key={recept.id}
        recept={kaart}
        vlak={VLAKKEN[i % VLAKKEN.length]}
        bonus={bonusPerRecept.get(recept.id) ?? []}
        personen={standaardPersonen(recept, personen)}
        knop={{ tekst: knopTekst(kaart), icoon: 'plus' }}
        onOpen={() => open(recept.id)}
        onKnop={() => opLijstVoorNieuw.voegToe({ ...kaart, titel: recept.titel_nl ?? recept.titel })}
        weg={{ label: 'Weghalen', onClick: () => haalGekooktWeg(recept.id) }}
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
  }

  return (
    <Scherm>
      <BespaardMelding />
      <Grens query={fases.query} ladenTekst="Je recepten ophalen">
        {/* Compact: de recepten zijn waar het om gaat, niet de kop. */}
        <Kop kleur="var(--c-red-bright)" style={{ paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 }}>
            <Label>{kop[tab].label ?? 'Mijn recepten'}</Label>
            <Woordmerk hoogte={24} />
          </div>
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
            ) : nogBestellen.length + suggesties.length + eerderGekookt.length === 0 ? (
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
                    <div style={{ ...ROOSTER, paddingBottom: 18 }}>{suggesties.map((r, i) => kaartBestellen(r, i + nogBestellen.length))}</div>
                  </>
                )}
                {eerderGekookt.length > 0 && (
                  <>
                    <span style={{ ...KOPJE, paddingBottom: 10 }}>Eerder gekookt · {eerderGekookt.length}</span>
                    <div style={ROOSTER}>{eerderGekookt.map(kaartGekookt)}</div>
                  </>
                )}
              </Inhoud>
            )}
          </Paneel>

        </div>
      </Grens>

      {lijstDeze.dialoog}
      {lijstKomende.dialoog}
      <WeekVraag />
      <Dialoog
        open={Boolean(gekooktVraag)}
        kop="Gekookt?"
        tekst={gekooktVraag
          ? `Dan haal je ${gekooktVraag.titel_nl ?? gekooktVraag.titel} weg bij Te koken. Je vindt het terug bij Nog bestellen, onder Eerder gekookt.`
          : undefined}
        onSluit={() => setGekooktVraag(null)}
        sluitTekst="Annuleer"
        acties={[{
          label: 'Gekookt',
          hoofd: true,
          onClick: () => {
            if (gekooktVraag) gekookt.mutate({ receptId: gekooktVraag.id, opruimen: true, inWeek: gekooktVraag.week })
            setGekooktVraag(null)
          },
        }]}
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

function ReceptKaart({ recept, vlak, bonus = [], personen, knop, onOpen, onKnop, weg }: {
  recept: WeekRecept
  vlak: string
  /** Producten van het recept in de bonus bij je winkel: het gele label op de foto. Alleen bij Nog bestellen. */
  bonus?: BonusProduct[]
  personen: number
  /** De knop onder de kaart: wat een tik doet, of hoe het recept ervoor staat. */
  knop: { tekst: string; icoon: string }
  onOpen: () => void
  onKnop: () => void
  /** Het kruisje op de foto: weghalen, of bij Te koken de vraag "Gekookt?". */
  weg?: { label: string; onClick: () => void }
}) {
  const toko = useMemo(() => tokoIngredienten(recept.ingredienten).length > 0, [recept.ingredienten])
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 20, padding: 4,
      // Een gele ring betekent: staat op je boodschappenlijst.
      background: recept.opLijst ? 'var(--c-yellow)' : 'transparent',
      transition: 'background var(--motion-base) var(--ease)',
    }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
      {toko && <TokoLabel />}
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
        }}>
          {/* Een samengesteld recept krijgt nooit een foto: dan ook geen belofte. */}
          {recept.afbeelding_url || recept.bron_type === 'samengesteld' ? '' : 'foto'}
        </div>
        <div style={{ padding: '10px 12px 12px', width: '100%', boxSizing: 'border-box' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, lineHeight: 1,
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
        </div>
      </button>

      {weg && <button
        onClick={weg.onClick}
        aria-label={weg.label}
        style={{
          position: 'absolute', top: 10, right: 10, width: 32, height: 32,
          borderRadius: 'var(--radius-full)', background: 'rgba(20,20,20,0.34)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: 'var(--c-paper)',
        }}
      ><Icon name="x" size={16} /></button>}
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '0 4px 4px' }}>
      <button
        onClick={onKnop}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34,
          borderRadius: 'var(--radius-full)', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, background: 'var(--c-paper)',
          border: `1.5px solid ${recept.opLijst ? 'var(--c-red)' : 'rgba(20,20,20,0.14)'}`,
          color: recept.opLijst ? 'var(--c-red)' : 'var(--c-ink)',
        }}
      >
        <Icon name={knop.icoon} size={14} />
        {knop.tekst}
      </button>
      </div>
    </div>
  )
}
