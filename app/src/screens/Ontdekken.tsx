import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip, Icon } from '../ds'
import { Inhoud, Kop, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useKeukens, useOntdek, useOntdekTelling, type OntdekFilters } from '../lib/queries2'
import { useDezeWeek, useLijstActies, type WeekRecept } from '../lib/queries'
import type { Recept } from '../lib/database.types'
import { isBudget } from '../lib/prijsschatting'

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
 * Alle recepten doorbladeren, foto voorop. Filters op kooktijd, keuken en vegetarisch —
 * precies de dingen waarop je een doordeweekse avond selecteert. Het hartje
 * zet een recept in "Deze week"; daar kies je of het op je lijst gaat.
 */
export function Ontdekken() {
  const navigeer = useNavigate()
  const [zoek, setZoek] = useState('')
  const [maxTijd, setMaxTijd] = useState<number | null>(null)
  const [keuken, setKeuken] = useState<string | null>(null)
  const [alleenVega, setAlleenVega] = useState(false)
  const [alleenBudget, setAlleenBudget] = useState(false)

  const filters: OntdekFilters = useMemo(
    () => ({ zoek, maxTijd, keuken, alleenVega, alleenBudget }),
    [zoek, maxTijd, keuken, alleenVega, alleenBudget],
  )

  const resultaten = useOntdek(filters)
  const telling = useOntdekTelling(filters)
  const keukens = useKeukens()
  const dezeWeek = useDezeWeek()
  const { zetInWeek, haalUitWeek } = useLijstActies()
  // Geen Map als querydata (zie useAhMapping), maar hier is het afgeleid.
  const inWeek = useMemo(
    () => new Map((dezeWeek.data ?? []).map((r) => [r.id, r])),
    [dezeWeek.data],
  )

  const recepten = resultaten.data?.pages.flat() ?? []
  const heeftFilter = Boolean(maxTijd || keuken || alleenVega || alleenBudget)
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
        <Titel grootte={26}>Ontdekken</Titel>
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
              fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-ink)',
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
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <Chip selected={!heeftFilter} onClick={() => { setMaxTijd(null); setKeuken(null); setAlleenVega(false); setAlleenBudget(false) }}>
            Alles
          </Chip>
          <Chip selected={alleenBudget} onClick={() => setAlleenBudget(!alleenBudget)}>Budget</Chip>
          <Chip selected={alleenVega} onClick={() => setAlleenVega(!alleenVega)}>Vegetarisch</Chip>
          {TIJDEN.map((t) => (
            <Chip key={t.waarde} selected={maxTijd === t.waarde} onClick={() => setMaxTijd(maxTijd === t.waarde ? null : t.waarde)}>
              {t.label}
            </Chip>
          ))}
        </div>

        {keukens.data && keukens.data.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {keukens.data.map((k) => (
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
          <Leeg
            icoon="search"
            kop="Niets gevonden"
            tekst={zoek ? `Geen recept voor "${zoek}". Probeer een ingrediënt, bijvoorbeeld aubergine.` : 'Geen recept binnen deze filters.'}
          />
        ) : (
          <Inhoud style={{ gap: 12 }}>
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
                  onOpen={() => navigeer(`/recept/${r.id}`)}
                  onHartje={() => (inWeek.has(r.id) ? haalUitWeek.mutate(r.id) : zetInWeek.mutate(r))}
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

      <OnderBalk />
    </Scherm>
  )
}

/**
 * Een recept als foto met de tekst eronder. Het hartje rechtsboven zet 'm in
 * "Deze week" (of haalt 'm eruit); staat 'ie op je lijst, dan de gele rand.
 */
function FotoKaart({ recept, index, week, onOpen, onHartje }: {
  recept: Recept
  index: number
  week: WeekRecept | undefined
  onOpen: () => void
  onHartje: () => void
}) {
  const vega = recept.tags.includes('vegetarisch')
  const meta = [
    recept.bereidingstijd_minuten ? `${recept.bereidingstijd_minuten} min` : null,
    vega ? 'vegetarisch' : recept.keuken,
  ].filter(Boolean).join(' · ')
  const status = week?.opLijst ? 'Op je lijst' : week ? 'In je week' : null

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

        <button
          onClick={onHartje}
          aria-label={week ? 'Uit deze week halen' : 'In deze week zetten'}
          aria-pressed={Boolean(week)}
          style={{
            position: 'absolute', top: 12, right: 12, width: 38, height: 38,
            borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: week ? 'var(--c-red)' : 'rgba(255,255,255,0.92)',
            color: week ? 'var(--c-cream)' : 'var(--c-red)',
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
