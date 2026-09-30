import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Chip, Icon } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { BespaardMelding } from '../components/BespaardMelding'
import { useOpLijst } from '../components/OpLijst'
import { useDezeWeek, useLijstActies, useVoorkeuren, type WeekRecept } from '../lib/queries'
import { weekLabel, weekStart } from '../lib/week'
import { isBudget } from '../lib/prijsschatting'
import { tokoIngredienten } from '../lib/toko'
import { TokoLabel } from '../components/TokoLabel'
import { BonusBron, BonusLabel } from '../components/Bonus'
import { BONUS_BRON, receptBonus, useBonus, type BonusActie } from '../lib/bonus'
import { useVoorraad } from '../lib/queries2'
import { kiesWeek } from '../lib/weekvullen'

type Filter = 'alles' | 'lijst' | 'bonus' | 'budget' | 'vega' | 'snel'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alles', label: 'Alles' },
  { id: 'lijst', label: 'Op mijn lijst' },
  { id: 'bonus', label: 'In de bonus' },
  { id: 'budget', label: 'Budget' },
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
 * zelf via Ontdekken (het hartje) toevoegde. Tik je een recept aan, dan gaat
 * het op je boodschappenlijst en krijgt het een gele rand; met het kruisje
 * haal je het helemaal uit je week. Na de boodschappen verdwijnt de gele
 * rand, maar het recept blijft staan — hiervandaan kook je.
 *
 * "Vul mijn week" kiest in één tik zoveel recepten als je kookavonden hebt
 * (lib/weekvullen.ts). Wat je dan niet ziet zitten ruil je per kaart.
 */
export function DezeWeek() {
  const week = weekStart()
  const navigeer = useNavigate()
  const [filter, setFilter] = useState<Filter>('alles')

  const dezeWeek = useDezeWeek(week)
  const voorkeuren = useVoorkeuren()
  const { voegToe, dialoog } = useOpLijst(week)
  const { zetOpLijst, haalUitWeek } = useLijstActies(week)
  const voorraad = useVoorraad()
  // Staat het op je lijst, dan vragen we eerst: dan gaan er ook boodschappen af.
  const [wegVraag, setWegVraag] = useState<WeekRecept | null>(null)
  const [bezig, setBezig] = useState(false)
  const [suggestiesOp, setSuggestiesOp] = useState(false)

  const recepten = useMemo(() => dezeWeek.data ?? [], [dezeWeek.data])
  const bonus = useBonus()
  const bonusPerRecept = useMemo(() => new Map(recepten.map((r) => [r.id, receptBonus(r.ingredienten, bonus.data)])), [recepten, bonus.data])
  const zichtbaar = recepten.filter((r) =>
    filter === 'alles' ? true
      : filter === 'lijst' ? r.opLijst
      : filter === 'bonus' ? Boolean(bonusPerRecept.get(r.id))
      : filter === 'budget' ? isBudget(r)
      : filter === 'vega' ? isVega(r)
      : (r.bereidingstijd_minuten ?? 999) <= 30)

  const opLijst = recepten.filter((r) => r.opLijst).length
  const vegaAantal = recepten.filter(isVega).length
  const personen = voorkeuren.data?.aantal_personen ?? 4
  const kookavonden = voorkeuren.data?.kookavonden ?? 4

  // Kandidaten voor vullen en ruilen: suggesties die je nog niet koos. Bonus weegt mee.
  const kandidaten = recepten
    .filter((r) => r.positie !== null && !r.gekozen && !r.gekooktOp)
    .map((r) => ({ ...r, inBonus: Boolean(bonusPerRecept.get(r.id)) }))
  // Wat al in je week zit telt mee, ook als je het al gekocht of gekookt hebt.
  const gekozen = recepten.filter((r) => r.gekozen)
  const inHuis = new Set((voorraad.data ?? []).filter((v) => v.in_huis).map((v) => v.ingredient_key))
  const vegaMinimum = voorkeuren.data?.vega_minimum ?? 0
  const toonVullen = gekozen.length < kookavonden && kandidaten.length > 0

  async function vulWeek() {
    setBezig(true)
    try {
      const ids = kiesWeek(kandidaten, { vega_minimum: vegaMinimum, kookavonden }, gekozen, inHuis)
      // Na elkaar, zodat een fout halverwege niet de helft stil laat mislukken.
      for (const id of ids) await zetOpLijst.mutateAsync({ receptId: id, automatisch: true })
    } finally {
      setBezig(false)
    }
  }

  /** Haalt een recept van je lijst en zet het volgende passende recept uit de tien ervoor in de plaats. */
  async function ruil(recept: WeekRecept) {
    const rest = gekozen.filter((r) => r.id !== recept.id)
    const [vervanger] = kiesWeek(kandidaten, { vega_minimum: vegaMinimum, kookavonden: rest.length + 1 }, rest, inHuis)
    if (!vervanger) { setSuggestiesOp(true); return }
    setBezig(true)
    try {
      await haalUitWeek.mutateAsync({ receptId: recept.id, geruild: true })
      await zetOpLijst.mutateAsync({ receptId: vervanger, automatisch: true })
    } finally {
      setBezig(false)
    }
  }

  return (
    <Scherm>
      <BespaardMelding />
      <Grens query={dezeWeek} ladenTekst="Je week ophalen">
        {/* Compact: de recepten zijn waar het om gaat, niet de kop. */}
        <Kop kleur="var(--c-red-bright)" style={{ paddingBottom: 14 }}>
          <Label>Week van {weekLabel(week)}</Label>
          <div style={{ marginTop: 6 }}><Titel grootte={22}>Wat eet jij deze week?</Titel></div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, margin: '6px 0 0' }}>
            {recepten.length} recepten · {vegaAantal} vegetarisch · voor {personen} {personen === 1 ? 'persoon' : 'personen'}
          </p>
        </Kop>

        <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '12px 22px 4px', overflowX: 'auto' }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {filter === 'bonus' && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, color: 'rgba(20,20,20,0.6)', margin: '6px 22px 0' }}>
            Het hoofdingrediënt is in de bonus op je eerste bezorgdag. {BONUS_BRON.uitleg} <BonusBron klein />
          </p>
        )}

        {recepten.length === 0 ? (
          <Leeg
            icoon="utensils"
            kop="Nog geen weekmenu"
            tekst="We zetten elke week 10 recepten voor je klaar. Je voorkeuren kun je altijd nog aanpassen in Instellingen."
            knop={dezeWeek.isFetching ? 'Even zoeken…' : 'Zet mijn week klaar'}
            onKnop={() => { if (!dezeWeek.isFetching) void dezeWeek.refetch() }}
          />
        ) : (
          <Inhoud style={{ padding: '8px 22px 16px', gap: 0 }}>
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

            {toonVullen && (
              <Button
                tone="yellow" icon="shuffle" disabled={bezig} onClick={() => void vulWeek()}
                style={{ width: '100%', marginBottom: 14 }}
              >
                {bezig ? 'Even kiezen…' : `Vul mijn week · nog ${kookavonden - gekozen.length} ${kookavonden - gekozen.length === 1 ? 'recept' : 'recepten'}`}
              </Button>
            )}

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
                gap: 12,
              }}>
                {zichtbaar.map((recept, i) => (
                  <ReceptKaart
                    key={recept.id}
                    recept={recept}
                    vlak={VLAKKEN[i % VLAKKEN.length]}
                    bonus={bonusPerRecept.get(recept.id) ?? null}
                    personen={personen}
                    onOpen={() => navigeer(`/recept/${recept.id}`)}
                    onLijst={() => voegToe({ ...recept, titel: recept.titel_nl ?? recept.titel })}
                    onWeg={() => (recept.opLijst ? setWegVraag(recept) : haalUitWeek.mutate(recept.id))}
                    onRuil={recept.opLijst && !recept.gekooktOp && !bezig ? () => void ruil(recept) : undefined}
                  />
                ))}
              </div>
            )}
          </Inhoud>
        )}

      </Grens>

      {dialoog}
      <Dialoog
        open={Boolean(wegVraag)}
        kop="Uit je week halen?"
        tekst={wegVraag
          ? `${wegVraag.titel_nl ?? wegVraag.titel} staat op je boodschappenlijst. De ingrediënten gaan er dan ook af.`
          : undefined}
        onSluit={() => setWegVraag(null)}
        acties={[
          { label: 'Ja, haal weg', hoofd: true, onClick: () => { if (wegVraag) haalUitWeek.mutate(wegVraag.id); setWegVraag(null) } },
          { label: 'Laat maar', onClick: () => setWegVraag(null) },
        ]}
      />
      <Dialoog
        open={suggestiesOp}
        kop="De suggesties zijn op"
        tekst="Alle tien recepten van deze week zijn gekozen of weggeklikt. In Ontdekken vind je er meer."
        onSluit={() => setSuggestiesOp(false)}
        acties={[
          { label: 'Naar Ontdekken', hoofd: true, onClick: () => { setSuggestiesOp(false); navigeer('/ontdekken') } },
          { label: 'Laat maar', onClick: () => setSuggestiesOp(false) },
        ]}
      />
      <OnderBalk />
    </Scherm>
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

function ReceptKaart({ recept, vlak, bonus, personen, onOpen, onLijst, onWeg, onRuil }: {
  recept: WeekRecept
  vlak: string
  /** Hoofdingrediënt in de bonus bij je winkel: het gele label op de foto. */
  bonus: { naam: string; acties: BonusActie[] } | null
  personen: number
  onOpen: () => void
  onLijst: () => void
  onWeg: () => void
  /** Alleen op kaarten die op je lijst staan: ruil voor een ander recept uit de tien. */
  onRuil?: () => void
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
      {bonus && <BonusLabel naam={bonus.naam} acties={bonus.acties} />}
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
          {recept.afbeelding_url ? '' : 'foto'}
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
        onClick={onLijst}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34,
          borderRadius: 'var(--radius-full)', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, background: 'var(--c-paper)',
          border: `1.5px solid ${recept.opLijst ? 'var(--c-red)' : 'rgba(20,20,20,0.14)'}`,
          color: recept.opLijst ? 'var(--c-red)' : 'var(--c-ink)',
        }}
      >
        <Icon name={recept.opLijst ? 'check' : 'plus'} size={14} />
        {knopTekst(recept)}
      </button>
      {onRuil && (
        <button
          onClick={onRuil}
          aria-label="Ruil voor een ander recept"
          title="Ruil"
          style={{
            flex: 'none', width: 34, height: 34, borderRadius: 'var(--radius-full)', cursor: 'pointer',
            background: 'var(--c-paper)', border: '1.5px solid var(--c-red)', color: 'var(--c-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        ><Icon name="shuffle" size={14} /></button>
      )}
      </div>
    </div>
  )
}
