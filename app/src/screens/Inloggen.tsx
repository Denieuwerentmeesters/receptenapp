import { useState } from 'react'
import { Button } from '../ds'
import { Titel } from '../components/Layout'
import { logIn, maakAccount } from '../lib/auth'
import { foutTekst } from '../lib/fouten'

/**
 * Eén keer per toestel. E-mailadres en wachtwoord, en een schakelaar tussen
 * inloggen en een account aanmaken — expliciet, want automatisch een account
 * aanmaken bij een onbekend e-mailadres levert bij een typefout een spookaccount op.
 */
export function Inloggen({ onKlaar }: { onKlaar: () => void }) {
  const [nieuw, setNieuw] = useState(false)
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  const teKort = nieuw && wachtwoord.length > 0 && wachtwoord.length < 8

  async function verstuur(e: React.FormEvent) {
    e.preventDefault()
    setBezig(true); setFout('')
    try {
      await (nieuw ? maakAccount(email, wachtwoord) : logIn(email, wachtwoord))
      onKlaar()
    } catch (f) {
      setFout(foutTekst(f))
    } finally {
      setBezig(false)
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'var(--c-red)', color: 'var(--c-cream)', overflowY: 'auto',
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 12, padding: '60px 26px 0',
      }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
          letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--c-yellow)',
        }}>Receptenapp</div>

        <Titel grootte={32}>{nieuw ? 'Maak een account' : 'Wat eet je deze week?'}</Titel>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, margin: 0, maxWidth: 300 }}>
          {nieuw
            ? 'Kies een wachtwoord van minstens 8 tekens. Daarna hoef je hier nooit meer te zijn op dit toestel.'
            : 'Log één keer in, dan onthoudt de app je op dit toestel.'}
        </p>

        {fout && (
          <div style={{
            background: 'var(--c-yellow)', color: 'var(--c-ink)', borderRadius: 'var(--radius-sm)',
            padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
          }}>{fout}</div>
        )}
      </div>

      <form
        onSubmit={verstuur}
        style={{ flex: 'none', padding: '22px 26px 44px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jouw@email.nl"
          style={veldStijl}
        />
        <input
          type="password"
          autoComplete={nieuw ? 'new-password' : 'current-password'}
          required
          minLength={nieuw ? 8 : undefined}
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
          placeholder="Wachtwoord"
          style={veldStijl}
        />

        {teKort && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, opacity: 0.85 }}>
            Nog {8 - wachtwoord.length} tekens te gaan.
          </span>
        )}

        <Button
          type="submit"
          tone="yellow"
          disabled={bezig || teKort}
          style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
        >
          {bezig ? 'Even geduld' : nieuw ? 'Account aanmaken' : 'Inloggen'}
        </Button>

        <button
          type="button"
          onClick={() => { setNieuw(!nieuw); setFout('') }}
          style={{
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--c-cream)',
            background: 'transparent', border: 'none', padding: 12, cursor: 'pointer',
          }}
        >
          {nieuw ? 'Ik heb al een account' : 'Nog geen account? Maak er een'}
        </button>
      </form>
    </div>
  )
}

const veldStijl: React.CSSProperties = {
  width: '100%', background: 'var(--c-paper)', border: 'none',
  borderRadius: 'var(--radius-sm)', padding: '16px 18px',
  fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--color-ink)',
  outline: 'none',
}
