import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chip, Icon, Woordmerk } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { BespaardMelding } from '../components/BespaardMelding'
import { useOpLijst } from '../components/OpLijst'
import { useActieveWeek, useLijstActies, useVoorkeuren, type WeekRecept } from '../lib/queries'
import { volgendeWeek, weekLabel } from '../lib/week'
import { WeekVraag } from '../components/WeekVraag'
import { useWeekRecepten } from '../lib/weekoverzicht'
import { tokoIngredienten } from '../lib/toko'
import { TokoLabel } from '../components/TokoLabel'
import { BonusLabel } from '../components/Bonus'
import { receptBonusProducten, useBonus, type BonusProduct } from '../lib/bonus'
import { pastBijDieet } from '../lib/dieet'
import { standaardPersonen } from '../lib/menu'

type Tab = 'deze' | 'komende'

const TABS: { id: Tab; label: string }[] = [
  { id: 'deze', label: 'Deze week' },
  { id: 'komende', label: 'Komende week' },
]

/** De kaarten wisselen af tussen de twee roodtinten — het merkritme uit de designs. */
const VLAKKEN = ['var(--c-red)', 'var(--c-red-bright)']

/** De baan met de twee weken naast elkaar: geen schuifbalk, die zit in de chips. */
const BAAN_STIJL = '.weekbaan{scrollbar-width:none}.weekbaan::-webkit-scrollbar{display:none}'

const KOPJE: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)',
}

const ROOSTER: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12,
}

function isVega(recept: WeekRecept) {
  return pastBijDieet(recept, 'vegetarisch')
}

/**
 * Het startscherm: twee weken naast elkaar. Je veegt ertussen, of tikt op een
 * van de twee chips; de baan schuift dan zelf (scroll-snap, dus het vegen en
 * de animatie zijn van de browser).
 *
 * Deze week: de suggesties van de generator. Tik je een recept aan, dan gaat
 * het op je boodschappenlijst en krijgt het een gele rand; met het kruisje
 * haal je het uit je week. Heb je besteld, dan blijft alleen staan wat je
 * koos (lib/weekoverzicht.ts) en kook je hiervandaan.
 *
 * Komende week: wat je met het hartje bewaarde, en daaronder de suggesties
 * voor die week. Het werkt als deze week: op je lijst zetten, bestellen. De
 * recepten blijven daar staan tot deze week gekookt is en de week doorschuift
 * (lib/weekwissel.ts). De boodschappenlijst toont beide weken samen.
 */
export function DezeWeek() {
  const week = useActieveWeek()
  const komende = volgendeWeek(week)
  const navigeer = useNavigate()
  const vanaf = useLocation().state as { tab?: Tab; doorgeschoven?: boolean } | null
  const start = vanaf?.tab === 'komende' ? 'komende' : 'deze'
  // Net het laatste bestelde recept gekookt: de week is doorgeschoven.
  const [doorgeschoven, setDoorgeschoven] = useState(Boolean(vanaf?.doorgeschoven))
  const [tab, setTab] = useState<Tab>(start)
  const baan = useRef<HTMLDivElement>(null)

  const dezeWeek = useWeekRecepten(week)
  const komendeWeek = useWeekRecepten(komende)
  const voorkeuren = useVoorkeuren()
  const { voegToe, dialoog } = useOpLijst(week)
  const lijstStraks = useOpLijst(komende)
  const { haalUitWeek } = useLijstActies(week)
  const straks = useLijstActies(komende)
  // Staat het op je lijst, dan vragen we eerst: dan gaan er ook boodschappen af.
  const [wegVraag, setWegVraag] = useState<{ recept: WeekRecept; tab: Tab } | null>(null)

  // Kom je van het hartje ("Bekijk komende week"), dan sta je er meteen, zonder schuiven.
  useLayoutEffect(() => {
    if (start === 'komende' && baan.current) baan.current.scrollLeft = baan.current.clientWidth
  }, [start])

  function naar(doel: Tab) {
    const el = baan.current
    if (!el) return
    const rustig = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: doel === 'komende' ? el.clientWidth : 0, behavior: rustig ? 'auto' : 'smooth' })
  }

  const recepten = dezeWeek.recepten
  const bonus = useBonus()
  // Het label: een of meer producten in de bonus.
  const bonusPerRecept = useMemo(
    () => new Map([...recepten, ...komendeWeek.recepten].map((r) => [r.id, receptBonusProducten(r.ingredienten, bonus.data)])),
    [recepten, komendeWeek.recepten, bonus.data],
  )

  const opLijst = recepten.filter((r) => r.opLijst).length
  const personen = voorkeuren.data?.aantal_personen ?? 4
  const bewaard = komendeWeek.recepten.filter((r) => r.gekozen)
  const suggesties = komendeWeek.recepten.filter((r) => !r.gekozen)
  const inBeeld = tab === 'deze' ? recepten : komendeWeek.recepten

  const kaartDezeWeek = (recept: WeekRecept, i: number) => {
    // Besteld en van de lijst: de boodschappen zijn binnen, dus de knop kookt.
    const koken = Boolean(recept.besteldOp) && !recept.opLijst && !recept.gekooktOp
    return (
      <ReceptKaart
        key={recept.id}
        recept={recept}
        vlak={VLAKKEN[i % VLAKKEN.length]}
        bonus={bonusPerRecept.get(recept.id) ?? []}
        personen={standaardPersonen(recept, personen)}
        knop={koken ? { tekst: 'Koken', icoon: 'chefHat' } : { tekst: knopTekst(recept), icoon: recept.opLijst ? 'check' : 'plus' }}
        onOpen={() => navigeer(`/recept/${recept.id}`)}
        onKnop={() => (koken ? navigeer(`/koken/${recept.id}`) : voegToe({ ...recept, titel: recept.titel_nl ?? recept.titel }))}
        onWeg={() => (recept.opLijst ? setWegVraag({ recept, tab: 'deze' }) : haalUitWeek.mutate(recept.id))}
      />
    )
  }

  // Zelfde kaart als deze week, op de week erna: het recept blijft hier staan,
  // ook op je lijst en na het bestellen.
  const kaartKomendeWeek = (recept: WeekRecept, i: number) => {
    const koken = Boolean(recept.besteldOp) && !recept.opLijst && !recept.gekooktOp
    return (
      <ReceptKaart
        key={recept.id}
        recept={recept}
        vlak={VLAKKEN[i % VLAKKEN.length]}
        bonus={bonusPerRecept.get(recept.id) ?? []}
        personen={standaardPersonen(recept, personen)}
        knop={koken ? { tekst: 'Koken', icoon: 'chefHat' } : { tekst: knopTekst(recept), icoon: recept.opLijst ? 'check' : 'plus' }}
        onOpen={() => navigeer(`/recept/${recept.id}`)}
        onKnop={() => (koken ? navigeer(`/koken/${recept.id}`) : lijstStraks.voegToe({ ...recept, titel: recept.titel_nl ?? recept.titel }))}
        onWeg={() => (recept.opLijst ? setWegVraag({ recept, tab: 'komende' }) : straks.haalUitWeek.mutate(recept.id))}
      />
    )
  }

  return (
    <Scherm>
      <BespaardMelding />
      <Grens query={dezeWeek.query} ladenTekst="Je week ophalen">
        {/* Compact: de recepten zijn waar het om gaat, niet de kop. */}
        <Kop kleur="var(--c-red-bright)" style={{ paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Label>Week van {weekLabel(tab === 'deze' ? week : komende)}</Label>
            <Woordmerk hoogte={24} />
          </div>
          <div style={{ marginTop: 6 }}>
            <Titel grootte={22}>{tab === 'deze' ? 'Wat eet jij deze week?' : 'Wat eet jij komende week?'}</Titel>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, margin: '6px 0 0' }}>
            {inBeeld.length} recepten · {inBeeld.filter(isVega).length} vegetarisch · voor {personen} {personen === 1 ? 'persoon' : 'personen'}
          </p>
        </Kop>

        <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '12px 22px 4px' }}>
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
            const nu: Tab = el.scrollLeft > el.clientWidth / 2 ? 'komende' : 'deze'
            if (nu !== tab) setTab(nu)
          }}
          style={{
            flex: 1, minHeight: 0, display: 'flex', overflowX: 'auto', overflowY: 'hidden',
            scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch',
          }}
        >
          <Paneel verborgen={tab !== 'deze'}>
            {recepten.length === 0 ? (
              <Leeg
                icoon="utensils"
                kop="Nog geen weekmenu"
                tekst="We zetten elke week 10 recepten voor je klaar. Je voorkeuren kun je altijd nog aanpassen in Instellingen."
                knop={dezeWeek.query.isFetching ? 'Even zoeken…' : 'Zet mijn week klaar'}
                onKnop={() => { if (!dezeWeek.query.isFetching) void dezeWeek.query.refetch() }}
              />
            ) : (
              <Inhoud style={{ padding: '8px 22px 16px', gap: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 10 }}>
                  <span style={KOPJE}>
                    {dezeWeek.isBesteld ? `Besteld · ${recepten.length} om te koken` : `Alle ${recepten.length} recepten`}
                  </span>
                  {opLijst > 0 && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)' }}>
                      {opLijst} op je lijst
                    </span>
                  )}
                </div>
                <div style={ROOSTER}>{recepten.map(kaartDezeWeek)}</div>
              </Inhoud>
            )}
          </Paneel>

          <Paneel verborgen={tab !== 'komende'}>
            {komendeWeek.query.isError ? (
              <Leeg
                icoon="utensils"
                kop="Dat lukte niet"
                tekst="We konden komende week niet ophalen. Er is niets kwijt."
                knop="Probeer opnieuw"
                onKnop={() => void komendeWeek.query.refetch()}
              />
            ) : komendeWeek.recepten.length === 0 ? (
              <Leeg
                icoon="heart"
                kop={komendeWeek.query.isLoading ? 'Even zoeken…' : 'Nog niets voor komende week'}
                tekst="Tik in Ontdekken op het hartje bij een recept: dan staat het hier klaar."
                knop="Naar Ontdekken"
                onKnop={() => navigeer('/ontdekken')}
              />
            ) : (
              <Inhoud style={{ padding: '8px 22px 16px', gap: 0 }}>
                {bewaard.length > 0 && (
                  <>
                    <span style={{ ...KOPJE, paddingBottom: 10 }}>Jouw keuze · {bewaard.length}</span>
                    <div style={{ ...ROOSTER, paddingBottom: 18 }}>{bewaard.map(kaartKomendeWeek)}</div>
                  </>
                )}
                {suggesties.length > 0 && (
                  <>
                    <span style={{ ...KOPJE, paddingBottom: 10 }}>
                      {bewaard.length > 0 ? `Suggesties · ${suggesties.length}` : `${suggesties.length} suggesties`}
                    </span>
                    <div style={ROOSTER}>{suggesties.map((r, i) => kaartKomendeWeek(r, i + bewaard.length))}</div>
                  </>
                )}
              </Inhoud>
            )}
          </Paneel>
        </div>
      </Grens>

      {dialoog}
      {lijstStraks.dialoog}
      <WeekVraag />
      <Dialoog
        open={doorgeschoven}
        kop="Alles gekookt!"
        tekst="Komende week staat nu in Deze week. Zet op je lijst wat je wilt bestellen."
        onSluit={() => setDoorgeschoven(false)}
        acties={[{ label: 'Oké', hoofd: true, onClick: () => setDoorgeschoven(false) }]}
      />
      <Dialoog
        open={Boolean(wegVraag)}
        kop="Uit je week halen?"
        tekst={wegVraag
          ? `${wegVraag.recept.titel_nl ?? wegVraag.recept.titel} staat op je boodschappenlijst. De ingrediënten gaan er dan ook af.`
          : undefined}
        onSluit={() => setWegVraag(null)}
        acties={[
          { label: 'Ja, haal weg', hoofd: true, onClick: () => { if (wegVraag) (wegVraag.tab === 'deze' ? haalUitWeek : straks.haalUitWeek).mutate(wegVraag.recept.id); setWegVraag(null) } },
          { label: 'Laat maar', onClick: () => setWegVraag(null) },
        ]}
      />
      <OnderBalk />
    </Scherm>
  )
}

/**
 * Eén week in de baan: precies een scherm breed, met een eigen scroll omlaag.
 * De week die niet in beeld is doet niet mee voor toetsenbord en schermlezer.
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
  if (recept.gekooktOp) return 'Gekookt'
  return 'Zet op je lijst'
}

function ReceptKaart({ recept, vlak, bonus, personen, knop, onOpen, onKnop, onWeg }: {
  recept: WeekRecept
  vlak: string
  /** Producten van het recept in de bonus bij je winkel: het gele label op de foto. */
  bonus: BonusProduct[]
  personen: number
  /** De knop onder de kaart: wat een tik doet, of hoe het recept ervoor staat. */
  knop: { tekst: string; icoon: string }
  onOpen: () => void
  onKnop: () => void
  onWeg: () => void
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

      <button
        onClick={onWeg}
        aria-label="Uit je week halen"
        style={{
          position: 'absolute', top: 10, right: 10, width: 32, height: 32,
          borderRadius: 'var(--radius-full)', background: 'rgba(20,20,20,0.34)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: 'var(--c-paper)',
        }}
      ><Icon name="x" size={16} /></button>
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
