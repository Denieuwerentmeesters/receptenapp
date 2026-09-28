import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode, type UIEvent,
} from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from '../ds'
import { useBoodschappen, useDezeWeek } from '../lib/queries'
import { voegSamen } from '../lib/lijst'

/**
 * Scroll je naar beneden, dan schuiven de onderbalk en een meeschuivende Voet
 * weg — meer ruimte voor recepten en boodschappen. Een stukje omhoog en ze
 * zijn er weer.
 */
const OnderkantVerborgen = createContext(false)

/** Hoe ver je moet scrollen voordat we reageren; kleine trillingen tellen niet. */
const DREMPEL = 8
/**
 * Terwijl de balk in- of uitschuift verandert de hoogte van het scrollvlak,
 * en daarmee soms scrollTop. Die sprong is geen scrollbeweging van jou.
 */
const RUSTTIJD = 350

function useVerbergBijScrollen() {
  const [verborgen, setVerborgen] = useState(false)
  const vorige = useRef(0)
  const rustTot = useRef(0)

  function onScroll(e: UIEvent<HTMLElement>) {
    const el = e.target as HTMLElement
    if (!(el instanceof HTMLElement) || el.scrollHeight <= el.clientHeight) return
    const top = el.scrollTop
    const verschil = top - vorige.current
    if (Date.now() < rustTot.current) { vorige.current = top; return }
    if (Math.abs(verschil) < DREMPEL) return
    vorige.current = top

    // Bovenaan altijd tonen; anders volgt het de richting.
    const nieuw = top > 40 && verschil > 0
    if (nieuw !== verborgen) {
      rustTot.current = Date.now() + RUSTTIJD
      setVerborgen(nieuw)
    }
  }

  return { verborgen, onScroll }
}

/** Klapt de hoogte weg met een grid-truc, zodat de ruimte echt vrijkomt. */
function Inklapper({ children, dicht }: { children: ReactNode; dicht: boolean }) {
  return (
    <div style={{
      flex: 'none', display: 'grid', gridTemplateRows: dicht ? '0fr' : '1fr',
      transition: 'grid-template-rows var(--motion-base) var(--ease)',
    }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  )
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
  return (
    // Scroll-events bubbelen niet, maar de capture-fase komt wél langs hier.
    <div onScrollCapture={onScroll} style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: achtergrond, overflow: 'hidden',
    }}>
      <OnderkantVerborgen.Provider value={verborgen}>{children}</OnderkantVerborgen.Provider>
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
  return (
    <div style={{
      flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      padding: '16px 22px 8px', display: 'flex', flexDirection: 'column', gap: 12, ...style,
    }}>
      {children}
    </div>
  )
}

/**
 * Vaste balk onderaan. Met `meeschuiven` verdwijnt 'ie samen met de
 * onderbalk als je naar beneden scrollt.
 */
export function Voet({ children, meeschuiven = false }: { children: ReactNode; meeschuiven?: boolean }) {
  const verborgen = useContext(OnderkantVerborgen)
  const balk = (
    <div style={{
      flex: 'none', padding: '12px 22px 14px',
      borderTop: '1.5px solid rgba(20,20,20,0.12)', background: 'inherit',
    }}>
      {children}
    </div>
  )
  return meeschuiven ? <Inklapper dicht={verborgen}>{balk}</Inklapper> : balk
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
  const verborgen = useContext(OnderkantVerborgen)
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

  return (
    <Inklapper dicht={verborgen}>
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
    </nav>
    </Inklapper>
  )
}
