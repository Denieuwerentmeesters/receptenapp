import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip, Icon } from '../ds'
import { Inhoud, Kop, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useFavorietIds, useFavorietToggle, useKeukens, useOntdek, type OntdekFilters } from '../lib/queries2'
import { ReceptRegel } from '../components/ReceptRegel'
import { useDezeWeek } from '../lib/queries'

const TIJDEN = [
  { label: 'Binnen 20 min', waarde: 20 },
  { label: 'Binnen 30 min', waarde: 30 },
  { label: 'Binnen 45 min', waarde: 45 },
]

/**
 * Alle recepten doorbladeren. Filters op kooktijd, keuken en vegetarisch —
 * precies de dingen waarop je een doordeweekse avond selecteert.
 */
export function Ontdekken() {
  const navigeer = useNavigate()
  const [zoek, setZoek] = useState('')
  const [maxTijd, setMaxTijd] = useState<number | null>(null)
  const [keuken, setKeuken] = useState<string | null>(null)
  const [alleenVega, setAlleenVega] = useState(false)

  const filters: OntdekFilters = useMemo(
    () => ({ zoek, maxTijd, keuken, alleenVega }),
    [zoek, maxTijd, keuken, alleenVega],
  )

  const resultaten = useOntdek(filters)
  const keukens = useKeukens()
  const favorieten = useFavorietIds()
  const favToggle = useFavorietToggle()
  const dezeWeek = useDezeWeek()
  const opLijst = useMemo(
    () => new Set((dezeWeek.data ?? []).filter((r) => r.opLijst).map((r) => r.id)),
    [dezeWeek.data],
  )

  const recepten = resultaten.data?.pages.flat() ?? []
  const heeftFilter = Boolean(maxTijd || keuken || alleenVega)

  return (
    <Scherm>
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
          <Chip selected={!heeftFilter} onClick={() => { setMaxTijd(null); setKeuken(null); setAlleenVega(false) }}>
            Alles
          </Chip>
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
          <Inhoud style={{ gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)',
            }}>
              {recepten.length}{resultaten.hasNextPage ? '+' : ''} {recepten.length === 1 ? 'recept' : 'recepten'}
            </span>

            {recepten.map((r, i) => (
              // Zelfde gele rand als in "Deze week": dit staat al op je lijst.
              <div key={r.id} style={{
                borderRadius: 'calc(var(--radius-md) + 3px)', padding: 3,
                background: opLijst.has(r.id) ? 'var(--c-yellow)' : 'transparent',
              }}>
                <ReceptRegel
                  recept={r}
                  index={i}
                  favoriet={Boolean(favorieten.data?.[r.id])}
                  actie={opLijst.has(r.id) ? 'op je lijst' : undefined}
                  actieKleur="var(--c-red)"
                  onOpen={() => navigeer(`/recept/${r.id}`)}
                  onFavoriet={() => favToggle.mutate({ receptId: r.id, favoriet: !favorieten.data?.[r.id] })}
                />
              </div>
            ))}

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
