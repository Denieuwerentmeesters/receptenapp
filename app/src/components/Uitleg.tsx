import { useRef, useState } from 'react'
import { Button, Icon, IconButton } from '../ds'

/**
 * De uitleg in vijf kaarten: wat Pinch doet, van zoeken tot mandje. Staat in
 * de onboarding vóór de vragen, en is later terug te kijken via Instellingen.
 * Elke kaart heeft een kop, één zin en een klein beeld dat op de app lijkt.
 *
 * De beelden zijn getekend, geen schermafbeeldingen: zo kloppen ze op elk
 * toestel en verouderen ze niet bij elke kleine wijziging.
 */

interface Kaart {
  kop: string
  tekst: string
  vlak: string
  beeld: React.ReactNode
}

const KAARTEN: Kaart[] = [
  {
    kop: 'Zoek',
    tekst: 'Ruim 500 recepten. Filter op keuken, tijd, budget en vegetarisch.',
    vlak: 'var(--c-orange)',
    beeld: <BeeldZoek />,
  },
  {
    kop: 'Bewaar',
    tekst: 'Tik op het hartje en het recept staat bij je favorieten. Je eigen recepten zet je er ook bij.',
    vlak: 'var(--cat-lunch-tint)',
    beeld: <BeeldBewaar />,
  },
  {
    kop: 'Zet op je lijst',
    tekst: 'Kies je recepten voor deze week. Pinch zet alle ingrediënten op één boodschappenlijst en telt dubbele bij elkaar op.',
    vlak: 'var(--c-red-bright)',
    beeld: <BeeldLijst />,
  },
  {
    kop: 'Voorraadkast',
    tekst: 'Laat Pinch weten wat je standaard in huis hebt, zoals olie, rijst of kruiden. Dat gaat niet mee in je bestelling.',
    vlak: 'var(--c-green)',
    beeld: <BeeldVoorraad />,
  },
  {
    kop: 'Naar je supermarkt',
    tekst: 'Eén tik en alles gaat naar je mandje bij AH of Jumbo.',
    vlak: 'var(--c-yellow)',
    beeld: <BeeldMandje />,
  },
]

export const AANTAL_UITLEGKAARTEN = KAARTEN.length

export function Uitleg({ start = 0, laatsteKnop, overslaanTekst, onKlaar, onOverslaan, onTerug }: {
  /** Bij welke kaart je begint; de onboarding komt soms terug bij de laatste. */
  start?: number
  /** Tekst op de knop van de laatste kaart. */
  laatsteKnop: string
  overslaanTekst: string
  onKlaar: () => void
  /** Krijgt mee bij welke kaart je afhaakte (1 t/m 5). */
  onOverslaan: (kaart: number) => void
  /** Terug vanaf de eerste kaart. */
  onTerug: () => void
}) {
  const [kaart, setKaart] = useState(Math.min(Math.max(start, 0), KAARTEN.length - 1))
  const veegStart = useRef<number | null>(null)
  const huidig = KAARTEN[kaart]
  const laatste = kaart === KAARTEN.length - 1

  const volgende = () => (laatste ? onKlaar() : setKaart(kaart + 1))
  const vorige = () => (kaart === 0 ? onTerug() : setKaart(kaart - 1))

  return (
    <div
      // Vegen bladert, net als de knop. Verticaal vegen laten we met rust.
      onTouchStart={(e) => { veegStart.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (veegStart.current === null) return
        const verschil = e.changedTouches[0].clientX - veegStart.current
        veegStart.current = null
        if (verschil < -50) volgende()
        else if (verschil > 50 && kaart > 0) setKaart(kaart - 1)
      }}
      style={{
        height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20,
        background: 'var(--c-cream)', color: 'var(--c-ink)', fontFamily: 'var(--font-body)',
        padding: 'calc(env(safe-area-inset-top) + 16px) 22px calc(env(safe-area-inset-bottom) + 20px)',
      }}
    >
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <IconButton icon="chevronLeft" label="Terug" onClick={vorige} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden>
          {KAARTEN.map((k, i) => (
            <span key={k.kop} style={{
              height: 8, width: i === kaart ? 24 : 8, borderRadius: 'var(--radius-full)',
              background: i === kaart ? 'var(--c-red)' : 'var(--c-red-100)',
              transition: 'width var(--motion-fast) var(--ease)',
            }} />
          ))}
        </div>
        <button
          onClick={() => onOverslaan(kaart + 1)}
          style={{
            height: 44, padding: '0 2px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--c-ink-500)',
          }}
        >{overslaanTekst}</button>
      </div>

      <div style={{
        flex: '1 1 0', minHeight: 0, maxHeight: 340, boxSizing: 'border-box', overflow: 'hidden',
        borderRadius: 24, background: huidig.vlak, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {huidig.beeld}
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: 'var(--c-ink-500)' }}>
          STAP {kaart + 1} VAN {KAARTEN.length}
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, lineHeight: 1.1,
          margin: 0, textTransform: 'uppercase',
        }}>{huidig.kop}</h1>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>{huidig.tekst}</p>
      </div>

      <Button size="lg" onClick={volgende} style={{ flex: 'none', marginTop: 'auto', width: '100%', fontSize: 16 }}>
        {laatste ? laatsteKnop : 'Volgende'}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ beelden */

const wit: React.CSSProperties = { background: 'var(--c-paper)', borderRadius: 16, color: 'var(--c-ink)' }
const grijs = 'var(--c-ink-500)'
const lijn = '1px solid rgba(20,20,20,0.08)'

/** Een bord van boven: de plek van de foto. */
function Bord({ hoogte, vlak }: { hoogte: number; vlak: string }) {
  return (
    <div style={{ height: hoogte, background: vlak, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={hoogte * 0.5} height={hoogte * 0.5} viewBox="0 0 40 40" fill="none" stroke="var(--c-warm-700)" strokeWidth={2}>
        <circle cx={20} cy={20} r={15} /><circle cx={20} cy={20} r={9} />
      </svg>
    </div>
  )
}

function MiniChip({ children, aan }: { children: React.ReactNode; aan?: boolean }) {
  return (
    <span style={{
      padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: 12, whiteSpace: 'nowrap',
      fontWeight: aan ? 700 : 400,
      background: aan ? 'var(--c-red)' : 'var(--c-paper)', color: aan ? 'var(--c-cream)' : 'var(--c-ink)',
    }}>{children}</span>
  )
}

function BeeldZoek() {
  const kaart = (titel: string, meta: string, vlak: string) => (
    <div style={{ ...wit, overflow: 'hidden' }}>
      <Bord hoogte={72} vlak={vlak} />
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 13, lineHeight: 1.25, fontWeight: 700 }}>{titel}</div>
        <div style={{ fontSize: 11, color: grijs, marginTop: 4 }}>{meta}</div>
      </div>
    </div>
  )
  return (
    <>
      <div style={{ ...wit, borderRadius: 12, height: 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontSize: 14, color: grijs }}>
        <Icon name="search" size={18} />Zoek een recept
      </div>
      <div style={{ display: 'flex', gap: 8, flex: 'none', overflow: 'hidden' }}>
        <MiniChip aan>Italiaans</MiniChip><MiniChip>Vegetarisch</MiniChip><MiniChip>Binnen 30 min</MiniChip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {kaart('Ribollita met bonen en brood', '50 min · vegetarisch', 'var(--cat-lunch-tint)')}
        {kaart('Pasta uit de oven met gehakt', '45 min · budget', 'var(--c-warm-300)')}
      </div>
    </>
  )
}

function BeeldBewaar() {
  return (
    <>
      <div style={{ ...wit, overflow: 'hidden', flex: 'none' }}>
        <div style={{ position: 'relative' }}>
          <Bord hoogte={120} vlak="var(--c-warm-300)" />
          {/* Het hartje is waar het om gaat: groot, met een gele ring. */}
          <div style={{
            position: 'absolute', top: 12, right: 12, width: 52, height: 52, borderRadius: 'var(--radius-full)',
            background: 'var(--c-paper)', boxShadow: '0 0 0 5px var(--c-yellow)', color: 'var(--c-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="heart" size={26} style={{ fill: 'currentColor' }} />
          </div>
        </div>
        <div style={{ padding: '10px 14px 12px' }}>
          <div style={{ fontSize: 15, lineHeight: 1.25, fontWeight: 700 }}>Ribollita met bonen en brood</div>
          <div style={{ fontSize: 12, color: grijs, marginTop: 4 }}>Bewaard bij je favorieten</div>
        </div>
      </div>
      <div style={{ ...wit, flex: 'none', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, lineHeight: 1.25, fontWeight: 700 }}>Oma's stoofpot</div>
          <div style={{ fontSize: 12, color: grijs, marginTop: 4 }}>3 uur · voor 4 personen</div>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'var(--c-ink)', color: 'var(--c-cream)',
          fontSize: 11, fontWeight: 700, letterSpacing: '.06em', whiteSpace: 'nowrap',
        }}>EIGEN RECEPT</span>
      </div>
    </>
  )
}

function BeeldLijst() {
  const regels: [string, string][] = [
    ['3 uien', 'uit Nasi goreng en Pasta uit de oven'],
    ['500 g kipdijfilet', 'uit Nasi goreng'],
    ['350 g penne', 'uit Pasta uit de oven'],
    ['1 blik tomatenblokjes', 'uit Pasta uit de oven'],
  ]
  return (
    <div style={{ ...wit, padding: '14px 16px 6px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: grijs, paddingBottom: 4 }}>BOODSCHAPPENLIJST</div>
      {regels.map(([naam, uit], i) => (
        <div key={naam} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i ? lijn : 'none' }}>
          <span style={{ width: 20, height: 20, flex: 'none', boxSizing: 'border-box', border: '2px solid var(--c-ink-300)', borderRadius: 'var(--radius-full)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{naam}</div>
            <div style={{ fontSize: 12, color: grijs }}>{uit}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function BeeldVoorraad() {
  const regels: [string, boolean][] = [['Olijfolie', true], ['Rijst', true], ['Paprikapoeder', true], ['Knoflook', false]]
  return (
    <div style={{ ...wit, padding: '14px 16px 6px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: grijs, paddingBottom: 4 }}>VOORRAADKAST</div>
      {regels.map(([naam, inHuis], i) => (
        <div key={naam} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: i ? lijn : 'none' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{naam}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: grijs }}>
            {inHuis ? 'In huis' : 'Op'}
            <span style={{
              width: 40, height: 24, borderRadius: 'var(--radius-full)', padding: 3, boxSizing: 'border-box',
              display: 'flex', justifyContent: inHuis ? 'flex-end' : 'flex-start',
              background: inHuis ? 'var(--c-red)' : 'rgba(20,20,20,0.18)',
            }}>
              <span style={{ width: 18, height: 18, borderRadius: 'var(--radius-full)', background: 'var(--c-paper)' }} />
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function BeeldMandje() {
  const rij: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', fontSize: 14 }
  const thuis = (
    <span style={{
      textDecoration: 'none', padding: '3px 9px', borderRadius: 'var(--radius-full)', background: 'var(--c-red-100)',
      color: 'var(--c-ink)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
    }}>THUIS</span>
  )
  return (
    <div style={{ ...wit, padding: '8px 16px 16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...rij, fontWeight: 700 }}>500 g kipdijfilet</div>
      <div style={{ ...rij, fontWeight: 700, borderTop: lijn }}>3 uien</div>
      <div style={{ ...rij, borderTop: lijn, color: grijs }}><s>Rijst</s>{thuis}</div>
      <div style={{
        marginTop: 12, height: 48, borderRadius: 'var(--radius-full)', background: 'var(--c-red)', color: 'var(--c-cream)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 700,
      }}>
        <Icon name="cart" size={20} />Naar je mandje (15)
      </div>
    </div>
  )
}
