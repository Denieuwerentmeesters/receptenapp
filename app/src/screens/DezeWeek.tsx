import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Chip, Icon } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel, Voet } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useOpLijst } from '../components/OpLijst'
import { useDezeWeek, useVoorkeuren, type WeekRecept } from '../lib/queries'
import { useFavorietIds, useFavorietToggle } from '../lib/queries2'
import { weekLabel, weekStart } from '../lib/week'

type Filter = 'alles' | 'lijst' | 'vega' | 'snel'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alles', label: 'Alles' },
  { id: 'lijst', label: 'Op mijn lijst' },
  { id: 'vega', label: 'Vegetarisch' },
  { id: 'snel', label: 'Binnen 30 min' },
]

/** De kaarten wisselen af tussen de twee roodtinten — het merkritme uit de designs. */
const VLAKKEN = ['var(--c-red)', 'var(--c-red-bright)']

function isVega(recept: WeekRecept) {
  return recept.tags.includes('vegetarisch')
}

/**
 * Het startscherm: je week. De tien suggesties van de generator, plus wat je
 * zelf via Ontdekken of Favorieten toevoegde. Wat op je boodschappenlijst
 * staat krijgt een gele rand; na de boodschappen verdwijnt die, maar het
 * recept blijft staan — hiervandaan kook je.
 */
export function DezeWeek() {
  const week = weekStart()
  const navigeer = useNavigate()
  const [filter, setFilter] = useState<Filter>('alles')

  const dezeWeek = useDezeWeek(week)
  const voorkeuren = useVoorkeuren()
  const { voegToe, dialoog } = useOpLijst(week)
  const favorieten = useFavorietIds()
  const favToggle = useFavorietToggle()

  const recepten = useMemo(() => dezeWeek.data ?? [], [dezeWeek.data])
  const zichtbaar = recepten.filter((r) =>
    filter === 'alles' ? true
      : filter === 'lijst' ? r.opLijst
      : filter === 'vega' ? isVega(r)
      : (r.bereidingstijd_minuten ?? 999) <= 30)

  const opLijst = recepten.filter((r) => r.opLijst).length
  const vegaAantal = recepten.filter(isVega).length
  const personen = voorkeuren.data?.aantal_personen ?? 4

  return (
    <Scherm>
      <Grens query={dezeWeek} ladenTekst="Je week ophalen">
        <Kop>
          <Label>Week van {weekLabel(week)}</Label>
        </Kop>

        <Kop kleur="var(--c-red-bright)" style={{ padding: '20px 22px 22px' }}>
          <Titel>Wat eet jij<br />deze week?</Titel>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '12px 0 0' }}>
            {recepten.length} recepten · {vegaAantal} vegetarisch · voor {personen} {personen === 1 ? 'persoon' : 'personen'}
          </p>
        </Kop>

        <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '16px 22px 6px', overflowX: 'auto' }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {recepten.length === 0 ? (
          <Leeg
            icoon="utensils"
            kop="Nog geen weekmenu"
            tekst="Zodra je voorkeuren staan zetten we elke week 10 recepten klaar."
            knop="Voorkeuren instellen"
            onKnop={() => navigeer('/instellingen')}
          />
        ) : (
          <Inhoud style={{ padding: '10px 22px 16px', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 10 }}>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)',
              }}>
                {filter === 'alles' ? `Alle ${recepten.length} recepten` : `${zichtbaar.length} in dit filter`}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)' }}>
                {opLijst} op je lijst
              </span>
            </div>

            {zichtbaar.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <Icon name="utensils" size={28} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, margin: '10px 0 4px' }}>
                  Niets binnen dit filter
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(20,20,20,0.6)', margin: 0 }}>
                  Zet het filter op Alles om alles te zien.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                gridAutoRows: '1fr', gap: 12,
              }}>
                {zichtbaar.map((recept, i) => (
                  <ReceptKaart
                    key={recept.id}
                    recept={recept}
                    vlak={VLAKKEN[i % VLAKKEN.length]}
                    personen={personen}
                    favoriet={Boolean(favorieten.data?.[recept.id])}
                    onOpen={() => navigeer(`/recept/${recept.id}`)}
                    onLijst={() => voegToe({ ...recept, titel: recept.titel_nl ?? recept.titel })}
                    onFavoriet={() => favToggle.mutate({
                      receptId: recept.id,
                      favoriet: !favorieten.data?.[recept.id],
                    })}
                  />
                ))}
              </div>
            )}
          </Inhoud>
        )}

        <Voet>
          <Button
            disabled={opLijst === 0}
            onClick={() => navigeer('/boodschappen')}
            style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
          >
            {opLijst === 0 ? 'Kies eerst een recept' : `Naar boodschappenlijst (${opLijst})`}
          </Button>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, margin: '8px 0 0',
            textAlign: 'center', color: 'rgba(20,20,20,0.6)',
          }}>
            {opLijst === 0
              ? 'Tik op de recepten die je deze week wil koken.'
              : 'Dubbele ingrediënten voegen we samen.'}
          </p>
        </Voet>
      </Grens>

      {dialoog}
      <OnderBalk />
    </Scherm>
  )
}

/** Tekst op de knop onder een kaart: wat er met dit recept aan de hand is. */
function knopTekst(recept: WeekRecept): string {
  if (recept.opLijst) return recept.aantal > 1 ? `Op je lijst · ${recept.aantal}x` : 'Op je lijst'
  if (recept.gekooktOp) return 'Gekookt'
  // Van de lijst af: boodschappen gedaan, doorgestuurd of gewist.
  if (recept.gekozen) return 'In je week'
  return 'Op de lijst'
}

function ReceptKaart({ recept, vlak, personen, favoriet, onOpen, onLijst, onFavoriet }: {
  recept: WeekRecept
  vlak: string
  personen: number
  favoriet: boolean
  onOpen: () => void
  onLijst: () => void
  onFavoriet: () => void
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 20, padding: 4,
      // Een gele ring betekent: staat op je boodschappenlijst.
      background: recept.opLijst ? 'var(--c-yellow)' : 'transparent',
      transition: 'background var(--motion-base) var(--ease)',
    }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
      <button
        onClick={onOpen}
        style={{
          flex: 1, background: vlak, borderRadius: 'var(--radius-md)', border: 'none',
          overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--c-paper)',
        }}
      >
        <div style={{
          height: 110,
          background: recept.afbeelding_url ? `url(${recept.afbeelding_url}) center/cover` : 'rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-body)', fontSize: 12, opacity: recept.afbeelding_url ? 1 : 0.5,
        }}>
          {recept.afbeelding_url ? '' : 'foto'}
        </div>
        <div style={{ padding: 'var(--space-4)' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, lineHeight: 0.9,
            margin: 0, textTransform: 'uppercase',
          }}>{recept.titel_nl ?? recept.titel}</h3>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, opacity: 0.85 }}>
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
        onClick={onFavoriet}
        aria-label={favoriet ? 'Uit favorieten' : 'Bewaren als favoriet'}
        style={{
          position: 'absolute', top: 10, right: 10, width: 32, height: 32,
          borderRadius: 'var(--radius-full)', background: 'rgba(20,20,20,0.28)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: favoriet ? 'var(--c-yellow)' : 'var(--c-paper)',
        }}
      ><Icon name="heart" size={16} /></button>
      </div>

      <button
        onClick={onLijst}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38,
          margin: '0 4px 4px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, background: 'var(--c-paper)',
          border: `1.5px solid ${recept.opLijst ? 'var(--c-red)' : 'rgba(20,20,20,0.14)'}`,
          color: recept.opLijst ? 'var(--c-red)' : recept.gekozen ? 'rgba(20,20,20,0.55)' : 'var(--c-ink)',
        }}
      >
        <Icon name={recept.gekozen ? 'check' : 'plus'} size={14} />
        {knopTekst(recept)}
      </button>
    </div>
  )
}
