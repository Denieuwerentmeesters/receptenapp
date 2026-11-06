import { useNavigate } from 'react-router-dom'
import { Inhoud, Kop, Label, OnderBalk, Scherm, TerugKnop, Titel } from '../components/Layout'
import { Grens } from '../components/Staten'
import { useVoorkeuren, useVoorkeurenOpslaan } from '../lib/queries'
import type { Voorkeuren } from '../lib/database.types'
import { BONUS_BRON } from '../lib/bonus'
import { BonusBron } from '../components/Bonus'
import { AllergieKeuze, KeukenKeuze } from '../components/voorkeuren'
import { HuishoudenBlok } from '../components/Huishouden'
import { useKeukens } from '../lib/queries2'
import { TaalKeuze } from '../components/TaalKeuze'
import { t } from '../lib/taal'
import { vegaDoel, vegaMinimumVoor } from '../lib/weekvullen'

const dagen = () => [t('zondag'), t('maandag'), t('dinsdag'), t('woensdag'), t('donderdag'), t('vrijdag'), t('zaterdag')]

export function Instellingen() {
  const voorkeuren = useVoorkeuren()
  const opslaan = useVoorkeurenOpslaan()
  const zet = (wijziging: Partial<Voorkeuren>) => opslaan.mutate(wijziging)
  const keukens = useKeukens()
  const navigeer = useNavigate()
  const DAGEN = dagen()

  return (
    <Scherm>
      <Grens query={voorkeuren} ladenTekst={t('Instellingen ophalen')}>
        {voorkeuren.data && (() => {
          const v = voorkeuren.data
          const avonden = v.kookavonden ?? 4
          return (
            <>
              <Kop kleur="var(--c-green)" style={{ padding: 'calc(env(safe-area-inset-top) + 20px) 22px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TerugKnop />
                  <Label>{t('Jouw voorkeuren')}</Label>
                </div>
                <div style={{ marginTop: 14 }}><Titel grootte={26}>{t('Instellingen')}</Titel></div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
                  {t('Wijzigingen gelden vanaf je volgende weekmenu.')}
                </p>
              </Kop>

              <Inhoud style={{ gap: 20, padding: '18px 22px 8px' }}>
                <Sectie naam={t('Weekmenu')}>
                  <Stapper
                    label={t('Personen')} sub={t('Alle hoeveelheden schalen mee')}
                    waarde={v.aantal_personen} min={1} max={12}
                    onWijzig={(n) => zet({ aantal_personen: n })}
                  />
                  {/* Een richtlijn voor Vul mijn week, geen grens: je bestelt zoveel als je wilt. */}
                  <Stapper
                    label={t('Hoe vaak kook je?')} sub={t('Meestal, per week. Voor Vul mijn week')}
                    waarde={avonden} min={1} max={7}
                    weergave={avonden === 7 ? t('elke avond') : `${avonden}×`}
                    onWijzig={(n) => zet({ kookavonden: n })}
                  />
                  <Stapper
                    label={t('Hoeveel daarvan vegetarisch?')} sub={avonden === 1 ? t('Van je {n} avond', { n: avonden }) : t('Van je {n} avonden', { n: avonden })}
                    waarde={vegaDoel({ vega_minimum: v.vega_minimum, kookavonden: avonden })} min={0} max={avonden}
                    onWijzig={(n) => zet({ vega_minimum: vegaMinimumVoor(n, avonden) })}
                  />
                  <Stapper
                    label={t('Max bereidingstijd')} sub={t('Langere recepten laten we weg')}
                    waarde={v.max_bereidingstijd ?? 0} min={0} max={180} stap={15}
                    // 0 betekent hier "geen limiet" — dat leest prettiger dan een
                    // aparte schakelaar naast de stapper.
                    weergave={v.max_bereidingstijd ? t('{n} min', { n: v.max_bereidingstijd }) : t('geen limiet')}
                    onWijzig={(n) => zet({ max_bereidingstijd: n === 0 ? null : n })}
                  />
                </Sectie>

                {keukens.data && keukens.data.length > 0 && (
                  <Sectie naam={t('Keukens')}>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.45,
                      color: 'rgba(43,20,32,0.6)', margin: '0 0 10px',
                    }}>
                      {t('Wat je het liefst eet. Deze keukens komen vaker in je weekmenu en staan bovenaan in Ontdekken; de rest komt nog af en toe langs. Tik uit wat je minder graag eet.')}
                    </p>
                    <div style={{ paddingBottom: 14 }}>
                      <KeukenKeuze
                        keukens={keukens.data.map((k) => k.keuken)}
                        gekozen={v.favoriete_keukens ?? []}
                        leegIsAlles
                        onWijzig={(nieuw) => zet({ favoriete_keukens: nieuw })}
                      />
                    </div>
                  </Sectie>
                )}

                <Sectie naam={t('Allergieën')}>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.45,
                    color: 'rgba(43,20,32,0.6)', margin: '0 0 10px',
                  }}>
                    {t('Recepten waar het in zit laten we weg. Gluten en koemelk vervangen we waar het kan, dan krijg je op je lijst bijvoorbeeld glutenvrije pasta of havermelk. Staat er een product in waarvan alleen het etiket het zeker weet, dan zeggen we dat erbij.')}
                  </p>
                  <div style={{ paddingBottom: 14 }}>
                    <AllergieKeuze gekozen={v.allergieen ?? []} onWijzig={(nieuw) => zet({ allergieen: nieuw })} />
                  </div>
                </Sectie>

                <Sectie naam={t('Taal')}>
                  <Rij label={t('Taal')} sub="Nederlands / English">
                    <TaalKeuze />
                  </Rij>
                </Sectie>

                <Sectie naam={t('Boodschappen')}>
                  <Rij label={t('Winkel')} sub={t('Waar je mandje heen gaat')}>
                    <Keuze
                      opties={[['ah', 'AH'], ['jumbo', 'Jumbo']]}
                      waarde={v.voorkeurswinkel}
                      onWijzig={(w) => zet({ voorkeurswinkel: w })}
                    />
                  </Rij>
                  <Rij label={t('Biologisch waar mogelijk')} sub={t('Anders de standaardversie')}>
                    <Schakelaar
                      aan={v.biologisch_voorkeur}
                      onWijzig={() => zet({ biologisch_voorkeur: !v.biologisch_voorkeur })}
                    />
                  </Rij>
                  <Rij label={t('Zelf halen in de winkel')} sub={t('Dan telt de bonus van vandaag, niet die van de bezorgdag')}>
                    <Schakelaar
                      aan={v.zelf_halen ?? false}
                      onWijzig={() => zet({ zelf_halen: !v.zelf_halen })}
                    />
                  </Rij>
                  <Rij label={t('Huismerk als het kan')} sub={t('Anders het merk dat we standaard kiezen')}>
                    <Schakelaar
                      aan={v.huismerk_voorkeur}
                      onWijzig={() => zet({ huismerk_voorkeur: !v.huismerk_voorkeur })}
                    />
                  </Rij>
                </Sectie>

                <Sectie naam={t('Meldingen')}>
                  <Rij label={t('Herinnering om recepten te zoeken')} sub={t('{dag} om {tijd} · alleen in de app op je telefoon', { dag: DAGEN[v.pushbericht_dag], tijd: v.pushbericht_tijd.slice(0, 5) })}>
                    <Schakelaar
                      aan={v.pushbericht_aan}
                      onWijzig={() => zet({ pushbericht_aan: !v.pushbericht_aan })}
                    />
                  </Rij>
                  <Rij label={t('Dag')} sub={t('Wanneer je de melding krijgt')}>
                    <select
                      value={v.pushbericht_dag}
                      onChange={(e) => zet({ pushbericht_dag: Number(e.target.value) })}
                      style={selectStijl}
                    >
                      {DAGEN.map((dag, i) => <option key={i} value={i}>{dag}</option>)}
                    </select>
                  </Rij>
                  <Rij label={t('Tijd')} sub={t('Hoe laat de melding komt')}>
                    <input
                      type="time"
                      value={v.pushbericht_tijd.slice(0, 5)}
                      onChange={(e) => zet({ pushbericht_tijd: `${e.target.value}:00` })}
                      style={selectStijl}
                    />
                  </Rij>
                </Sectie>

                <Sectie naam={t('Huishouden')}>
                  <HuishoudenBlok />
                </Sectie>

                <Sectie naam={t('Over de app')}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '0 0 6px' }}>
                    {t(BONUS_BRON.uitleg)}
                  </p>
                  <BonusBron />
                  <button
                    onClick={() => navigeer('/uitleg')}
                    style={{
                      alignSelf: 'flex-start', marginTop: 12, padding: '10px 0', border: 'none',
                      background: 'transparent', cursor: 'pointer', color: 'var(--c-red)',
                      fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                      textDecoration: 'underline', textUnderlineOffset: 3,
                    }}
                  >{t('Bekijk de uitleg')}</button>
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
      borderBottom: '1.5px solid rgba(43,20,32,0.12)',
    }}>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, color: 'rgba(43,20,32,0.6)' }}>
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
        background: aan ? 'var(--c-red)' : 'rgba(43,20,32,0.18)',
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
      borderRadius: 'var(--radius-full)', background: 'rgba(43,20,32,0.08)',
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
              color: gekozen ? 'var(--c-cream)' : 'rgba(43,20,32,0.6)',
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
        border: '1.5px solid rgba(43,20,32,0.2)', background: 'transparent',
        cursor: uit ? 'not-allowed' : 'pointer', opacity: uit ? 0.35 : 1,
        fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, lineHeight: 1,
      }}
    >{teken}</button>
  )

  return (
    <Rij label={label} sub={sub}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {knop('−', Math.max(min, waarde - stap), waarde <= min, t('{label} verlagen', { label }))}
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--c-red)',
          minWidth: 78, textAlign: 'center',
        }}>{weergave ?? waarde}</span>
        {knop('+', Math.min(max, waarde + stap), waarde >= max, t('{label} verhogen', { label }))}
      </div>
    </Rij>
  )
}
