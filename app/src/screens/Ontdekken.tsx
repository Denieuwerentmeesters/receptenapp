import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip, Icon } from '../ds'
import { Inhoud, Kop, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useKeukens, useOntdek, useOntdekTelling, type OntdekFilters } from '../lib/queries2'
import { useDezeWeek, type WeekRecept } from '../lib/queries'
import { useHartje } from '../components/Hartje'
import type { Recept } from '../lib/database.types'
import { isBudget } from '../lib/prijsschatting'
import { tokoIngredienten } from '../lib/toko'
import { TokoLabel } from '../components/TokoLabel'
import { BonusLabel } from '../components/Bonus'
import { receptBonusProducten, useBonus } from '../lib/bonus'
import { ALLERGENEN_OP_VOORKOMEN, opsomming, useAllergieen, vastVoorJou } from '../lib/allergenen'
import { Dialoog } from '../components/Dialoog'
import { useVoorkeuren } from '../lib/queries'
import { DIETEN, dieetLabels, wisselDieet, type Dieet } from '../lib/dieet'

const GEEN: string[] = []

const TIJDEN = [
  { label: 'Binnen 20 min', waarde: 20 },
  { label: 'Binnen 30 min', waarde: 30 },
  { label: 'Binnen 45 min', waarde: 45 },
]

/**
 * Zachte perzik: orange uit de kop, gemengd met cream. Zo voelt Ontdekken
 * anders dan "Deze week", en springen de foto's eruit.
 */
const ACHTERGROND = '#FCD6C3'

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
  keuken: null as string | null,
  dieet: [] as Dieet[],
  alleenBudget: false,
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
  { label: 'Laat Pinch een menu samenstellen', naar: '/samenstellen' },
]

/**
 * Alle recepten doorbladeren, foto voorop. Filters op kooktijd, keuken en dieet —
 * precies de dingen waarop je een doordeweekse avond selecteert. Het hartje
 * bewaart een recept voor "Komende week" (components/Hartje.tsx).
 */
export function Ontdekken() {
  const navigeer = useNavigate()
  const [zoek, setZoek] = useState(onthouden.zoek)
  const [maxTijd, setMaxTijd] = useState<number | null>(onthouden.maxTijd)
  const [keuken, setKeuken] = useState<string | null>(onthouden.keuken)
  const [dieet, setDieet] = useState(onthouden.dieet)
  const [alleenBudget, setAlleenBudget] = useState(onthouden.alleenBudget)
  const [zonder, setZonder] = useState(onthouden.zonder)
  const [mijn, setMijn] = useState(onthouden.mijn)
  const [toevoegenOpen, setToevoegenOpen] = useState(false)
  // Welke keuzelijst onderin openstaat: kooktijd, dieet of allergieën.
  const [open, setOpen] = useState<'tijd' | 'dieet' | 'allergie' | null>(null)
  const allergieen = useAllergieen()
  const zonderAllergenen = zonder ?? allergieen
  const voorkeurKeukens = useVoorkeuren().data?.favoriete_keukens ?? GEEN

  const filters: OntdekFilters = useMemo(
    () => ({ zoek, maxTijd, keuken, dieet, alleenBudget, zonderAllergenen, mijn }),
    [zoek, maxTijd, keuken, dieet, alleenBudget, zonderAllergenen, mijn],
  )

  // Ander filter = andere lijst: dan hoort de oude scrollpositie er niet meer bij.
  const vorigeFilters = useRef(filters)
  useEffect(() => {
    if (vorigeFilters.current === filters) return
    vorigeFilters.current = filters
    Object.assign(onthouden, { zoek, maxTijd, keuken, dieet, alleenBudget, zonder, mijn, scrollTop: 0 })
    scroller.current?.scrollTo({ top: 0 })
  }, [filters, zoek, maxTijd, keuken, dieet, alleenBudget, zonder, mijn])

  const resultaten = useOntdek(filters, mijn ? GEEN : voorkeurKeukens)
  const telling = useOntdekTelling(filters)
  const keukens = useKeukens()
  // Je voorkeurskeukens vooraan in de rij; daarbinnen blijft de volgorde op aantal.
  const keukenChips = useMemo(() => {
    const alle = keukens.data ?? []
    return [
      ...alle.filter((k) => voorkeurKeukens.includes(k.keuken)),
      ...alle.filter((k) => !voorkeurKeukens.includes(k.keuken)),
    ]
  }, [keukens.data, voorkeurKeukens])
  const dezeWeek = useDezeWeek()
  const hartje = useHartje()
  // Geen Map als querydata (zie useAhMapping), maar hier is het afgeleid.
  const inWeek = useMemo(
    () => new Map((dezeWeek.data ?? []).map((r) => [r.id, r])),
    [dezeWeek.data],
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
  const heeftFilter = Boolean(maxTijd || keuken || dieet.length > 0 || alleenBudget)
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
          ><Icon name="plus" size={16} />Toevoegen</button>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
          background: 'var(--c-paper)', borderRadius: 14, padding: '13px 16px',
        }}>
          <Icon name="search" size={18} style={{ color: 'var(--c-ink-300)', flexShrink: 0 }} />
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op gerecht of ingrediënt"
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--color-ink)',
            }}
          />
          {zoek && (
            <button
              onClick={() => setZoek('')}
              aria-label="Zoekterm wissen"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(20,20,20,0.45)', display: 'flex' }}
            ><Icon name="x" size={16} /></button>
          )}
        </div>
      </Kop>

      <div style={{ flex: 'none', padding: '14px 22px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Alle recepten of alleen die van jou: wat je toevoegde, importeerde of liet samenstellen. */}
        <div role="tablist" aria-label="Welke recepten" style={{
          display: 'flex', background: 'rgba(20,20,20,0.08)', borderRadius: 'var(--radius-full)', padding: 3,
        }}>
          {([false, true] as const).map((waarde) => (
            <button
              key={String(waarde)}
              role="tab"
              aria-selected={mijn === waarde}
              onClick={() => setMijn(waarde)}
              style={{
                flex: 1, border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-full)', padding: '9px 12px',
                background: mijn === waarde ? 'var(--c-paper)' : 'transparent',
                color: 'var(--c-ink)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 800,
                boxShadow: mijn === waarde ? '0 1px 4px rgba(20,20,20,0.12)' : 'none',
              }}
            >{waarde ? 'Mijn recepten' : 'Alle recepten'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <Chip selected={!heeftFilter} onClick={() => { setMaxTijd(null); setKeuken(null); setDieet([]); setAlleenBudget(false) }}>
            Alles
          </Chip>
          <Chip selected={alleenBudget} onClick={() => setAlleenBudget(!alleenBudget)}>Budget</Chip>
          <Chip selected={maxTijd !== null} onClick={() => setOpen('tijd')}>
            {maxTijd ? `Binnen ${maxTijd} min` : 'Kooktijd'} ▾
          </Chip>
          <Chip selected={dieet.length > 0} onClick={() => setOpen('dieet')}>
            {dieet.length > 0 ? DIETEN.filter((d) => dieet.includes(d.id)).map((d) => d.label).join(' · ') : 'Dieet'} ▾
          </Chip>
          <Chip selected={zonderAllergenen.length > 0} onClick={() => setOpen('allergie')}>
            {zonderAllergenen.length > 0 ? `Zonder ${opsomming(zonderAllergenen)}` : 'Allergieën'} ▾
          </Chip>
        </div>

        {keukenChips.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {keukenChips.map((k) => (
              <Chip key={k.keuken} selected={keuken === k.keuken} onClick={() => setKeuken(keuken === k.keuken ? null : k.keuken)}>
                {k.keuken}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <Grens query={resultaten} ladenTekst="Recepten ophalen">
        {/* Pas "niets gevonden" tonen als er ook echt niets meer onderweg is —
            anders zie je 'm even bij elke filterwissel, en na een herstart uit
            de cache zelfs terwijl de goede uitslag nog binnenkomt. */}
        {recepten.length === 0 && !resultaten.isFetching ? (
          mijn && !zoek && !heeftFilter && zonderAllergenen.length === 0 ? (
            <Leeg
              icoon="plus"
              kop="Nog geen eigen recepten"
              tekst="Zet je eerste recept erbij. Plak een link van Instagram of een website, of kies screenshots."
              knop="Plak een link"
              onKnop={() => navigeer('/toevoegen?route=link')}
            />
          ) : (
            <Leeg
              icoon="search"
              kop="Niets gevonden"
              tekst={zoek ? `Geen recept voor "${zoek}". Probeer een ingrediënt, bijvoorbeeld aubergine.` : 'Geen recept binnen deze filters.'}
              knop={zoek ? 'Plak de link van je eigen recept' : undefined}
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
              textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)',
            }}>
              {totaal} {totaal === 1 ? 'recept' : 'recepten'}
            </span>

            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '18px 12px',
            }}>
              {recepten.map((r, i) => (
                <FotoKaart
                  key={r.id}
                  recept={r}
                  index={i}
                  week={inWeek.get(r.id)}
                  bevat={vastVoorJou(r, allergieen)}
                  onOpen={() => navigeer(`/recept/${r.id}`)}
                  bewaard={hartje.bewaard.has(r.id)}
                  onHartje={() => hartje.tik(r)}
                />
              ))}
            </div>

            <div ref={onderkant} />
            {resultaten.hasNextPage && (
              <button
                onClick={() => void resultaten.fetchNextPage()}
                disabled={resultaten.isFetchingNextPage}
                style={{
                  margin: '8px 0 4px', padding: '14px', borderRadius: 'var(--radius-full)',
                  border: '1.5px solid rgba(20,20,20,0.14)', background: 'transparent',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {resultaten.isFetchingNextPage ? 'Even geduld' : 'Meer recepten'}
              </button>
            )}
          </Inhoud>
        )}
      </Grens>

      <Dialoog
        open={toevoegenOpen}
        kop="Recept toevoegen"
        tekst="Waar komt het vandaan?"
        acties={TOEVOEGEN.map((k, i) => ({ label: k.label, hoofd: i === 0, onClick: () => { setToevoegenOpen(false); navigeer(k.naar) } }))}
        onSluit={() => setToevoegenOpen(false)}
      />

      <Dialoog
        open={open === 'tijd'}
        kop="Kooktijd"
        acties={[{ label: 'Klaar', hoofd: true, onClick: () => setOpen(null) }]}
        onSluit={() => setOpen(null)}
      >
        <Keuzelijst
          keuzes={TIJDEN.map((t) => ({ id: String(t.waarde), label: t.label }))}
          gekozen={maxTijd ? [String(maxTijd)] : []}
          onWissel={(id) => setMaxTijd(maxTijd === Number(id) ? null : Number(id))}
        />
      </Dialoog>

      <Dialoog
        open={open === 'dieet'}
        kop="Dieet"
        tekst="Koolhydraatarm en keto zijn een schatting op basis van de ingrediënten."
        acties={[{ label: 'Klaar', hoofd: true, onClick: () => setOpen(null) }]}
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
        kop="Zonder allergenen"
        tekst="Recepten waar het in zit laten we weg. Geldt tot je de app opnieuw opent; je vaste allergieën stel je in bij Instellingen."
        acties={[{ label: 'Klaar', hoofd: true, onClick: () => setOpen(null) }]}
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

      {hartje.dialoog}
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
          borderBottom: '1.5px solid rgba(20,20,20,0.12)',
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
 * Een recept als foto met de tekst eronder. Het hartje rechtsboven bewaart 'm
 * voor "Komende week" (of haalt 'm eruit); staat 'ie op je lijst, dan de gele rand.
 */
function FotoKaart({ recept, index, week, bewaard, bevat, onOpen, onHartje }: {
  recept: Recept
  index: number
  /** Hoe het recept in deze week staat: voor de gele rand. */
  week: WeekRecept | undefined
  /** Staat in komende week: het hartje is gevuld. */
  bewaard: boolean
  /** Jouw allergenen die erin zitten, zonder vervanger. Alleen als het filter uit staat. */
  bevat: string[]
  onOpen: () => void
  onHartje: () => void
}) {
  // Eén label houdt de regel kort: vegan of vegetarisch gaat voor de keuken.
  const [label] = dieetLabels(recept)
  const meta = [
    recept.bereidingstijd_minuten ? `${recept.bereidingstijd_minuten} min` : null,
    label === 'vegan' || label === 'vegetarisch' ? label : recept.keuken,
  ].filter(Boolean).join(' · ')
  const status = week?.opLijst ? 'Op je lijst' : bewaard ? "In 'Komende week'" : null
  const toko = useMemo(() => tokoIngredienten(recept.ingredienten).length > 0, [recept.ingredienten])
  const bonusData = useBonus().data
  const bonus = useMemo(() => receptBonusProducten(recept.ingredienten, bonusData), [recept.ingredienten, bonusData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{
        position: 'relative', borderRadius: 'calc(var(--radius-md) + 4px)', padding: 4,
        margin: -4, background: week?.opLijst ? 'var(--c-yellow)' : 'transparent',
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
        >{recept.afbeelding_url ? '' : 'foto'}</button>
        {toko && <TokoLabel />}
        <BonusLabel producten={bonus} />

        <button
          onClick={onHartje}
          aria-label={bewaard ? 'Uit komende week halen' : 'Bewaren voor komende week'}
          aria-pressed={bewaard}
          style={{
            position: 'absolute', top: 12, right: 12, width: 38, height: 38,
            borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: bewaard ? 'var(--c-red)' : 'rgba(255,255,255,0.92)',
            color: bewaard ? 'var(--c-cream)' : 'var(--c-red)',
            boxShadow: '0 2px 8px rgba(20,20,20,0.18)',
            transition: 'background var(--motion-fast) var(--ease)',
          }}
        ><Icon name="heart" size={18} /></button>
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
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(20,20,20,0.6)' }}>
          {meta}
          {isBudget(recept) && <BudgetLabel />}
        </span>
        {bevat.length > 0 && (
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)',
          }}>Bevat {opsomming(bevat)}</span>
        )}
        {status && (
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)',
          }}>{status}</span>
        )}
      </button>
    </div>
  )
}

/** Klein groen "budget" achter de meta: tot €2,50 per persoon (geschat). */
export function BudgetLabel() {
  return (
    <span style={{ color: 'var(--c-green)', fontWeight: 700 }}> · budget</span>
  )
}
