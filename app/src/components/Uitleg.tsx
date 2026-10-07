import { useRef, useState } from 'react'
import { Button, IconButton } from '../ds'
import ontdekken from '../assets/uitleg/ontdekken.webp'
import dezeWeek from '../assets/uitleg/deze-week.webp'
import voorraadkast from '../assets/uitleg/voorraadkast.webp'
import lijst from '../assets/uitleg/lijst.webp'

/**
 * De uitleg in vijf kaarten: wat Pinch doet, van zoeken tot mandje. Staat in
 * de onboarding vóór de vragen, en is later terug te kijken via Instellingen.
 *
 * Elke kaart is een schermafbeelding van de app zelf, met één ding uitgelicht:
 * de rest is gedimd. Geen nagetekende schermen: wat je hier ziet is wat je
 * daarna tegenkomt. Verandert een scherm, maak dan een nieuwe afbeelding
 * (src/assets/uitleg/, 780 × 1688 px: een telefoon van 390 breed) en zet het uitgelichte
 * vlak opnieuw.
 */

/** Een vlak op de afbeelding, in delen van de breedte en hoogte (0 t/m 1). */
interface Vlak { x: number; y: number; b: number; h: number }

interface Kaart {
  kop: string
  tekst: string
  beeld: string
  /** Wat de afbeelding laat zien, voor wie hem niet ziet. */
  alt: string
  /** Hoogte gedeeld door breedte van de afbeelding. */
  verhouding: number
  licht: Vlak
  /** Afronding van het uitgelichte vlak, in px. */
  rond?: number
}

const KAARTEN: Kaart[] = [
  {
    kop: 'Zoek',
    tekst: 'Honderden recepten. Zoek op gerecht of ingrediënt, of filter op keuken, tijd, budget en dieet.',
    beeld: ontdekken, alt: 'Het scherm Ontdekken, met de zoekbalk en de filters uitgelicht.',
    verhouding: 1688 / 780, licht: { x: 0.03, y: 0.068, b: 0.94, h: 0.21 }, rond: 18,
  },
  {
    kop: 'Bewaar',
    tekst: 'Tik op het hartje en het recept staat bij je favorieten. Je eigen recepten zet je er ook bij.',
    beeld: ontdekken, alt: 'Een receptkaart in Ontdekken, met het hartje uitgelicht.',
    verhouding: 1688 / 780, licht: { x: 0.352, y: 0.331, b: 0.124, h: 0.0575 }, rond: 999,
  },
  {
    kop: 'Zet op je lijst',
    tekst: 'Kies je recepten voor deze week. Pinch zet alle ingrediënten op één boodschappenlijst en telt dubbele bij elkaar op.',
    beeld: dezeWeek, alt: 'Het scherm Deze week, met een recept dat op je lijst staat uitgelicht: gele rand en de knop Op je lijst.',
    verhouding: 1688 / 780, licht: { x: 0.05, y: 0.249, b: 0.44, h: 0.293 }, rond: 26,
  },
  {
    kop: 'Voorraadkast',
    tekst: 'Laat Pinch weten wat je standaard in huis hebt, zoals olie, rijst of kruiden. Dat gaat niet mee in je bestelling.',
    beeld: voorraadkast, alt: 'Het scherm Voorraadkast, met de producten die je in één tik toevoegt uitgelicht: olijfolie, uien, rijst.',
    verhouding: 1688 / 780, licht: { x: 0.05, y: 0.842, b: 0.9, h: 0.145 }, rond: 18,
  },
  {
    kop: 'Naar je supermarkt',
    tekst: 'Eén tik en alles gaat naar je mandje bij AH of Jumbo.',
    beeld: lijst, alt: 'De boodschappenlijst, met de mandjeknop uitgelicht.',
    verhouding: 1688 / 780, licht: { x: 0.045, y: 0.805, b: 0.91, h: 0.071 }, rond: 999,
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

      <Beeld kaart={huidig} />

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

/* -------------------------------------------------------------------- beeld */

/**
 * De schermafbeelding, zo geschoven dat het uitgelichte vlak midden in het
 * venster staat. Het vlak zelf is een gat in een donkere laag: de schaduw
 * van het vlak dekt de rest van de afbeelding af.
 */
function Beeld({ kaart }: { kaart: Kaart }) {
  const { licht } = kaart
  // Niet verder schuiven dan de afbeelding lang is: anders zie je boven of onder een lege strook.
  const midden = Math.min(0.7, Math.max(0.3, licht.y + licht.h / 2))
  return (
    <div
      role="img" aria-label={kaart.alt}
      style={{
        flex: '1 1 0', minHeight: 0, maxHeight: 440, position: 'relative', overflow: 'hidden',
        borderRadius: 24, background: 'var(--c-ink)',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%', aspectRatio: `1 / ${kaart.verhouding}`,
        transform: `translateY(-${midden * 100}%)`,
      }}>
        <img src={kaart.beeld} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%' }} />
        <div style={{
          position: 'absolute', boxSizing: 'border-box',
          left: `${licht.x * 100}%`, top: `${licht.y * 100}%`,
          width: `${licht.b * 100}%`, height: `${licht.h * 100}%`,
          borderRadius: kaart.rond ?? 14, border: '3px solid var(--c-paper)',
          boxShadow: '0 0 0 2000px rgba(20,20,20,0.55)',
        }} />
      </div>
    </div>
  )
}
