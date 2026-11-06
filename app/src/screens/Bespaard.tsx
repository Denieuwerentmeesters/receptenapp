import { useNavigate } from 'react-router-dom'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Stat, TerugKnop, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useBestellingen } from '../lib/queries2'
import { useVoorkeuren } from '../lib/queries'
import { BonusBron } from '../components/Bonus'
import { BEZORGING_MANDJE, MAALTIJDBOX, bespaardMet, euro, prijsPerPortie, totaalBespaard } from '../lib/besparing'
import { t, locale } from '../lib/taal'

const datum = (d: Date) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(d)

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
  // Los van het hoofdgetal: dat rekent bewust in gewone prijzen.
  const bonusTotaal = lijst.reduce((som, b) => som + (b.bonus_voordeel ?? 0), 0)
  const maaltijden = lijst.reduce((som, b) => som + b.maaltijden, 0)
  const personen = voorkeuren.data?.aantal_personen ?? 4

  return (
    <Scherm>
      <Kop kleur="var(--c-green)" style={{ paddingBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TerugKnop />
          <Label>{t('Bespaard!')}</Label>
        </div>
        <div style={{ marginTop: 14, color: 'var(--c-yellow)' }}>
          <Titel grootte={lijst.length > 0 ? 56 : 26}>
            {lijst.length > 0 ? euro(totaal) : t('Nog niets bespaard')}
          </Titel>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
          {lijst.length > 0
            ? (lijst.length === 1
              ? t('Minder uitgegeven dan bij {naam}, over 1 bestelling.', { naam: MAALTIJDBOX.naam })
              : t('Minder uitgegeven dan bij {naam}, over {n} bestellingen.', { naam: MAALTIJDBOX.naam, n: lijst.length }))
            : t('Wat je bespaart ten opzichte van {naam}.', { naam: MAALTIJDBOX.naam })}
        </p>
        {bonusTotaal > 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, lineHeight: 1.5, margin: '6px 0 0', color: 'var(--c-yellow)' }}>
            {t('Plus {bedrag} met de bonus.', { bedrag: euro(bonusTotaal, true) })}
          </p>
        )}
      </Kop>

      <Grens query={bestellingen} ladenTekst={t('Besparingen ophalen')}>
        {lijst.length === 0 ? (
          <Leeg
            icoon="piggyBank"
            kop={t('Je eerste besparing komt eraan')}
            tekst={t('Stuur je boodschappen naar je mandje en bevestig dat ze aankwamen. Dan rekenen we uit wat je bespaarde ten opzichte van {naam}.', { naam: MAALTIJDBOX.naam })}
            knop={t('Naar mijn lijst')}
            onKnop={() => navigeer('/boodschappen')}
          />
        ) : (
          <Inhoud style={{ gap: 20 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Stat getal={String(lijst.length)} label={lijst.length === 1 ? t('bestelling') : t('bestellingen')} />
              <Stat getal={String(maaltijden)} label={t('maaltijden')} />
              <Stat getal={euro(totaal / lijst.length)} label={t('per bestelling')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Sectiekop>{t('Per bestelling')}</Sectiekop>
              {lijst.map((b) => {
                const bedrag = bespaardMet(b)
                return (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 2px',
                    borderBottom: '1.5px solid rgba(43,20,32,0.12)',
                  }}>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>
                        {b.maaltijden === 1
                          ? t('{datum} · 1 maaltijd voor {p}', { datum: datum(new Date(b.besteld_op)), p: b.personen })
                          : t('{datum} · {n} maaltijden voor {p}', { datum: datum(new Date(b.besteld_op)), n: b.maaltijden, p: b.personen })}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(43,20,32,0.6)' }}>
                        {t('Mandje')} {euro(b.mandje_kosten, true)} · {t('Maaltijdbox')} {euro(b.maaltijdbox_kosten, true)}
                        {b.bonus_voordeel > 0 && ` · ${t('bonus')} ${euro(b.bonus_voordeel, true)}`}
                      </span>
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18,
                      color: bedrag >= 0 ? 'var(--c-green)' : 'var(--c-ink-500)',
                    }}>{bedrag >= 0 ? '+' : '−'}{euro(Math.abs(bedrag))}</span>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
              <Sectiekop>{t('Hoe we rekenen')}</Sectiekop>
              <Uitleg>
                <b>{t('Je mandje')}</b>{' '}
                {t('in gewone Jumbo-prijzen, ook als je bij AH bestelt, zonder aanbiedingen, plus {bezorging} bezorging. We tellen hele verpakkingen, ook als je die niet in één week opmaakt. Wat je voorraadkast al heeft en wat je zelf aan je lijst toevoegde, telt niet mee.', { bezorging: euro(BEZORGING_MANDJE) })}
              </Uitleg>
              <Uitleg>
                <b>{t('Maaltijdbox')}</b>:{' '}
                {personen === 1
                  ? t('{prijs} per portie voor 1 persoon, plus {bezorging} bezorging per week. Prijzen van {datum}, zonder toeslagen voor premiumgerechten.', {
                    prijs: euro(prijsPerPortie(personen), true), bezorging: euro(MAALTIJDBOX.bezorging, true), datum: MAALTIJDBOX.peildatum,
                  })
                  : t('{prijs} per portie voor {p} personen, plus {bezorging} bezorging per week. Prijzen van {datum}, zonder toeslagen voor premiumgerechten.', {
                    prijs: euro(prijsPerPortie(personen), true), p: personen, bezorging: euro(MAALTIJDBOX.bezorging, true), datum: MAALTIJDBOX.peildatum,
                  })}
              </Uitleg>
              <Uitleg>
                {t('Een recept telt één keer per week, ook als je in twee keer bestelt.')}
              </Uitleg>
              <Uitleg>
                <b>{t('De bonus')}</b>{' '}
                {t('staat er los onder, niet in het grote getal. Die telt alleen als het product in je mandje zelf in de actie zat, en je genoeg stuks kocht: bij 1 + 1 gratis twee. We rekenen met de actie op je bezorgdag.')}{' '}
                <BonusBron klein />
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
      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0, color: 'rgba(43,20,32,0.75)',
    }}>{children}</p>
  )
}
