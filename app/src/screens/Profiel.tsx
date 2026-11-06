import { useNavigate } from 'react-router-dom'
import { Icon } from '../ds'
import { Inhoud, Kop, OnderBalk, Scherm, Stat, Titel } from '../components/Layout'
import { useAanmeldingen, useBestellingen, useGeschiedenis, useIsAdmin, useVoorraad } from '../lib/queries2'
import { MAALTIJDBOX, euro, totaalBespaard } from '../lib/besparing'
import { useVoorkeuren } from '../lib/queries'
import { logUit } from '../lib/auth'
import { GRATIS_RECEPTEN, usePlusStand } from '../lib/plus'
import { t } from '../lib/taal'

export function Profiel() {
  const navigeer = useNavigate()
  const voorkeuren = useVoorkeuren()
  const geschiedenis = useGeschiedenis()
  const bestellingen = useBestellingen()
  const voorraad = useVoorraad()
  const isAdmin = useIsAdmin()
  const aanmeldingen = useAanmeldingen()
  const plusStand = usePlusStand()

  const weken = geschiedenis.data ?? []
  const alleGekozen = weken.flatMap((w) => w.gekozen)
  const gekookt = alleGekozen.filter((g) => g.gekooktOp)
  const vega = gekookt.filter((g) => g.recept.tags.includes('vegetarisch')).length
  const vegaPct = gekookt.length > 0 ? Math.round((vega / gekookt.length) * 100) : 0

  const bespaard = bestellingen.data ?? []

  // Instellingen bovenaan: daar kom je het vaakst. Ontdekken zit al in de
  // onderbalk. Het hartje zet een recept bij Nog bestellen; de oude Favorieten
  // staan niet meer in het menu (de route /favorieten bestaat nog).
  const rijen = [
    { label: t('Instellingen'), sub: t('Voor {n} personen', { n: voorkeuren.data?.aantal_personen ?? 4 }), pad: '/instellingen' },
    {
      label: t('Bespaard!'),
      sub: bespaard.length > 0
        ? t('{bedrag} minder dan bij {naam}', { bedrag: euro(totaalBespaard(bespaard)), naam: t(MAALTIJDBOX.naam) })
        : t('Wat je bespaart ten opzichte van {naam}', { naam: t(MAALTIJDBOX.naam) }),
      pad: '/bespaard',
    },
    { label: t('Voorraadkast'), sub: t('{n} producten in huis', { n: voorraad.data?.filter((v) => v.in_huis).length ?? 0 }), pad: '/voorraadkast' },
    { label: t('Geschiedenis'), sub: weken.length === 1 ? t('{n} week', { n: weken.length }) : t('{n} weken', { n: weken.length }), pad: '/geschiedenis' },
    { label: t('Recept toevoegen'), sub: t('Uit een kookboek of je eigen recept'), pad: '/toevoegen' },
    // Alleen zichtbaar als je admin bent (plan §7.7).
    ...(isAdmin.data
      ? [{
          label: t('Te beoordelen'),
          sub: t('{n} in de wachtrij', { n: aanmeldingen.data?.length ?? 0 }),
          pad: '/beoordelen',
        }]
      : []),
    {
      label: 'Kookmaatje Plus',
      sub: plusStand.data?.plus
        ? t('Actief: AI-recepten zonder limiet')
        : t('{n} van {max} gratis AI-recepten gebruikt', { n: plusStand.data?.gebruikt ?? 0, max: GRATIS_RECEPTEN }),
      pad: '/plus',
    },
    { label: t('Account'), sub: t('Privacy, hulp en account verwijderen'), pad: '/account' },
  ]

  return (
    <Scherm>
      <Kop style={{ paddingBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{
          flex: 'none', width: 64, height: 64, borderRadius: 'var(--radius-full)',
          background: 'var(--c-yellow)', color: 'var(--c-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24,
        }}>
          <Icon name="chefHat" size={28} />
        </span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <Titel grootte={22}>{t('Mijn keuken')}</Titel>
        </span>
      </Kop>

      <Inhoud style={{ gap: 18 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Stat getal={String(gekookt.length)} label={t('gerechten gekookt')} />
          <Stat getal={`${vegaPct}%`} label={t('vegetarisch')} />
          <Stat getal={String(weken.length)} label={weken.length === 1 ? t('week actief') : t('weken actief')} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--c-red)', paddingBottom: 6,
          }}>{t('Jouw app')}</span>

          {rijen.map((rij) => (
            <button
              key={rij.pad}
              onClick={() => navigeer(rij.pad)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none',
                borderBottom: '1.5px solid rgba(43,20,32,0.12)', padding: '14px 2px', cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>{rij.label}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(43,20,32,0.6)' }}>{rij.sub}</span>
              </span>
              <Icon name="chevronRight" size={18} style={{ color: 'var(--c-red)' }} />
            </button>
          ))}
        </div>

        <button
          onClick={() => { void logUit().then(() => window.location.reload()) }}
          style={{
            alignSelf: 'flex-start', background: 'transparent', border: 'none',
            padding: '2px 2px 20px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'rgba(43,20,32,0.6)',
          }}
        >{t('Uitloggen')}</button>
      </Inhoud>

      <OnderBalk />
    </Scherm>
  )
}
