import { Chip } from '../../ds'
import { ALLERGENEN } from '../../lib/allergenen'

/**
 * De invoer voor keukens en allergieën, gedeeld door Instellingen en de
 * onboarding. Komt er een keuken of allergeen bij, dan staat die op beide
 * plekken.
 */

const rijStijl: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 }

/**
 * Chips voor je favoriete keukens (gebruiker_voorkeuren.favoriete_keukens).
 *
 * In de database betekent een lege lijst "geen voorkeur". Instellingen toont
 * dat als alles aan (`leegIsAlles`): daar tik je uit wat je minder graag eet.
 * De onboarding toont het als niets aan: daar tik je aan wat je lekker vindt.
 */
export function KeukenKeuze({ keukens, gekozen, leegIsAlles = false, groot, onWijzig }: {
  /** Alle keukens uit de pool (useKeukens). */
  keukens: string[]
  gekozen: string[]
  leegIsAlles?: boolean
  groot?: boolean
  onWijzig: (keukens: string[]) => void
}) {
  // Alleen wat nog in de pool zit: een keuken die verdween telt niet mee.
  const mijn = keukens.filter((k) => gekozen.includes(k))
  const aan = leegIsAlles && mijn.length === 0 ? keukens : mijn
  return (
    <div style={rijStijl}>
      {keukens.map((k) => {
        const staatAan = aan.includes(k)
        return (
          <Chip
            key={k}
            selected={staatAan}
            groot={groot}
            onClick={() => {
              const nieuw = staatAan ? aan.filter((x) => x !== k) : [...aan, k]
              // Alles aan of alles uit is hetzelfde: geen voorkeur.
              onWijzig(leegIsAlles && nieuw.length === keukens.length ? [] : nieuw)
            }}
          >{k}</Chip>
        )
      })}
    </div>
  )
}

/** Chips voor je allergieën (gebruiker_voorkeuren.allergieen), met optioneel een chip "Geen". */
export function AllergieKeuze({ gekozen, metGeen = false, groot, onWijzig }: {
  gekozen: string[]
  metGeen?: boolean
  groot?: boolean
  onWijzig: (allergieen: string[]) => void
}) {
  return (
    <div style={rijStijl}>
      {metGeen && (
        <Chip selected={gekozen.length === 0} groot={groot} onClick={() => onWijzig([])}>Geen</Chip>
      )}
      {ALLERGENEN.map((a) => {
        const aan = gekozen.includes(a.id)
        return (
          <Chip
            key={a.id}
            selected={aan}
            groot={groot}
            onClick={() => onWijzig(aan ? gekozen.filter((x) => x !== a.id) : [...gekozen, a.id])}
          >{a.label}</Chip>
        )
      })}
    </div>
  )
}
