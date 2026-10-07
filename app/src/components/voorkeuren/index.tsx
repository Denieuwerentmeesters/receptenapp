import { useState } from 'react'
import { Chip } from '../../ds'
import { ALLERGENEN } from '../../lib/allergenen'
import { ingredientKey } from '../../lib/schaal'
import { VOORRAAD_SUGGESTIES, voorraadNaam } from '../../lib/voorraad'

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

/** Zoveel suggesties staan er als je begint; bij elke tik komt de volgende erbij. */
const VOORRAAD_START = 12

/**
 * Wat je standaard in huis hebt, voor de onboarding. Drie manieren om iets
 * aan te zetten, zodat je niet zelf hoeft te bedenken wat er in een kast staat:
 *
 * - De chips: de meest voorkomende producten. Tik je er een aan, dan komt de
 *   volgende uit VOORRAAD_SUGGESTIES erbij, van vaak naar zelden.
 * - Het veld: typ je "mis", dan staan de producten uit de lijst die erop
 *   lijken eronder ("Misopasta").
 * - Staat het er niet tussen, dan voeg je toe wat je typte.
 *
 * `bekend` is wat al in de kast staat; dat blijft zichtbaar, ook als je het uitzet.
 */
export function VoorraadKeuze({ gekozen, bekend, onZet }: {
  gekozen: string[]
  bekend: string[]
  onZet: (naam: string, aan: boolean) => void
}) {
  const [rij, setRij] = useState(() => VOORRAAD_SUGGESTIES.slice(0, VOORRAAD_START))
  const [tekst, setTekst] = useState('')

  const gekozenKeys = new Set(gekozen.map(ingredientKey))
  const rijKeys = new Set(rij.map(ingredientKey))
  // Wat je zelf toevoegde of al had, en niet tussen de suggesties staat: bovenaan.
  const eigen = [...bekend, ...gekozen]
    .filter((n, i, alle) => !rijKeys.has(ingredientKey(n)) && alle.findIndex((x) => ingredientKey(x) === ingredientKey(n)) === i)
  const eigenKeys = new Set(eigen.map(ingredientKey))

  function zet(naam: string, aan: boolean, uitRij: boolean) {
    onZet(naam, aan)
    if (!aan || !uitRij) return
    // Eén erbij voor elke die je aantikt: zo loop je de lijst af zonder te scrollen of te typen.
    const volgende = VOORRAAD_SUGGESTIES.find((s) => !rijKeys.has(ingredientKey(s)) && !eigenKeys.has(ingredientKey(s)))
    if (volgende) setRij([...rij, volgende])
  }

  const zoek = tekst.trim().toLowerCase()
  const treffers = zoek.length < 2 ? [] : VOORRAAD_SUGGESTIES
    .filter((s) => s.toLowerCase().includes(zoek) && !gekozenKeys.has(ingredientKey(s)))
    .slice(0, 5)

  function voegToe(naam: string) {
    if (!naam) return
    onZet(naam, true)
    setTekst('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form
        onSubmit={(e) => { e.preventDefault(); voegToe(voorraadNaam(tekst)) }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          placeholder="Of typ zelf iets, zoals miso"
          aria-label="Zelf een product toevoegen"
          enterKeyHint="done"
          autoCapitalize="sentences"
          style={{
            flex: 1, minWidth: 0, height: 48, boxSizing: 'border-box', padding: '0 16px',
            border: '1.5px solid rgba(20,20,20,0.14)', borderRadius: 14, outline: 'none',
            // 16 px of groter: anders zoomt iOS in bij focus.
            background: 'var(--c-paper)', fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--c-ink)',
          }}
        />
        <button
          type="submit"
          disabled={!tekst.trim()}
          style={{
            flex: 'none', height: 48, padding: '0 18px', border: 'none', borderRadius: 14,
            background: 'var(--c-red)', color: 'var(--c-cream)', cursor: tekst.trim() ? 'pointer' : 'not-allowed',
            opacity: tekst.trim() ? 1 : 0.45, fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
          }}
        >Voeg toe</button>
      </form>

      {treffers.length > 0 && (
        <div style={rijStijl} aria-label="Bedoel je">
          {treffers.map((n) => <Chip key={n} groot onClick={() => voegToe(n)}>+ {n}</Chip>)}
        </div>
      )}

      <div style={rijStijl}>
        {eigen.map((n) => (
          <Chip key={n} groot selected={gekozenKeys.has(ingredientKey(n))} onClick={() => zet(n, !gekozenKeys.has(ingredientKey(n)), false)}>{n}</Chip>
        ))}
        {rij.map((n) => (
          <Chip key={n} groot selected={gekozenKeys.has(ingredientKey(n))} onClick={() => zet(n, !gekozenKeys.has(ingredientKey(n)), true)}>{n}</Chip>
        ))}
      </div>
    </div>
  )
}
