import { useNavigate } from 'react-router-dom'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Stat, TerugKnop, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useBestellingen } from '../lib/queries2'
import { useVoorkeuren } from '../lib/queries'
import { MAALTIJDBOX, bespaardMet, euro, prijsPerPortie, totaalBespaard } from '../lib/besparing'

const DATUM = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })

/**
 * "Bespaard!": elke bevestigde bestelling naast wat dezelfde maaltijden bij
 * een maaltijdbox hadden gekost. Hoe we rekenen staat onderaan, en in
 * lib/besparing.ts.
 */
export function Bespaard() {
  const navigeer = useNavigate()
  const bestellingen = useBestellingen()
  const voorkeuren = useVoorkeuren()
  const lijst = bestellingen.data ?? []
  const totaal = totaalBespaard(lijst)
  const maaltijden = lijst.reduce((som, b) => som + b.maaltijden, 0)
  const personen = voorkeuren.data?.aantal_personen ?? 4

  return (
    <Scherm>
      <Kop kleur="var(--c-green)" style={{ paddingBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TerugKnop />
          <Label>Bespaard!</Label>
        </div>
        <div style={{ marginTop: 14, color: 'var(--c-yellow)' }}>
          <Titel grootte={lijst.length > 0 ? 56 : 26}>
            {lijst.length > 0 ? euro(totaal) : 'Nog niets bespaard'}
          </Titel>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
          {lijst.length > 0
            ? `Minder uitgegeven dan bij ${MAALTIJDBOX.naam}, over ${lijst.length} ` +
              `${lijst.length === 1 ? 'bestelling' : 'bestellingen'}.`
            : `Wat je bespaart ten opzichte van een maaltijdbox als ${MAALTIJDBOX.naam}.`}
        </p>
      </Kop>

      <Grens query={bestellingen} ladenTekst="Besparingen ophalen">
        {lijst.length === 0 ? (
          <Leeg
            icoon="piggyBank"
            kop="Je eerste besparing komt eraan"
            tekst={'Stuur je boodschappen naar je mandje en bevestig dat ze aankwamen. ' +
              `Dan rekenen we uit wat je bespaarde ten opzichte van ${MAALTIJDBOX.naam}.`}
            knop="Naar mijn lijst"
            onKnop={() => navigeer('/boodschappen')}
          />
        ) : (
          <Inhoud style={{ gap: 20 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Stat getal={String(lijst.length)} label={lijst.length === 1 ? 'bestelling' : 'bestellingen'} />
              <Stat getal={String(maaltijden)} label="maaltijden" />
              <Stat getal={euro(totaal / lijst.length)} label="per bestelling" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Sectiekop>Per bestelling</Sectiekop>
              {lijst.map((b) => {
                const bedrag = bespaardMet(b)
                return (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 2px',
                    borderBottom: '1.5px solid rgba(20,20,20,0.12)',
                  }}>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>
                        {DATUM.format(new Date(b.besteld_op))} · {b.maaltijden}{' '}
                        {b.maaltijden === 1 ? 'maaltijd' : 'maaltijden'} voor {b.personen}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(20,20,20,0.6)' }}>
                        Mandje {euro(b.mandje_kosten, true)} · {MAALTIJDBOX.naam} {euro(b.maaltijdbox_kosten, true)}
                      </span>
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
                      color: bedrag >= 0 ? 'var(--c-green)' : 'var(--c-red)',
                    }}>{bedrag >= 0 ? '+' : '−'}{euro(Math.abs(bedrag))}</span>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
              <Sectiekop>Hoe we rekenen</Sectiekop>
              <Uitleg>
                <b>Je mandje</b> in gewone Jumbo-prijzen, ook als je bij AH bestelt, zonder
                aanbiedingen. We tellen hele verpakkingen, ook als je die niet in één week opmaakt.
                Wat je voorraadkast al heeft en wat je zelf aan je lijst toevoegde, telt niet mee.
              </Uitleg>
              <Uitleg>
                <b>{MAALTIJDBOX.naam}</b>: {euro(prijsPerPortie(personen), true)} per portie
                voor {personen} {personen === 1 ? 'persoon' : 'personen'}, plus{' '}
                {euro(MAALTIJDBOX.bezorging, true)} bezorging per week. Prijzen
                van {MAALTIJDBOX.peildatum}, zonder toeslagen voor premiumgerechten.
              </Uitleg>
              <Uitleg>
                Een recept telt één keer per week, ook als je in twee keer bestelt.
              </Uitleg>
            </div>
          </Inhoud>
        )}
      </Grens>

      <OnderBalk />
    </Scherm>
  )
}

function Sectiekop({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--c-green)', paddingBottom: 6,
    }}>{children}</span>
  )
}

function Uitleg({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0, color: 'rgba(20,20,20,0.75)',
    }}>{children}</p>
  )
}
