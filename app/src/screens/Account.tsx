import { useEffect, useState } from 'react'
import { Button } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, TerugKnop, Titel } from '../components/Layout'
import { huidigeSessie, logUit, verwijderAccount } from '../lib/auth'
import { PRIVACY_URL, SUPPORT_URL } from '../lib/config'
import { foutTekst } from '../lib/fouten'

/**
 * Je account: waarmee je bent ingelogd, de privacyverklaring, en verwijderen.
 * Verwijderen moet in de app zelf kunnen (App Review 5.1.1(v)), en vraagt
 * een tweede tik omdat het niet terug te draaien is.
 */
export function Account() {
  const [email, setEmail] = useState('')
  const [bevestigen, setBevestigen] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  useEffect(() => {
    void huidigeSessie().then((s) => setEmail(s?.email ?? '')).catch(() => undefined)
  }, [])

  async function verwijder() {
    setBezig(true); setFout('')
    try {
      await verwijderAccount()
      window.location.reload()
    } catch (e) {
      setFout(foutTekst(e))
      setBezig(false)
    }
  }

  return (
    <Scherm>
      <Kop style={{ paddingBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TerugKnop />
          <Label>Jouw gegevens</Label>
        </div>
        <div style={{ marginTop: 14 }}><Titel>Account</Titel></div>
        {email && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
            Ingelogd als {email}
          </p>
        )}
      </Kop>

      <Inhoud style={{ gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Sectiekop>Privacy en hulp</Sectiekop>
          <Tekst>
            We bewaren je e-mailadres, je voorkeuren en wat je in de app doet: weekmenu's, je lijst,
            je voorraadkast en je eigen recepten. Geen advertenties, geen volgsoftware.
          </Tekst>
          <Link href={PRIVACY_URL}>Privacyverklaring</Link>
          <Link href={SUPPORT_URL}>Hulp en contact</Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Sectiekop>Uitloggen</Sectiekop>
          <Button
            variant="secondary"
            onClick={() => { void logUit().then(() => window.location.reload()) }}
            style={{ alignSelf: 'flex-start' }}
          >Uitloggen</Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
          <Sectiekop>Account verwijderen</Sectiekop>
          <Tekst>
            Je account en al je gegevens worden direct en definitief gewist: voorkeuren, weekmenu's,
            lijst, voorraadkast, favorieten, bestellingen en je eigen recepten. Recepten die je
            deelde en die zijn goedgekeurd, blijven voor anderen staan, zonder jouw naam eraan.
          </Tekst>

          {fout && (
            <div style={{
              background: 'var(--c-yellow)', color: 'var(--c-ink)', borderRadius: 'var(--radius-sm)',
              padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
            }}>{fout}</div>
          )}

          {bevestigen ? (
            <>
              <Tekst><b>Weet je het zeker?</b> Dit kun je niet terugdraaien.</Tekst>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button disabled={bezig} onClick={() => void verwijder()}>
                  {bezig ? 'Bezig met verwijderen' : 'Ja, verwijder alles'}
                </Button>
                <Button variant="secondary" disabled={bezig} onClick={() => setBevestigen(false)}>Annuleren</Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setBevestigen(true)} style={{ alignSelf: 'flex-start' }}>
              Account verwijderen
            </Button>
          )}
        </div>
      </Inhoud>

      <OnderBalk />
    </Scherm>
  )
}

function Sectiekop({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--c-red)',
    }}>{children}</span>
  )
}

function Tekst({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0, color: 'rgba(20,20,20,0.75)',
    }}>{children}</p>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--c-red)',
        textDecoration: 'underline', textUnderlineOffset: 3,
      }}
    >{children}</a>
  )
}
