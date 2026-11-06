import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip, Icon } from '../ds'
import { Inhoud, Kop, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useKeukens, useOntdek, useOntdekTelling, type OntdekFilters } from '../lib/queries2'
import { useFases, type FaseRecept } from '../lib/fases'
import { useHartje } from '../components/Hartje'
import type { Recept } from '../lib/database.types'
import { useReceptPrijs, useReceptPrijzen } from '../lib/receptprijs'
import { BUDGET_MANDJE_PP } from '../lib/budget'
import { schaalIngredienten } from '../lib/schaal'
import { standaardPersonen } from '../lib/menu'
import { euro } from '../lib/besparing'
import { tokoIngredienten } from '../lib/toko'
import { TokoLabel } from '../components/TokoLabel'
import { BonusLabel } from '../components/Bonus'
import { receptBonusProducten, useBonus } from '../lib/bonus'
import { ALLERGENEN_OP_VOORKOMEN, opsomming, useAllergieen, vastVoorJou } from '../lib/allergenen'
import { Dialoog } from '../components/Dialoog'
import {
  cijferTekst, gemiddeldeOpKaart, isFavorietCijfer, useBeoordelingen, type LaatsteBeoordeling,
} from '../lib/beoordeling'
import { useVoorkeuren } from '../lib/queries'
import { DIETEN, dieetLabels, wisselDieet, type Dieet } from '../lib/dieet'
import { t } from '../lib/taal'

const GEEN: string[] = []

const TIJDEN = [
  { waarde: 20 },
  { waarde: 30 },
  { waarde: 45 },
]

/**
 * Crème, zoals de rest van de app; de roze onderkant van de kaarten springt eruit.
 */
const ACHTERGROND = 'var(--c-cream)'

/** Zonder foto toch een vlak: de roodtinten wisselen af, het merkritme. */
const VLAKKEN = ['var(--c-red)', 'var(--c-red-bright)']

/**
 * Wat je in Ontdekken aan het doen was: filters en hoe ver je gescrold had.
 * Open je een recept en ga je terug, dan sta je weer op dezelfde plek — niet
 * bovenaan met alle filters uit. Bewust in het geheugen van de app en niet in
 * de URL: na een herstart mag je gewoon bovenaan beginnen. De opgehaalde
 * pagina's zelf bewaart React Query al.
 */
const onthouden = {
  zoek: '',
  maxTijd: null as number | null,
  keukens: [] as string[],
  dieet: [] as Dieet[],
  alleenBudget: false,
  sorteer: null as 'prijs' | null,
  hoogCijfer: false,
  // Het allergiefilter begint met je allergieën uit Instellingen (null = nog
  // niet aangeraakt). Wat je hier aan- of uitvinkt geldt tot een herstart:
  // vaak heeft maar één iemand in het gezin een allergie, of eet er iemand mee
  // die iets niet mag — maar het moet niet ongemerkt blijven hangen.
  zonder: null as string[] | null,
  // Alleen je eigen recepten (toegevoegd, geïmporteerd, samengesteld).
  mijn: false,
  scrollTop: 0,
}

/** De keuzes achter de knop Toevoegen; de route staat in de URL van /toevoegen. */
const TOEVOEGEN = [
  { label: 'Plak een link', naar: '/toevoegen?route=link' },
  { label: 'Kies screenshots', naar: '/toevoegen?route=screenshots' },
  { label: 'Foto van een kookboek', naar: '/toevoegen?route=kookboek' },
  { label: 'Typ zelf', naar: '/toevoegen?route=eigen' },
  { label: 'Laat Kookmaatje een menu samenstellen', naar: '/samenstellen' },
]

/** Sleutel in localStorage: de uitleg bij Mijn recepten laten we één keer zien. */
const UITLEG_SLEUTEL = 'pinch-mijn-recepten-uitleg'

function uitlegGezien(): boolean {
  try { return localStorage.getItem(UITLEG_SLEUTEL) !== null } catch { return true }
}

function onthoudUitleg() {
  try { localStorage.setItem(UITLEG_SLEUTEL, new Date().toISOString()) } catch { /* zonder opslag zie je 'm weer */ }
}

/**
 * Alle recepten doorbladeren, foto voorop. Filters op kooktijd, keuken en dieet —
 * precies de dingen waarop je een doordeweekse avond selecteert. Het hartje
 * zet een recept bij Nog bestellen (components/Hartje.tsx); op je lijst zetten
 * doe je daar, niet hier.
 */
export function Ontdekken() {
  const navigeer = useNavigate()
  const [zoek, setZoek] = useState(onthouden.zoek)
  const [maxTijd, setMaxTijd] = useState<number | null>(onthouden.maxTijd)
  const [keukens, setKeukens] = useState(onthouden.keukens)
  const [dieet, setDieet] = useState(onthouden.dieet)
  const [alleenBudget, setAlleenBudget] = useState(onthouden.alleenBudget)
  const [sorteer, setSorteer] = useState(onthouden.sorteer)
  const [hoogCijfer, setHoogCijfer] = useState(onthouden.hoogCijfer)
  const [zonder, setZonder] = useState(onthouden.zonder)
  const [mijn, setMijn] = useState(onthouden.mijn)
  const [toevoegenOpen, setToevoegenOpen] = useState(false)
  const [uitlegOpen, setUitlegOpen] = useState(false)
  // Welke keuzelijst onderin openstaat: kooktijd, dieet of allergieën.
  const [open, setOpen] = useState<'tijd' | 'keuken' | 'dieet' | 'allergie' | 'sorteer' | null>(null)
  const allergieen = useAllergieen()
  const zonderAllergenen = zonder ?? allergieen
  const voorkeurKeukens = useVoorkeuren().data?.favoriete_keukens ?? GEEN

  const beoordelingen = useBeoordelingen()
  // Een eigen sleutel per inhoud: anders is dit elke render een nieuw filter.
  const hoogCijferIds = useMemo(
    () => (hoogCijfer
      ? [...beoordelingen.perRecept].filter(([, b]) => isFavorietCijfer(b.cijfer)).map(([id]) => id).sort()
      : null),
    [hoogCijfer, beoordelingen.perRecept],
  )

  const filters: OntdekFilters = useMemo(
    () => ({ zoek, maxTijd, keukens, dieet, alleenBudget, sorteer, zonderAllergenen, mijn, hoogCijferIds }),
    [zoek, maxTijd, keukens, dieet, alleenBudget, sorteer, zonderAllergenen, mijn, hoogCijferIds],
  )

  // Ander filter = andere lijst: dan hoort de oude scrollpositie er niet meer bij.
  const vorigeFilters = useRef(filters)
  useEffect(() => {
    if (vorigeFilters.current === filters) return
    vorigeFilters.current = filters
    Object.assign(onthouden, { zoek, maxTijd, keukens, dieet, alleenBudget, sorteer, hoogCijfer, zonder, mijn, scrollTop: 0 })
    scroller.current?.scrollTo({ top: 0 })
  }, [filters, zoek, maxTijd, keukens, dieet, alleenBudget, sorteer, hoogCijfer, zonder, mijn])

  // Budget en sorteren rekenen op de mandjeprijs van alle recepten; die laden we alleen als je ze nodig hebt.
  const prijzen = useReceptPrijzen(alleenBudget || sorteer === 'prijs')
  const resultaten = useOntdek(filters, mijn ? GEEN : voorkeurKeukens, prijzen)
  const telling = useOntdekTelling(filters, prijzen)
  const keukenPool = useKeukens()
  // Je voorkeurskeukens vooraan in de rij; daarbinnen blijft de volgorde op aantal.
  const keukenChips = useMemo(() => {
    const alle = keukenPool.data ?? []
    return [
      ...alle.filter((k) => voorkeurKeukens.includes(k.keuken)),
      ...alle.filter((k) => !voorkeurKeukens.includes(k.keuken)),
    ]
  }, [keukenPool.data, voorkeurKeukens])
  const hartje = useHartje()
  // Voor de gele rand en de regel onder een kaart.
  const fases = useFases()
  // Geen Map als querydata (zie useAhMapping), maar hier is het afgeleid.
  const inFase = useMemo(
    () => new Map([...fases.teKoken, ...fases.nogBestellen].map((r) => [r.id, r])),
    [fases.teKoken, fases.nogBestellen],
  )

  const recepten = resultaten.data?.pages.flatMap((p) => p.recepten) ?? []

  // Terug van een recept: zodra de lijst er (uit de cache) weer staat, springen
  // we naar waar je was. Eén keer; daarna scroll je zelf.
  const scroller = useRef<HTMLDivElement>(null)
  const nogHerstellen = useRef(onthouden.scrollTop > 0)
  useLayoutEffect(() => {
    if (!nogHerstellen.current || !scroller.current || recepten.length === 0) return
    scroller.current.scrollTop = onthouden.scrollTop
    nogHerstellen.current = false
  }, [recepten.length])
  const heeftFilter = Boolean(maxTijd || keukens.length > 0 || dieet.length > 0 || alleenBudget || hoogCijfer)
  const totaal = telling.data ?? recepten.length

  // Vanzelf verder laden zodra je bij de onderkant komt; de knop blijft als
  // terugval voor als de observer niet afgaat.
  const onderkant = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = resultaten
  useEffect(() => {
    const el = onderkant.current
    if (!el || !hasNextPage) return
    const kijker = new IntersectionObserver((regels) => {
      if (regels.some((r) => r.isIntersecting) && !isFetchingNextPage) void fetchNextPage()
    }, { rootMargin: '400px' })
    kijker.observe(el)
    return () => kijker.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <Scherm achtergrond={ACHTERGROND}>
      <Kop kleur="var(--c-orange)" tekstKleur="var(--c-paper)" style={{ paddingBottom: 22 }}>
        {/* Op 26 past de titel niet naast de knop: die viel rechts buiten beeld. Op een heel smal scherm zakt de knop een regel. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px 12px' }}>
          <Titel grootte={20}>Ontdekken</Titel>
          {/* Klein gehouden: de recepten blijven het belangrijkste op dit scherm.
              Eén knop voor alles wat erbij kan: link, screenshots, kookboek, zelf typen, menu. */}
          <button
            onClick={() => setToevoegenOpen(true)}
            style={{
              flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
              borderRadius: 'var(--radius-full)', padding: '7px 12px 7px 9px', cursor: 'pointer',
              background: 'var(--c-paper)', color: 'var(--c-ink)',
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 800,
            }}
          ><Icon name="plus" size={16} />{t('Toevoegen')}</button>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
          background: 'var(--c-paper)', borderRadius: 14, padding: '13px 16px',
        }}>
          <Icon name="search" size={18} style={{ color: 'var(--c-ink-300)', flexShrink: 0 }} />
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t('Zoek op gerecht of ingrediënt')}
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--color-ink)',
            }}
          />
          {zoek && (
            <button
              onClick={() => setZoek('')}
              aria-label={t('Zoekterm wissen')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(43,20,32,0.45)', display: 'flex' }}
            ><Icon name="x" size={16} /></button>
          )}
        </div>
      </Kop>

      <div style={{ flex: 'none', padding: '14px 22px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Alle recepten of alleen die van jou: wat je toevoegde, importeerde of liet samenstellen. */}
        <div role="tablist" aria-label={t('Welke recepten')} style={{
          display: 'flex', background: 'rgba(43,20,32,0.08)', borderRadius: 'var(--radius-full)', padding: 3,
        }}>
          {([false, true] as const).map((waarde) => (
            <button
              key={String(waarde)}
              role="tab"
              aria-selected={mijn === waarde}
              onClick={() => {
                setMijn(waarde)
                // De eerste keer Mijn recepten: laten zien hoe je er een toevoegt.
                if (waarde && !uitlegGezien()) { onthoudUitleg(); setUitlegOpen(true) }
              }}
              style={{
                flex: 1, border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-full)', padding: '9px 12px',
                background: mijn === waarde ? 'var(--c-paper)' : 'transparent',
                color: 'var(--c-ink)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 800,
                boxShadow: mijn === waarde ? '0 1px 4px rgba(43,20,32,0.12)' : 'none',
              }}
            >{waarde ? t('Mijn recepten') : t('Alle recepten')}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {/* Geen chip "Alles": niets aangevinkt ís alles. Volgorde: wat je het vaakst kiest vooraan. */}
          <Chip selected={keukens.length > 0} onClick={() => setOpen('keuken')}>
            {keukens.length > 0 ? keukens.join(' · ') : t('Keuken')} ▾
          </Chip>
          <Chip selected={dieet.length > 0} onClick={() => setOpen('dieet')}>
            {dieet.length > 0 ? DIETEN.filter((d) => dieet.includes(d.id)).map((d) => d.label).join(' · ') : t('Dieet')} ▾
          </Chip>
          <Chip selected={maxTijd !== null} onClick={() => setOpen('tijd')}>
            {maxTijd ? t('Binnen {n} min', { n: maxTijd }) : t('Kooktijd')} ▾
          </Chip>
          <Chip selected={sorteer !== null} onClick={() => setOpen('sorteer')}>
            {sorteer === 'prijs' ? t('Goedkoopste eerst') : t('Sorteren')} ▾
          </Chip>
          <Chip selected={alleenBudget} onClick={() => setAlleenBudget(!alleenBudget)}>{t('Budget')}</Chip>
          <Chip selected={hoogCijfer} onClick={() => setHoogCijfer(!hoogCijfer)}>{t('Hoog cijfer')}</Chip>
          <Chip selected={zonderAllergenen.length > 0} onClick={() => setOpen('allergie')}>
            {zonderAllergenen.length > 0 ? t('Zonder {lijst}', { lijst: opsomming(zonderAllergenen) }) : t('Allergieën')} ▾
          </Chip>
        </div>

      </div>

      <Grens query={resultaten} ladenTekst={t('Recepten ophalen')}>
        {/* Pas "niets gevonden" tonen als er ook echt niets meer onderweg is —
            anders zie je 'm even bij elke filterwissel, en na een herstart uit
            de cache zelfs terwijl de goede uitslag nog binnenkomt. */}
        {recepten.length === 0 && !resultaten.isFetching ? (
          mijn && !zoek && !heeftFilter && zonderAllergenen.length === 0 ? (
            <Leeg
              icoon="plus"
              kop={t('Nog geen eigen recepten')}
              tekst={t('Zet je eerste recept erbij. Plak een link van Instagram of een website, of kies screenshots.')}
              knop={t('Plak een link')}
              onKnop={() => navigeer('/toevoegen?route=link')}
              onIcoon={() => setToevoegenOpen(true)}
              icoonLabel={t('Toevoegen')}
            />
          ) : (
            <Leeg
              icoon="search"
              kop={t('Niets gevonden')}
              tekst={zoek ? t('Geen recept voor "{zoek}". Probeer een ingrediënt, bijvoorbeeld aubergine.', { zoek }) : t('Geen recept binnen deze filters.')}
              knop={zoek ? t('Plak de link van je eigen recept') : undefined}
              onKnop={() => navigeer('/toevoegen?route=link')}
            />
          )
        ) : (
          <Inhoud
            style={{ gap: 12 }}
            scrollRef={scroller}
            onScroll={(e) => { if (!nogHerstellen.current) onthouden.scrollTop = e.currentTarget.scrollTop }}
          >
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'rgba(43,20,32,0.6)',
            }}>
              {totaal} {totaal === 1 ? t('recept') : t('recepten')}
            </span>

            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '18px 12px',
            }}>
              {recepten.map((r, i) => (
                <FotoKaart
                  key={r.id}
                  recept={r}
                  index={i}
                  fase={inFase.get(r.id)}
                  mijn={beoordelingen.perRecept.get(r.id)}
                  bevat={vastVoorJou(r, allergieen)}
                  onOpen={() => navigeer(`/recept/${r.id}`)}
                  bewaard={hartje.bewaard.has(r.id)}
                  onHartje={() => hartje.tik(r)}
                />
              ))}
            </div>

            {/* Onder je laatste recept: een grote plus, naast de knop rechtsboven. */}
            {mijn && !resultaten.hasNextPage && (
              <button
                onClick={() => setToevoegenOpen(true)}
                aria-label={t('Recept toevoegen')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '28px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: '2px dashed rgba(20,20,20,0.3)', background: 'transparent', color: 'var(--c-ink)',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 800,
                }}
              >
                <Icon name="plus" size={44} />
                {t('Recept toevoegen')}
              </button>
            )}

            <div ref={onderkant} />
            {resultaten.hasNextPage && (
              <button
                onClick={() => void resultaten.fetchNextPage()}
                disabled={resultaten.isFetchingNextPage}
                style={{
                  margin: '8px 0 4px', padding: '14px', borderRadius: 'var(--radius-full)',
                  border: '1.5px solid rgba(43,20,32,0.14)', background: 'transparent',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {resultaten.isFetchingNextPage ? t('Even geduld') : t('Meer recepten')}
              </button>
            )}
          </Inhoud>
        )}
      </Grens>

      <Dialoog
        open={uitlegOpen}
        kop={t('Zo zet je een recept erbij')}
        tekst={t('Recepten van Instagram, TikTok of een website bewaar je in een paar tikken. Kookmaatje leest ze uit en zet ze in het Nederlands, metrisch en met een boodschappenlijst.')}
        acties={[
          { label: t('Plak een link'), hoofd: true, onClick: () => { setUitlegOpen(false); navigeer('/toevoegen?route=link') } },
          { label: t('Begrepen'), onClick: () => setUitlegOpen(false) },
        ]}
        onSluit={() => setUitlegOpen(false)}
      >
        <ol style={{
          margin: '0 0 6px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10,
          fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.45, color: 'var(--color-ink)',
        }}>
          <li><b>{t('Via Delen:')}</b> {t('tik in Instagram of Safari op Delen en kies Kookmaatje. Het recept staat meteen klaar om te controleren.')}</li>
          <li><b>{t('Link plakken:')}</b> {t('kopieer de link van de post of website, kom hier terug en tik op Toevoegen → Plak een link.')}</li>
          <li><b>{t('Of een screenshot')}</b> {t('van een recept, of een foto uit je kookboek.')}</li>
        </ol>
      </Dialoog>

      <Dialoog
        open={toevoegenOpen}
        kop={t('Recept toevoegen')}
        tekst={t('Waar komt het vandaan?')}
        acties={TOEVOEGEN.map((k, i) => ({ label: t(k.label), hoofd: i === 0, onClick: () => { setToevoegenOpen(false); navigeer(k.naar) } }))}
        onSluit={() => setToevoegenOpen(false)}
      />

      <Dialoog
        open={open === 'sorteer'}
        kop={t('Sorteren')}
        tekst={t('De prijs is wat je mandje voor dit recept kost per persoon, zonder wat je al in huis hebt.')}
        acties={[{ label: t('Klaar'), hoofd: true, onClick: () => setOpen(null) }]}
        onSluit={() => setOpen(null)}
      >
        <Keuzelijst
          keuzes={[{ id: 'prijs', label: t('Goedkoopste eerst') }]}
          gekozen={sorteer ? [sorteer] : []}
          onWissel={() => setSorteer(sorteer === 'prijs' ? null : 'prijs')}
        />
      </Dialoog>

      <Dialoog
        open={open === 'tijd'}
        kop={t('Kooktijd')}
        acties={[{ label: t('Klaar'), hoofd: true, onClick: () => setOpen(null) }]}
        onSluit={() => setOpen(null)}
      >
        <Keuzelijst
          keuzes={TIJDEN.map((x) => ({ id: String(x.waarde), label: t('Binnen {n} min', { n: x.waarde }) }))}
          gekozen={maxTijd ? [String(maxTijd)] : []}
          onWissel={(id) => setMaxTijd(maxTijd === Number(id) ? null : Number(id))}
        />
      </Dialoog>

      <Dialoog
        open={open === 'keuken'}
        kop={t('Keuken')}
        tekst={t('Vink aan wat je wilt zien; je voorkeurskeukens staan bovenaan.')}
        acties={[{ label: t('Klaar'), hoofd: true, onClick: () => setOpen(null) }]}
        onSluit={() => setOpen(null)}
      >
        <Keuzelijst
          keuzes={keukenChips.map((k) => ({ id: k.keuken, label: `${k.keuken} · ${k.aantal}` }))}
          gekozen={keukens}
          onWissel={(id) => setKeukens(keukens.includes(id) ? keukens.filter((k) => k !== id) : [...keukens, id])}
        />
      </Dialoog>

      <Dialoog
        open={open === 'dieet'}
        kop={t('Dieet')}
        tekst={t('Koolhydraatarm en keto zijn een schatting op basis van de ingrediënten.')}
        acties={[{ label: t('Klaar'), hoofd: true, onClick: () => setOpen(null) }]}
        onSluit={() => setOpen(null)}
      >
        <Keuzelijst
          keuzes={DIETEN}
          gekozen={dieet}
          onWissel={(id) => setDieet(wisselDieet(dieet, id as Dieet))}
        />
      </Dialoog>

      <Dialoog
        open={open === 'allergie'}
        kop={t('Zonder allergenen')}
        tekst={t('Recepten waar het in zit laten we weg. Geldt tot je de app opnieuw opent; je vaste allergieën stel je in bij Instellingen.')}
        acties={[{ label: t('Klaar'), hoofd: true, onClick: () => setOpen(null) }]}
        onSluit={() => setOpen(null)}
      >
        <Keuzelijst
          keuzes={ALLERGENEN_OP_VOORKOMEN}
          gekozen={zonderAllergenen}
          onWissel={(id) => setZonder(zonderAllergenen.includes(id)
            ? zonderAllergenen.filter((x) => x !== id)
            : [...zonderAllergenen, id])}
        />
      </Dialoog>

      <OnderBalk />
    </Scherm>
  )
}

/** De vinkjeslijst in een keuzedialoog: kooktijd, dieet en allergieën. */
function Keuzelijst({ keuzes, gekozen, onWissel }: {
  keuzes: readonly { id: string; label: string }[]
  gekozen: readonly string[]
  onWissel: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '45dvh', overflowY: 'auto' }}>
      {keuzes.map((k) => (
        <label key={k.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 2px', cursor: 'pointer',
          borderBottom: '1.5px solid rgba(43,20,32,0.12)',
          fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
        }}>
          <input
            type="checkbox"
            checked={gekozen.includes(k.id)}
            onChange={() => onWissel(k.id)}
            style={{ width: 22, height: 22, accentColor: 'var(--c-red)', flex: 'none' }}
          />
          {k.label}
        </label>
      ))}
    </div>
  )
}

/**
 * Een recept als foto met de tekst eronder. Rechtsboven het hartje (naar Nog
 * bestellen); staat 'ie op je lijst, dan de gele rand.
 */
function FotoKaart({ recept, index, fase, mijn, bewaard, bevat, onOpen, onHartje }: {
  recept: Recept
  index: number
  /** Staat het bij Te koken of Nog bestellen: voor de gele rand en de regel eronder. */
  fase: FaseRecept | undefined
  /** Jouw laatste cijfer en notitie, als je dit recept beoordeeld hebt. */
  mijn: LaatsteBeoordeling | undefined
  /** Staat bij Te koken of Nog bestellen: het hartje is gevuld. */
  bewaard: boolean
  /** Jouw allergenen die erin zitten, zonder vervanger. Alleen als het filter uit staat. */
  bevat: string[]
  onOpen: () => void
  onHartje: () => void
}) {
  // Eén label houdt de regel kort: vegan of vegetarisch gaat voor de keuken.
  const [label] = dieetLabels(recept)
  const meta = [
    recept.bereidingstijd_minuten ? t('{n} min', { n: recept.bereidingstijd_minuten }) : null,
    label === 'vegan' || label === 'vegetarisch' ? t(label) : recept.keuken,
  ].filter(Boolean).join(' · ')
  // Wat het mandje voor dit recept kost per persoon (jouw winkel, jouw voorraadkast), zodat je het label Budget kunt beoordelen.
  const voorkeuren = useVoorkeuren()
  const personen = standaardPersonen(recept, voorkeuren.data?.aantal_personen ?? 4)
  const prijsRegels = useMemo(
    () => schaalIngredienten(recept.ingredienten, recept.personen, personen)
      .map((i) => ({ naam: i.naam, eenheid: i.eenheid, geschaald: i.geschaald })),
    [recept.ingredienten, recept.personen, personen],
  )
  const prijs = useReceptPrijs(prijsRegels, personen)
  const prijsTekst = prijs && prijs.perPersoon > 0 ? t('± {prijs} p.p.', { prijs: euro(prijs.perPersoon, true) }) : null
  const status = fase?.besteldOp ? t('Te koken') : fase?.opLijst ? t('Op je lijst') : fase ? t('Nog bestellen') : null
  // Jouw cijfer gaat voor; heb je het niet gekookt, dan het gemiddelde van alle koks (vanaf genoeg cijfers).
  const gemiddeld = mijn?.cijfer == null ? gemiddeldeOpKaart(recept) : null
  const favoriet = isFavorietCijfer(mijn?.cijfer)
  const toko = useMemo(() => tokoIngredienten(recept.ingredienten).length > 0, [recept.ingredienten])
  const bonusData = useBonus().data
  const bonus = useMemo(() => receptBonusProducten(recept.ingredienten, bonusData), [recept.ingredienten, bonusData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{
        position: 'relative', borderRadius: 'calc(var(--radius-md) + 4px)', padding: 4,
        margin: -4, background: fase?.opLijst ? 'var(--c-yellow)' : 'transparent',
        transition: 'background var(--motion-base) var(--ease)',
      }}>
        <button
          onClick={onOpen}
          aria-label={recept.titel_nl ?? recept.titel}
          style={{
            display: 'block', width: '100%', aspectRatio: '1 / 1', border: 'none', padding: 0,
            borderRadius: 'var(--radius-md)', cursor: 'pointer', overflow: 'hidden',
            background: recept.afbeelding_url
              ? `url(${recept.afbeelding_url}) center/cover`
              : VLAKKEN[index % VLAKKEN.length],
            color: 'var(--c-cream)', fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '.08em', textTransform: 'uppercase',
          }}
        >{recept.afbeelding_url ? '' : t('foto')}</button>
        {toko && <TokoLabel />}
        <BonusLabel producten={bonus} />
        {(mijn?.cijfer != null || gemiddeld) && (
          <span
            aria-label={mijn?.cijfer != null ? t('Jouw cijfer: {cijfer}', { cijfer: mijn.cijfer }) : t('Gemiddeld {cijfer}', { cijfer: cijferTekst(gemiddeld!.gemiddeld) })}
            style={{
              position: 'absolute', right: 12, bottom: 12, minWidth: 30, height: 30, boxSizing: 'border-box', padding: '0 7px',
              borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, pointerEvents: 'none',
              background: favoriet ? 'var(--c-yellow)' : 'var(--c-paper)', color: 'var(--c-ink)',
              boxShadow: '0 2px 8px rgba(43,20,32,0.18)',
            }}
          >{mijn?.cijfer ?? cijferTekst(gemiddeld!.gemiddeld)}</span>
        )}

        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onHartje}
            aria-label={bewaard ? t('Haal uit Nog bestellen') : t('Zet bij Nog bestellen')}
            aria-pressed={bewaard}
            style={{ ...rondje, ...(bewaard ? aan : {}) }}
          ><Icon name="heart" size={18} /></button>
        </div>
      </div>

      <button
        onClick={onOpen}
        style={{
          display: 'flex', flexDirection: 'column', gap: 3, background: 'none', border: 'none',
          padding: '0 2px', textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, lineHeight: 1.25,
          color: 'var(--color-ink)', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{recept.titel_nl ?? recept.titel}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(43,20,32,0.6)' }}>
          {meta}
          {prijsTekst && <>{meta ? ' · ' : ''}{prijsTekst}</>}
          {prijs && prijs.perPersoon > 0 && prijs.perPersoon <= BUDGET_MANDJE_PP && <BudgetLabel />}
        </span>
        {bevat.length > 0 && (
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)',
          }}>{t('Bevat {lijst}', { lijst: opsomming(bevat) })}</span>
        )}
        {status && (
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)',
          }}>{status}</span>
        )}
        {favoriet && (
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
            textTransform: 'uppercase', color: 'var(--c-red)',
          }}>{t('Jouw favoriet')}</span>
        )}
        {mijn?.cijfer != null && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(43,20,32,0.6)' }}>
            {t('Jouw cijfer: {cijfer}', { cijfer: mijn.cijfer })}{mijn.notitie ? ` · ${t('notitie: {notitie}', { notitie: mijn.notitie })}` : ''}
          </span>
        )}
        {gemiddeld && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(43,20,32,0.6)' }}>
            {t('{cijfer} gemiddeld · {aantal} koks', { cijfer: cijferTekst(gemiddeld.gemiddeld), aantal: gemiddeld.aantal })}
          </span>
        )}
      </button>
    </div>
  )
}

const rondje: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.92)', color: 'var(--c-red)',
  boxShadow: '0 2px 8px rgba(43,20,32,0.18)',
  transition: 'background var(--motion-fast) var(--ease)',
}
const aan: React.CSSProperties = { background: 'var(--c-red)', color: 'var(--c-cream)' }

/** Klein groen "budget" achter de meta: tot €2,50 per persoon (geschat). */
export function BudgetLabel() {
  return (
    <span style={{ color: 'var(--c-green)', fontWeight: 700 }}> · {t('budget')}</span>
  )
}
