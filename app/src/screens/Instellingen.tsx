import { Inhoud, Kop, Label, OnderBalk, Scherm, TerugKnop, Titel } from '../components/Layout'
import { Grens } from '../components/Staten'
import { useVoorkeuren, useVoorkeurenOpslaan } from '../lib/queries'
import type { Voorkeuren } from '../lib/database.types'
import { BONUS_BRON } from '../lib/bonus'
import { BonusBron } from '../components/Bonus'
import { Chip } from '../ds'
import { ALLERGENEN } from '../lib/allergenen'
import { HuishoudenBlok } from '../components/Huishouden'

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

export function Instellingen() {
  const voorkeuren = useVoorkeuren()
  const opslaan = useVoorkeurenOpslaan()
  const zet = (wijziging: Partial<Voorkeuren>) => opslaan.mutate(wijziging)

  return (
    <Scherm>
      <Grens query={voorkeuren} ladenTekst="Instellingen ophalen">
        {voorkeuren.data && (() => {
          const v = voorkeuren.data
          return (
            <>
              <Kop kleur="var(--c-green)" style={{ padding: 'calc(env(safe-area-inset-top) + 20px) 22px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TerugKnop />
                  <Label>Jouw voorkeuren</Label>
                </div>
                <div style={{ marginTop: 14 }}><Titel grootte={26}>Instellingen</Titel></div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
                  Wijzigingen gelden vanaf je volgende weekmenu.
                </p>
              </Kop>

              <Inhoud style={{ gap: 20, padding: '18px 22px 8px' }}>
                <Sectie naam="Weekmenu">
                  <Stapper
                    label="Personen" sub="Alle hoeveelheden schalen mee"
                    waarde={v.aantal_personen} min={1} max={12}
                    onWijzig={(n) => zet({ aantal_personen: n })}
                  />
                  <Stapper
                    label="Kookavonden" sub="Zoveel recepten zet Vul mijn week op je lijst"
                    waarde={v.kookavonden ?? 4} min={1} max={7}
                    onWijzig={(n) => zet({ kookavonden: n })}
                  />
                  <Stapper
                    label="Vega-minimum" sub="Van de 10 recepten per week"
                    waarde={v.vega_minimum} min={0} max={10}
                    onWijzig={(n) => zet({ vega_minimum: n })}
                  />
                  <Stapper
                    label="Max bereidingstijd" sub="Langere recepten laten we weg"
                    waarde={v.max_bereidingstijd ?? 0} min={0} max={180} stap={15}
                    // 0 betekent hier "geen limiet" — dat leest prettiger dan een
                    // aparte schakelaar naast de stapper.
                    weergave={v.max_bereidingstijd ? `${v.max_bereidingstijd} min` : 'geen limiet'}
                    onWijzig={(n) => zet({ max_bereidingstijd: n === 0 ? null : n })}
                  />
                </Sectie>

                <Sectie naam="Allergieën">
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.45,
                    color: 'rgba(20,20,20,0.6)', margin: '0 0 10px',
                  }}>
                    Recepten waar het in zit laten we weg. Gluten en koemelk vervangen we waar het
                    kan, dan krijg je op je lijst bijvoorbeeld glutenvrije pasta of havermelk. Staat
                    er een product in waarvan alleen het etiket het zeker weet, dan zeggen we dat erbij.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 14 }}>
                    {ALLERGENEN.map((a) => {
                      const mijn = v.allergieen ?? []
                      const aan = mijn.includes(a.id)
                      return (
                        <Chip
                          key={a.id}
                          selected={aan}
                          onClick={() => zet({ allergieen: aan ? mijn.filter((x) => x !== a.id) : [...mijn, a.id] })}
                        >{a.label}</Chip>
                      )
                    })}
                  </div>
                </Sectie>

                <Sectie naam="Boodschappen">
                  <Rij label="Winkel" sub="Waar je mandje heen gaat">
                    <Keuze
                      opties={[['ah', 'AH'], ['jumbo', 'Jumbo']]}
                      waarde={v.voorkeurswinkel}
                      onWijzig={(w) => zet({ voorkeurswinkel: w })}
                    />
                  </Rij>
                  <Rij label="Biologisch waar mogelijk" sub="Anders de standaardversie">
                    <Schakelaar
                      aan={v.biologisch_voorkeur}
                      onWijzig={() => zet({ biologisch_voorkeur: !v.biologisch_voorkeur })}
                    />
                  </Rij>
                  <Rij label="Zelf halen in de winkel" sub="Dan telt de bonus van vandaag, niet die van de bezorgdag">
                    <Schakelaar
                      aan={v.zelf_halen ?? false}
                      onWijzig={() => zet({ zelf_halen: !v.zelf_halen })}
                    />
                  </Rij>
                  <Rij label="Huismerk als het kan" sub="Anders het merk dat we standaard kiezen">
                    <Schakelaar
                      aan={v.huismerk_voorkeur}
                      onWijzig={() => zet({ huismerk_voorkeur: !v.huismerk_voorkeur })}
                    />
                  </Rij>
                </Sectie>

                <Sectie naam="Meldingen">
                  <Rij label="Weekmenu-melding" sub={`${DAGEN[v.pushbericht_dag]} om ${v.pushbericht_tijd.slice(0, 5)}`}>
                    <Schakelaar
                      aan={v.pushbericht_aan}
                      onWijzig={() => zet({ pushbericht_aan: !v.pushbericht_aan })}
                    />
                  </Rij>
                  <Rij label="Dag" sub="Wanneer je de melding krijgt">
                    <select
                      value={v.pushbericht_dag}
                      onChange={(e) => zet({ pushbericht_dag: Number(e.target.value) })}
                      style={selectStijl}
                    >
                      {DAGEN.map((dag, i) => <option key={dag} value={i}>{dag}</option>)}
                    </select>
                  </Rij>
                  <Rij label="Tijd" sub="Hoe laat de melding komt">
                    <input
                      type="time"
                      value={v.pushbericht_tijd.slice(0, 5)}
                      onChange={(e) => zet({ pushbericht_tijd: `${e.target.value}:00` })}
                      style={selectStijl}
                    />
                  </Rij>
                </Sectie>

                <Sectie naam="Huishouden">
                  <HuishoudenBlok />
                </Sectie>

                <Sectie naam="Over de app">
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '0 0 6px' }}>
                    {BONUS_BRON.uitleg}
                  </p>
                  <BonusBron />
                </Sectie>
              </Inhoud>
            </>
          )
        })()}
      </Grens>

      <OnderBalk />
    </Scherm>
  )
}

const selectStijl: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--c-red)',
  background: 'transparent', border: 'none', textAlign: 'right',
}

function Sectie({ naam, children }: { naam: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
        textTransform: 'uppercase', color: 'var(--c-green)', paddingBottom: 6,
      }}>{naam}</span>
      {children}
    </div>
  )
}

function Rij({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 2px',
      borderBottom: '1.5px solid rgba(20,20,20,0.12)',
    }}>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, color: 'rgba(20,20,20,0.6)' }}>
          {sub}
        </span>
      </span>
      {children}
    </div>
  )
}

function Schakelaar({ aan, onWijzig }: { aan: boolean; onWijzig: () => void }) {
  return (
    <button
      onClick={onWijzig}
      role="switch"
      aria-checked={aan}
      style={{
        width: 52, height: 30, border: 'none', borderRadius: 'var(--radius-full)', flex: 'none',
        display: 'flex', alignItems: 'center', padding: 3, cursor: 'pointer',
        justifyContent: aan ? 'flex-end' : 'flex-start',
        background: aan ? 'var(--c-red)' : 'rgba(20,20,20,0.18)',
        transition: 'background var(--motion-fast) var(--ease)',
      }}
    >
      <span style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--c-paper)' }} />
    </button>
  )
}

function Keuze<W extends string>({ opties, waarde, onWijzig }: {
  opties: [W, string][]
  waarde: W
  onWijzig: (w: W) => void
}) {
  return (
    <div role="radiogroup" style={{
      display: 'flex', flex: 'none', padding: 3, gap: 2,
      borderRadius: 'var(--radius-full)', background: 'rgba(20,20,20,0.08)',
    }}>
      {opties.map(([w, label]) => {
        const gekozen = w === waarde
        return (
          <button
            key={w}
            role="radio"
            aria-checked={gekozen}
            onClick={() => { if (!gekozen) onWijzig(w) }}
            style={{
              border: 'none', borderRadius: 'var(--radius-full)', padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
              background: gekozen ? 'var(--c-red)' : 'transparent',
              color: gekozen ? 'var(--c-cream)' : 'rgba(20,20,20,0.6)',
              transition: 'background var(--motion-fast) var(--ease)',
            }}
          >{label}</button>
        )
      })}
    </div>
  )
}

function Stapper({ label, sub, waarde, min, max, stap = 1, weergave, onWijzig }: {
  label: string
  sub: string
  waarde: number
  min: number
  max: number
  stap?: number
  weergave?: string
  onWijzig: (n: number) => void
}) {
  const knop = (teken: string, nieuw: number, uit: boolean, omschrijving: string) => (
    <button
      onClick={() => onWijzig(nieuw)}
      disabled={uit}
      aria-label={omschrijving}
      style={{
        width: 32, height: 32, borderRadius: 'var(--radius-full)',
        border: '1.5px solid rgba(20,20,20,0.2)', background: 'transparent',
        cursor: uit ? 'not-allowed' : 'pointer', opacity: uit ? 0.35 : 1,
        fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, lineHeight: 1,
      }}
    >{teken}</button>
  )

  return (
    <Rij label={label} sub={sub}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {knop('−', Math.max(min, waarde - stap), waarde <= min, `${label} verlagen`)}
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--c-red)',
          minWidth: 78, textAlign: 'center',
        }}>{weergave ?? waarde}</span>
        {knop('+', Math.min(max, waarde + stap), waarde >= max, `${label} verhogen`)}
      </div>
    </Rij>
  )
}
