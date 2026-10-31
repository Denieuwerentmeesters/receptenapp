import { useState } from 'react'
import { Button, Woordmerk } from '../ds'
import { Titel } from '../components/Layout'
import { heeftAccountOpToestel, logIn, maakAccount, resetWachtwoord, vraagWachtwoordResetAan } from '../lib/auth'
import { PRIVACY_URL, VOORWAARDEN_URL } from '../lib/config'
import { foutTekst } from '../lib/fouten'

/**
 * Eén keer per toestel. E-mailadres en wachtwoord, en een schakelaar tussen
 * inloggen en een account aanmaken — expliciet, want automatisch een account
 * aanmaken bij een onbekend e-mailadres levert bij een typefout een spookaccount op.
 */
type Modus = 'inloggen' | 'nieuw' | 'vergeten' | 'verstuurd' | 'reset'

/** Het token uit de herstellink: ?token=… vóór of achter de #. */
function tokenUitLink(): string {
  const uit = (q: string) => new URLSearchParams(q).get('token') ?? ''
  return uit(window.location.search) || uit(window.location.hash.split('?')[1] ?? '')
}

export function Inloggen({ onKlaar }: { onKlaar: () => void }) {
  const [token, setToken] = useState(tokenUitLink)
  // Eerste keer op dit toestel: Account aanmaken voorop, Inloggen klein onderin.
  const [eerste] = useState(() => !heeftAccountOpToestel())
  const [modus, setModus] = useState<Modus>(token ? 'reset' : eerste ? 'nieuw' : 'inloggen')
  const nieuw = modus === 'nieuw'
  const metWachtwoord = modus === 'inloggen' || modus === 'nieuw' || modus === 'reset'
  const kiesNieuw = nieuw || modus === 'reset'
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  const teKort = kiesNieuw && wachtwoord.length > 0 && wachtwoord.length < 8

  async function verstuur(e: React.FormEvent) {
    e.preventDefault()
    setBezig(true); setFout('')
    try {
      if (modus === 'vergeten') {
        await vraagWachtwoordResetAan(email)
        setModus('verstuurd')
      } else if (modus === 'reset') {
        await resetWachtwoord(token, wachtwoord)
        // Token weg uit de adresbalk, anders staat het er bij de volgende start nog.
        window.history.replaceState(null, '', window.location.pathname)
        setToken(''); setWachtwoord(''); setModus('inloggen')
        setFout('Gelukt! Log in met je nieuwe wachtwoord.')
      } else {
        await (nieuw ? maakAccount(email, wachtwoord) : logIn(email, wachtwoord))
        onKlaar()
      }
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
      <Woordmerk hoogte={40} style={{ margin: 'calc(env(safe-area-inset-top) + 20px) 26px 0' }} />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 12, padding: '28px 26px 0',
      }}>

        {/* 'Thuisbezorging' past op 32 niet op één regel. */}
        <Titel grootte={modus === 'inloggen' ? 27 : 32}>{
          nieuw ? 'Maak een account'
            : modus === 'vergeten' ? 'Wachtwoord vergeten'
            : modus === 'verstuurd' ? 'Check je mail'
            : modus === 'reset' ? 'Nieuw wachtwoord'
            : 'Van recept tot thuisbezorging'
        }</Titel>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, margin: 0, maxWidth: 300 }}>
          {nieuw
            ? 'Kies een wachtwoord van minstens 8 tekens. Daarna hoef je hier nooit meer te zijn op dit toestel.'
            : modus === 'vergeten' ? 'Vul je e-mailadres in, dan sturen we je een link om een nieuw wachtwoord te kiezen.'
            : modus === 'verstuurd' ? `Staat er een account bij ${email.trim()}, dan ligt er een mail met een link. Die is een uur geldig. Kijk ook in je spam.`
            : modus === 'reset' ? 'Kies een wachtwoord van minstens 8 tekens.'
            : 'Veelzijdiger, goedkoper, lekkerder'}
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
        {modus !== 'reset' && modus !== 'verstuurd' && (
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
        )}
        {metWachtwoord && (
          <input
            type="password"
            autoComplete={kiesNieuw ? 'new-password' : 'current-password'}
            required
            minLength={kiesNieuw ? 8 : undefined}
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            placeholder={modus === 'reset' ? 'Nieuw wachtwoord' : 'Wachtwoord'}
            style={veldStijl}
          />
        )}

        {teKort && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, opacity: 0.85 }}>
            Nog {8 - wachtwoord.length} tekens te gaan.
          </span>
        )}

        {modus !== 'verstuurd' && (
          <Button
            type="submit"
            tone="yellow"
            disabled={bezig || teKort}
            style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
          >
            {bezig ? 'Even geduld'
              : nieuw ? 'Account aanmaken'
              : modus === 'vergeten' ? 'Stuur me een link'
              : modus === 'reset' ? 'Wachtwoord opslaan'
              : 'Inloggen'}
          </Button>
        )}

        {modus === 'inloggen' && (
          <button type="button" onClick={() => { setModus('vergeten'); setFout('') }} style={tekstKnop}>
            Wachtwoord vergeten?
          </button>
        )}

        <button
          type="button"
          onClick={() => { setModus(nieuw ? 'inloggen' : modus === 'inloggen' ? 'nieuw' : 'inloggen'); setFout('') }}
          style={eerste && nieuw ? kleineTekstKnop : tekstKnop}
        >
          {modus === 'inloggen' ? 'Nog geen account? Maak er een'
            : modus === 'reset' ? 'Terug naar inloggen'
            : modus === 'nieuw' ? (eerste ? 'Heb je al een account? Inloggen' : 'Ik heb al een account')
            : 'Terug naar inloggen'}
        </button>

        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5, margin: 0,
          textAlign: 'center', opacity: 0.85,
        }}>
          Met een account ga je akkoord met de{' '}
          <a href={VOORWAARDEN_URL} target="_blank" rel="noopener noreferrer" style={linkStijl}>voorwaarden</a>
          {' '}en het{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={linkStijl}>privacybeleid</a>.
        </p>
      </form>
    </div>
  )
}

const tekstKnop: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--c-cream)',
  background: 'transparent', border: 'none', padding: 12, cursor: 'pointer',
}

const kleineTekstKnop: React.CSSProperties = {
  ...tekstKnop, fontSize: 13, fontWeight: 500, opacity: 0.85,
  textDecoration: 'underline', textUnderlineOffset: 3,
}

const linkStijl: React.CSSProperties = {
  color: 'var(--c-cream)', textDecoration: 'underline', textUnderlineOffset: 3,
}

const veldStijl: React.CSSProperties = {
  width: '100%', background: 'var(--c-paper)', border: 'none',
  borderRadius: 'var(--radius-sm)', padding: '16px 18px',
  fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--color-ink)',
  outline: 'none',
}
