import { receptTitel } from '../lib/receptTaal'
import { Button } from '../ds'
import { Inhoud, Kop, Label, Scherm, TerugKnop, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { useAanmeldingen, useBeoordelen } from '../lib/queries2'
import { t } from '../lib/taal'

/**
 * Adminscherm uit plan §7.7: recepten die anderen hebben aangemeld om te delen.
 *
 * Bewust een menselijke controle en geen automatische publicatie. Alleen
 * `eigen_input` kan hier terechtkomen — kookboekrecepten worden door een
 * check-constraint op de tabel tegengehouden, dus die kunnen niet eens
 * aangemeld worden.
 */
export function Beoordelen() {
  const aanmeldingen = useAanmeldingen()
  const beoordelen = useBeoordelen()
  const lijst = aanmeldingen.data ?? []

  return (
    <Scherm>
      <Kop kleur="var(--c-black)" style={{ paddingBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TerugKnop />
          <Label>{t('Alleen voor admins')}</Label>
        </div>
        <div style={{ marginTop: 14 }}><Titel grootte={26}>{t('Te beoordelen')}</Titel></div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
          {lijst.length === 0
            ? t('Niets in de wachtrij.')
            : lijst.length === 1
              ? t('1 recept wacht op een reactie.')
              : t('{n} recepten wachten op een reactie.', { n: lijst.length })}
        </p>
      </Kop>

      <Grens query={aanmeldingen} ladenTekst={t('Wachtrij ophalen')}>
        {lijst.length === 0 ? (
          <Leeg
            icoon="circleCheck"
            kop={t('Niets te doen')}
            tekst={t('Zodra iemand een eigen recept aanmeldt om te delen, staat het hier.')}
          />
        ) : (
          <Inhoud style={{ gap: 14 }}>
            {lijst.map((r) => (
              <div key={r.id} style={{
                background: 'var(--c-paper)', borderRadius: 'var(--radius-md)', padding: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, margin: 0,
                  }}>{receptTitel(r)}</h3>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 13, margin: '4px 0 0',
                    color: 'rgba(43,20,32,0.6)',
                  }}>
                    {r.bereidingstijd_minuten ? `${t('{n} min', { n: r.bereidingstijd_minuten })} · ` : ''}
                    {t('voor {p} · {n} ingrediënten', { p: r.personen, n: r.ingredienten.length })}
                  </p>
                </div>

                <details>
                  <summary style={{
                    fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                    color: 'var(--c-red)', cursor: 'pointer',
                  }}>{t('Bekijk ingrediënten en bereiding')}</summary>
                  <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ul style={{
                      margin: 0, paddingLeft: 18, fontFamily: 'var(--font-body)',
                      fontSize: 14, lineHeight: 1.6,
                    }}>
                      {r.ingredienten.map((i, n) => (
                        <li key={n}>{[i.hoeveelheid, i.eenheid, i.naam].filter(Boolean).join(' ')}</li>
                      ))}
                    </ul>
                    <ol style={{
                      margin: 0, paddingLeft: 18, fontFamily: 'var(--font-body)',
                      fontSize: 14, lineHeight: 1.6,
                    }}>
                      {r.bereiding_nl.map((s, n) => <li key={n}>{s}</li>)}
                    </ol>
                  </div>
                </details>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    tone="green"
                    disabled={beoordelen.isPending}
                    onClick={() => beoordelen.mutate({ receptId: r.id, goedkeuren: true })}
                    style={{ flex: 1 }}
                  >{t('Goedkeuren')}</Button>
                  <Button
                    variant="secondary"
                    disabled={beoordelen.isPending}
                    onClick={() => beoordelen.mutate({ receptId: r.id, goedkeuren: false })}
                    style={{ flex: 'none' }}
                  >{t('Afwijzen')}</Button>
                </div>
              </div>
            ))}
          </Inhoud>
        )}
      </Grens>
    </Scherm>
  )
}
