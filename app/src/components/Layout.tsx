import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode, type UIEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { Icon } from '../ds'
import { useBoodschappen, useDezeWeek } from '../lib/queries'
import { voegSamen } from '../lib/lijst'

/**
 * Scroll je naar beneden, dan schuiven de onderbalk en een meeschuivende Voet
 * weg — meer ruimte voor recepten en boodschappen. Pas als je bewust weer
 * omhoog scrollt komen ze terug.
 *
 * Ze liggen als een laag óver de inhoud (het "dok") en schuiven weg met een
 * transform. Daardoor verandert de hoogte van het scrollvlak nooit: een
 * eerdere versie klapte de ruimte in, waarna scrollTop versprong en de balk
 * zichzelf weer liet zien — vooral onderaan en bij het nadeinen op iOS.
 */
interface Onderkant {
  verborgen: boolean
  /** Hoogte van het dok, zodat Inhoud onderaan genoeg ruimte laat. */
  ruimte: number
  voetPlek: HTMLElement | null
  balkPlek: HTMLElement | null
}
const OnderkantContext = createContext<Onderkant>({
  verborgen: false, ruimte: 0, voetPlek: null, balkPlek: null,
})

/** Zo ver moet je naar beneden voor de balk wegschuift… */
const OMLAAG = 12
/** …en zo ver bewust omhoog voordat 'ie terugkomt. */
const OMHOOG = 40

function useVerbergBijScrollen() {
  const [verborgen, setVerborgen] = useState(false)
  const vorige = useRef(0)
  /** Afgelegde afstand in de huidige richting; positief = omlaag. */
  const afstand = useRef(0)

  function onScroll(e: UIEvent<HTMLElement>) {
    const el = e.target
    if (!(el instanceof HTMLElement)) return
    const max = el.scrollHeight - el.clientHeight
    // Horizontale chiprijen en korte lijsten: niets te verbergen.
    if (max <= 0) return
    const top = el.scrollTop

    // Het nadeinen van iOS voorbij de randen is geen scrollbeweging van jou.
    if (top < 0 || top > max) return

    if (top < 40) {
      afstand.current = 0
      vorige.current = top
      if (verborgen) setVerborgen(false)
      return
    }

    const verschil = top - vorige.current
    vorige.current = top
    if (verschil === 0) return
    // Van richting veranderd: opnieuw beginnen met tellen.
    if (Math.sign(verschil) !== Math.sign(afstand.current)) afstand.current = 0
    afstand.current += verschil

    if (!verborgen && afstand.current > OMLAAG) setVerborgen(true)
    // Onderaan aankomen telt niet als omhoog; alleen echt terugscrollen.
    else if (verborgen && afstand.current < -OMHOOG && top < max - 2) setVerborgen(false)
  }

  return { verborgen, onScroll }
}

/** Hoeveel ruimte de onderbalk onderaan inneemt; 0 buiten een Scherm met balk. */
export function useOnderRuimte() {
  return useContext(OnderkantContext).ruimte
}

/**
 * Vast schermskelet uit de designs: een gekleurde kop die niet meescrollt, een
 * scrollend midden, en optioneel een vaste balk onderaan. Zo blijft de
 * eerstvolgende actie altijd in beeld — het ontwerpprincipe uit het design
 * system: nooit tussen jou en "vanavond eten" staan.
 */
export function Scherm({ children, achtergrond = 'var(--c-cream)' }: {
  children: ReactNode
  achtergrond?: string
}) {
  const { verborgen, onScroll } = useVerbergBijScrollen()
  const [dok, setDok] = useState<HTMLElement | null>(null)
  const [voetPlek, setVoetPlek] = useState<HTMLElement | null>(null)
  const [balkPlek, setBalkPlek] = useState<HTMLElement | null>(null)
  const [ruimte, setRuimte] = useState(0)

  useEffect(() => {
    if (!dok) return
    const meter = new ResizeObserver(() => setRuimte(dok.offsetHeight))
    meter.observe(dok)
    return () => meter.disconnect()
  }, [dok])

  const waarde = useMemo(
    () => ({ verborgen, ruimte, voetPlek, balkPlek }),
    [verborgen, ruimte, voetPlek, balkPlek],
  )

  return (
    // Scroll-events bubbelen niet, maar de capture-fase komt wél langs hier.
    <div onScrollCapture={onScroll} style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
      background: achtergrond, overflow: 'hidden',
    }}>
      <OnderkantContext.Provider value={waarde}>{children}</OnderkantContext.Provider>

      <div ref={setDok} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10,
        transform: verborgen ? 'translateY(100%)' : 'translateY(0)',
        transition: 'transform 280ms cubic-bezier(0.2, 0, 0, 1)',
        willChange: 'transform',
      }}>
        <div ref={setVoetPlek} style={{ background: achtergrond }} />
        <div ref={setBalkPlek} />
      </div>
    </div>
  )
}

export function Kop({ children, kleur = 'var(--c-red)', tekstKleur = 'var(--c-cream)', style }: {
  children: ReactNode
  kleur?: string
  tekstKleur?: string
  style?: CSSProperties
}) {
  return (
    <div style={{
      flex: 'none', background: kleur, color: tekstKleur,
      padding: 'calc(env(safe-area-inset-top) + 20px) 22px 14px', ...style,
    }}>
      {children}
    </div>
  )
}

/** Kleine hoofdletterlabel — het terugkerende ritme boven elke sectie. */
export function Label({ children, kleur = 'var(--c-yellow)' }: { children: ReactNode; kleur?: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
      letterSpacing: '.14em', textTransform: 'uppercase', color: kleur,
    }}>{children}</div>
  )
}

export function Titel({ children, grootte = 28 }: { children: ReactNode; grootte?: number }) {
  return (
    <h1 style={{
      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: grootte,
      lineHeight: 0.94, margin: 0, textTransform: 'uppercase',
    }}>{children}</h1>
  )
}

export function Inhoud({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  // Het dok ligt over de onderkant heen; zonder deze ruimte valt je laatste
  // recept of boodschap erachter.
  const { ruimte } = useContext(OnderkantContext)
  return (
    <div style={{
      flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      padding: '16px 22px 8px', display: 'flex', flexDirection: 'column', gap: 12, ...style,
    }}>
      {children}
      {ruimte > 0 && <div aria-hidden style={{ flex: 'none', height: ruimte }} />}
    </div>
  )
}

/**
 * Vaste balk onderaan. Met `meeschuiven` gaat 'ie in het dok boven de
 * onderbalk, en verdwijnt 'ie mee als je naar beneden scrollt.
 */
export function Voet({ children, meeschuiven = false }: { children: ReactNode; meeschuiven?: boolean }) {
  const { voetPlek } = useContext(OnderkantContext)
  const balk = (
    <div style={{
      flex: 'none', padding: '12px 22px 14px',
      borderTop: '1.5px solid rgba(20,20,20,0.12)', background: 'inherit',
    }}>
      {children}
    </div>
  )
  if (!meeschuiven) return balk
  return voetPlek ? createPortal(balk, voetPlek) : null
}

/** De vier tabs uit het design system: home, ontdekken, lijst, profiel. */
const TABS = [
  { pad: '/deze-week', icoon: 'house', label: 'Deze week' },
  { pad: '/ontdekken', icoon: 'grid', label: 'Ontdekken' },
  { pad: '/boodschappen', icoon: 'cart', label: 'Lijst' },
  { pad: '/profiel', icoon: 'user', label: 'Profiel' },
] as const

/**
 * Iets erbij moet je zien gebeuren: het cijfer op "Deze week" of "Lijst"
 * zwelt even op. Bij het openen van een scherm niet — alleen als het aantal
 * stijgt terwijl je kijkt.
 */
const TELLER_ANIMATIE = `
@keyframes teller-plop { 0% { transform: scale(1) } 35% { transform: scale(1.7) } 70% { transform: scale(0.9) } 100% { transform: scale(1) } }
@media (prefers-reduced-motion: reduce) { .teller-plop { animation: none !important } }
`

function Teller({ aantal, label }: { aantal: number; label: string }) {
  const vorige = useRef(aantal)
  const [plop, setPlop] = useState(0)

  useEffect(() => {
    if (aantal > vorige.current) setPlop((p) => p + 1)
    vorige.current = aantal
  }, [aantal])

  if (aantal === 0) return null
  return (
    <span
      key={plop}
      className="teller-plop"
      aria-label={`${aantal} ${label}`}
      style={{
        position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, padding: '0 5px',
        borderRadius: 'var(--radius-full)', background: 'var(--c-red-bright)', color: 'var(--c-paper)',
        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, lineHeight: '18px',
        textAlign: 'center', boxSizing: 'border-box', border: '1.5px solid var(--color-surface-card)',
        animation: plop > 0 ? 'teller-plop 520ms var(--ease)' : undefined,
      }}
    >{aantal}</span>
  )
}

export function OnderBalk() {
  const { balkPlek } = useContext(OnderkantContext)
  const dezeWeek = useDezeWeek()
  const boodschappen = useBoodschappen()
  // Zelfde telling als het Boodschappen-scherm: samengevoegde regels, nog niet afgevinkt.
  const producten = useMemo(
    () => voegSamen(boodschappen.data ?? []).filter((r) => !r.afgevinkt).length,
    [boodschappen.data],
  )
  const tellers: Record<string, { aantal: number; label: string }> = {
    '/deze-week': { aantal: dezeWeek.data?.length ?? 0, label: 'recepten deze week' },
    '/boodschappen': { aantal: producten, label: 'producten op je lijst' },
  }

  if (!balkPlek) return null
  return createPortal(
    <nav style={{
      flex: 'none', display: 'flex', justifyContent: 'space-around',
      background: 'var(--color-surface-card)', borderTop: '1px solid var(--c-red-100)',
      padding: '10px 0 calc(10px + env(safe-area-inset-bottom))',
    }}>
      <style>{TELLER_ANIMATIE}</style>
      {TABS.map((tab) => (
        <NavLink
          key={tab.pad}
          to={tab.pad}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '4px 14px', textDecoration: 'none',
            color: isActive ? 'var(--color-action)' : 'var(--c-ink-300)',
          })}
        >
          <span style={{ position: 'relative', display: 'flex' }}>
            <Icon name={tab.icoon} size={22} />
            {tellers[tab.pad] && <Teller {...tellers[tab.pad]} />}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 400 }}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>,
    balkPlek,
  )
}
