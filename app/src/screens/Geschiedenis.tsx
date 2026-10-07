import { useNavigate } from 'react-router-dom'
import { Inhoud, Kop, Label, Scherm, TerugKnop, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useGeschiedenis } from '../lib/queries2'
import { weekLabel } from '../lib/week'
import { useActieveWeek } from '../lib/queries'

export function Geschiedenis() {
  const navigeer = useNavigate()
  const geschiedenis = useGeschiedenis()
  const weken = geschiedenis.data ?? []
  const dezeWeek = useActieveWeek()

  return (
    <Scherm>
      <Grens query={geschiedenis} ladenTekst="Geschiedenis ophalen">
        <Kop kleur="var(--c-gold)" tekstKleur="var(--c-ink)" style={{ paddingBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TerugKnop donker />
            <Label kleur="var(--c-green)">Wat je kookte</Label>
          </div>
          <div style={{ marginTop: 14 }}><Titel grootte={26}>Geschiedenis</Titel></div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
            Tik een gerecht aan om het opnieuw te bekijken.
          </p>
        </Kop>

        {weken.length === 0 ? (
          <Leeg
            icoon="clock"
            kop="Nog niets gekookt"
            tekst="Zodra je recepten kiest en kookt, bouwt zich hier je geschiedenis op."
            knop="Naar mijn weekmenu"
            onKnop={() => navigeer('/deze-week')}
          />
        ) : (
          <Inhoud style={{ gap: 20 }}>
            {weken.map((wk) => {
              const gekookt = wk.gekozen.filter((g) => g.gekooktOp).length
              return (
                <div key={wk.week} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                      textTransform: 'uppercase', color: 'var(--c-red)',
                    }}>
                      {wk.week === dezeWeek ? 'Deze week' : `Week van ${weekLabel(wk.week)}`}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'rgba(20,20,20,0.6)' }}>
                      {gekookt} van {wk.gekozen.length} gekookt
                    </span>
                  </div>

                  {wk.gekozen.map(({ recept, gekooktOp }) => (
                    <button
                      key={recept.id}
                      onClick={() => navigeer(`/recept/${recept.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none',
                        borderBottom: '1.5px solid rgba(20,20,20,0.12)', padding: '13px 2px', cursor: 'pointer',
                      }}
                    >
                      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>
                          {recept.titel_nl ?? recept.titel}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(20,20,20,0.6)' }}>
                          {recept.bereidingstijd_minuten ?? '?'} min
                          {recept.keuken ? ` · ${recept.keuken}` : ''}
                        </span>
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                        color: gekooktOp ? 'rgba(20,20,20,0.45)' : 'var(--c-red)',
                      }}>{gekooktOp ? 'gekookt' : 'niet gekookt'}</span>
                    </button>
                  ))}
                </div>
              )
            })}
          </Inhoud>
        )}
      </Grens>
    </Scherm>
  )
}
