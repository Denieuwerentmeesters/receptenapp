import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { ReceptRegel } from '../components/ReceptRegel'
import { useMijnWeek } from '../lib/queries2'
import { useBoodschappen } from '../lib/queries'
import { weekStart } from '../lib/week'

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december']

/**
 * Het scherm waar je 's middags op kijkt: wat eet ik vandaag?
 *
 * De keuze voor vandaag leeft alleen in dit scherm — hij hoeft niet bewaard te
 * worden, want morgen is het weer een andere vraag. Wat wél bewaard wordt is
 * dát je iets gekookt hebt (`gekookt_op`), en dat bepaalt de cooldown in de
 * weekmenu-generator.
 */
export function Vandaag() {
  const week = weekStart()
  const navigeer = useNavigate()
  const mijnWeek = useMijnWeek(week)
  const boodschappen = useBoodschappen(week)
  const [vandaag, setVandaag] = useState<string | null>(null)

  const alles = mijnWeek.data ?? []
  const nogTeKoken = alles.filter((r) => !r.gekooktOp)
  const gekozen = alles.find((r) => r.recept.id === vandaag)
  const nogNodig = (boodschappen.data ?? []).filter((i) => !i.is_afgevinkt).length

  const nu = new Date()
  const datum = `${DAGEN[nu.getDay()]} ${nu.getDate()} ${MAANDEN[nu.getMonth()]}`

  return (
    <Scherm>
      <Grens query={mijnWeek} ladenTekst="Je week ophalen">
        <Kop>
          <Label>{datum}</Label>
        </Kop>

        <Kop kleur="var(--c-red-bright)" style={{ padding: '18px 22px 24px' }}>
          {gekozen ? (
            <>
              <Titel grootte={30}>{gekozen.recept.titel_nl ?? gekozen.recept.titel}</Titel>
              <div style={{
                display: 'flex', gap: 16, marginTop: 14,
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              }}>
                <span>{gekozen.recept.bereidingstijd_minuten ?? '?'} min</span>
                <span>{gekozen.recept.ingredienten.length} ingrediënten</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <Button
                  tone="yellow"
                  onClick={() => navigeer(`/koken/${gekozen.recept.id}`)}
                  style={{ flex: 1, height: 50 }}
                >Begin met koken</Button>
                <Button
                  variant="secondary"
                  tone="cream"
                  onClick={() => setVandaag(null)}
                  style={{ flex: 'none', height: 50, color: 'var(--c-cream)', borderColor: 'var(--c-cream)' }}
                >Anders</Button>
              </div>
            </>
          ) : (
            <>
              <Titel grootte={30}>Wat eet je vandaag?</Titel>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
                Kies uit je recepten van deze week. Je hoeft niets vast te leggen.
              </p>
            </>
          )}
        </Kop>

        {alles.length === 0 ? (
          <Leeg
            icoon="utensils"
            kop="Nog niets gekozen"
            tekst="Kies eerst in je weekmenu welke recepten je deze week wil koken."
            knop="Naar mijn weekmenu"
            onKnop={() => navigeer('/weekmenu')}
          />
        ) : (
          <Inhoud style={{ gap: 10, padding: '20px 22px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'rgba(20,20,20,0.6)',
              }}>Jouw recepten deze week</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red-bright)' }}>
                {nogTeKoken.length} nog te koken
              </span>
            </div>

            {alles.map((r, i) => (
              <div
                key={r.recept.id}
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${vandaag === r.recept.id ? 'var(--c-red-bright)' : 'transparent'}`,
                  transition: 'border-color var(--motion-fast) var(--ease)',
                }}
              >
                <ReceptRegel
                  recept={r.recept}
                  index={i}
                  onOpen={() => setVandaag(vandaag === r.recept.id ? null : r.recept.id)}
                  actie={r.gekooktOp ? 'gekookt' : vandaag === r.recept.id ? 'vandaag' : 'kies'}
                  actieKleur={r.gekooktOp ? 'rgba(20,20,20,0.45)' : 'var(--c-red-bright)'}
                />
              </div>
            ))}

            <button
              onClick={() => navigeer('/boodschappen')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, background: 'var(--c-paper)',
                borderRadius: 'var(--radius-md)', padding: '15px 16px', marginTop: 8,
                border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>Boodschappen</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(20,20,20,0.6)' }}>
                  {nogNodig === 0 ? 'alles in huis' : `${nogNodig} producten nog nodig`}
                </span>
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red-bright)' }}>
                naar lijst
              </span>
            </button>
          </Inhoud>
        )}
      </Grens>

      <OnderBalk />
    </Scherm>
  )
}
