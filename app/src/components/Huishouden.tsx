import { useState } from 'react'
import { Button } from '../ds'
import { Dialoog } from './Dialoog'
import { useHuishouden, useHuishoudenActies } from '../lib/huishouden'
import { foutTekst } from '../lib/fouten'

/**
 * Instellingen → Huishouden: je lijst delen met je huisgenoot.
 *
 * Een huishouden is de lijst van de eigenaar. Wie de code invult, ziet en
 * bewerkt vanaf dan diezelfde week, boodschappenlijst en voorraadkast. Je
 * eigen lijst blijft bewaard en is terug als je het huishouden verlaat.
 */
export function HuishoudenBlok() {
  const huishouden = useHuishouden()
  const { maakUitnodiging, bekijkCode, wordLid, verlaat } = useHuishoudenActies()
  const [code, setCode] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bevestig, setBevestig] = useState<{ code: string; id: string; email: string | null } | null>(null)
  const [verwijder, setVerwijder] = useState<{ id: string; email: string | null } | 'zelf' | null>(null)

  const h = huishouden.data
  if (!h) return <Tekst>Huishouden ophalen…</Tekst>

  async function controleer() {
    setFout(null)
    const schoon = code.replace(/\s/g, '').toUpperCase()
    if (!/^[A-Z0-9]{8}$/.test(schoon)) { setFout('Een code heeft 8 letters en cijfers.'); return }
    try {
      const eigenaar = await bekijkCode(schoon)
      if (!eigenaar) { setFout('Deze code bestaat niet of is verlopen. Vraag een nieuwe.'); return }
      setBevestig({ code: schoon, ...eigenaar })
    } catch (e) {
      setFout(foutTekst(e))
    }
  }

  // Lid bij iemand anders.
  if (h.eigenaar) {
    return (
      <>
        <Tekst>Je deelt de week en boodschappenlijst van <b>{h.eigenaar.email ?? 'je huisgenoot'}</b>. Favorieten en eigen recepten blijven van jezelf.</Tekst>
        <Button variant="secondary" onClick={() => setVerwijder('zelf')} style={{ alignSelf: 'flex-start' }}>Huishouden verlaten</Button>
        <Dialoog
          open={verwijder === 'zelf'}
          kop="Huishouden verlaten?"
          tekst="Je ziet dan weer je eigen week en boodschappenlijst, zoals je die had voordat je ging delen."
          onSluit={() => setVerwijder(null)}
          acties={[
            { label: 'Ja, verlaten', hoofd: true, onClick: () => { verlaat.mutate(undefined); setVerwijder(null) } },
            { label: 'Laat maar', onClick: () => setVerwijder(null) },
          ]}
        />
      </>
    )
  }

  return (
    <>
      {h.leden.length > 0 ? (
        <>
          <Tekst>Je deelt je week en boodschappenlijst met:</Tekst>
          {h.leden.map((lid) => (
            <div key={lid.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 15 }}>{lid.email ?? 'Huisgenoot'}</span>
              <button onClick={() => setVerwijder(lid)} style={linkKnop}>verwijderen</button>
            </div>
          ))}
        </>
      ) : (
        <Tekst>Deel je week en boodschappenlijst met je huisgenoot. Samen afvinken in de winkel, samen het mandje vullen.</Tekst>
      )}

      {h.uitnodiging ? (
        <div style={{ background: 'var(--c-paper)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(20,20,20,0.6)' }}>Geef deze code aan je huisgenoot</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, letterSpacing: '.12em', userSelect: 'all' }}>{h.uitnodiging.code}</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(20,20,20,0.6)' }}>
            Geldig t/m {new Date(h.uitnodiging.verloopt_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}. Je huisgenoot vult hem in bij Instellingen → Huishouden.
          </span>
        </div>
      ) : (
        <Button onClick={() => maakUitnodiging.mutate()} disabled={maakUitnodiging.isPending} style={{ alignSelf: 'flex-start' }}>
          {maakUitnodiging.isPending ? 'Code maken…' : 'Deel je lijst'}
        </Button>
      )}

      {h.leden.length === 0 && (
        <form onSubmit={(e) => { e.preventDefault(); void controleer() }} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <label htmlFor="huishouden-code" style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700 }}>Kreeg je een code?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="huishouden-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD2345"
              autoCapitalize="characters"
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0, background: 'var(--c-paper)', border: '1.5px solid rgba(20,20,20,0.14)',
                borderRadius: 14, padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: 16, letterSpacing: '.08em',
              }}
            />
            <Button type="submit" variant="secondary">Invullen</Button>
          </div>
          {fout && <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-red)' }}>{fout}</span>}
        </form>
      )}

      <Dialoog
        open={Boolean(bevestig)}
        kop="Samen één lijst?"
        tekst={bevestig
          ? `Je ziet dan de week en boodschappenlijst van ${bevestig.email ?? 'je huisgenoot'}, en jullie vullen die samen. Je eigen lijst blijft bewaard: verlaat je het huishouden, dan is die terug.`
          : undefined}
        onSluit={() => setBevestig(null)}
        acties={[
          {
            label: 'Ja, samen', hoofd: true,
            onClick: () => {
              if (bevestig) wordLid.mutate({ code: bevestig.code, eigenaarId: bevestig.id, eigenaarEmail: bevestig.email }, { onError: (e) => setFout(foutTekst(e)) })
              setBevestig(null); setCode('')
            },
          },
          { label: 'Laat maar', onClick: () => setBevestig(null) },
        ]}
      />
      <Dialoog
        open={Boolean(verwijder && verwijder !== 'zelf')}
        kop="Uit je huishouden halen?"
        tekst={verwijder && verwijder !== 'zelf' ? `${verwijder.email ?? 'Je huisgenoot'} ziet dan weer de eigen week en lijst van vóór het delen.` : undefined}
        onSluit={() => setVerwijder(null)}
        acties={[
          { label: 'Ja, verwijderen', hoofd: true, onClick: () => { if (verwijder && verwijder !== 'zelf') verlaat.mutate(verwijder.id); setVerwijder(null) } },
          { label: 'Laat maar', onClick: () => setVerwijder(null) },
        ]}
      />
    </>
  )
}

function Tekst({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '0 0 6px' }}>{children}</p>
}

const linkKnop: React.CSSProperties = {
  border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--c-red)',
  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, textDecoration: 'underline',
}
