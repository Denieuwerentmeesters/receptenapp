import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, TerugKnop, Titel } from '../components/Layout'
import { haalAanbod, herstel, kanKopen, koop, type PlusAanbod } from '../lib/aankoop'
import { Capacitor } from '@capacitor/core'
import { PRIVACY_URL, VOORWAARDEN_URL } from '../lib/config'
import { foutTekst } from '../lib/fouten'
import { GRATIS_RECEPTEN, usePlusStand } from '../lib/plus'

/**
 * Kookmaatje Plus: meer dan vijf recepten door AI laten maken, € 3 per maand.
 *
 * De aankoop loopt via Apple of Google Play (lib/aankoop.ts). Daarna meldt RevenueCat het aan
 * api/revenuecat.ts, wat een paar seconden kan duren; we vragen daarom een tijdje
 * opnieuw of Plus loopt, in plaats van de aankoop zelf te vertrouwen.
 *
 * Apple wil op dit scherm: de prijs en looptijd, dat het automatisch verlengt en
 * hoe je opzegt, een knop om te herstellen en links naar voorwaarden en privacy.
 */
export function Plus() {
  const qc = useQueryClient()
  const { data: stand, refetch } = usePlusStand()
  const [aanbod, setAanbod] = useState<PlusAanbod | null>(null)
  const [laden, setLaden] = useState(kanKopen())
  const [bezig, setBezig] = useState(false)
  const [wacht, setWacht] = useState(false)
  const [fout, setFout] = useState('')

  useEffect(() => {
    if (!kanKopen()) return
    haalAanbod()
      .then(setAanbod)
      .catch((e) => setFout(foutTekst(e)))
      .finally(() => setLaden(false))
  }, [])

  /** Wacht tot de server weet dat Plus loopt (de webhook is onderweg), hooguit een halve minuut. */
  async function wachtOpPlus() {
    setWacht(true)
    for (let i = 0; i < 15; i++) {
      const { data } = await refetch()
      if (data?.plus) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    setWacht(false)
    void qc.invalidateQueries({ queryKey: ['plus-stand'] })
  }

  async function doe(actie: () => Promise<unknown>) {
    setBezig(true); setFout('')
    try {
      const uitkomst = await actie()
      if (uitkomst !== 'geannuleerd') await wachtOpPlus()
    } catch (e) {
      setFout(foutTekst(e))
    } finally {
      setBezig(false)
    }
  }

  const actief = stand?.plus ?? false

  return (
    <Scherm>
      <Kop style={{ paddingBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TerugKnop />
          <Label>Meer recepten</Label>
        </div>
        <div style={{ marginTop: 14 }}><Titel>Kookmaatje Plus</Titel></div>
      </Kop>

      <Inhoud style={{ gap: 20 }}>
        <Tekst>
          Kookmaatje blijft gratis. Je weekmenu, je lijst en je mandje kosten niets, en de eerste {GRATIS_RECEPTEN} recepten
          die AI voor je maakt ook niet: uit een link, screenshots, een kookboekfoto of een menu van Zelf samenstellen.
          Wil je er meer, dan is dat Kookmaatje Plus, omdat elk recept ons geld kost.
        </Tekst>

        {stand && (
          <Kader>
            {actief
              ? <><b>Plus is actief</b>{stand.tot ? ` tot ${stand.tot.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Laat zoveel recepten maken als je wilt.</>
              : <><b>{stand.gebruikt} van {GRATIS_RECEPTEN}</b> gratis recepten gebruikt.</>}
          </Kader>
        )}

        {fout && <Kader waarschuwing>{fout}</Kader>}

        {!actief && (
          kanKopen() ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button
                disabled={laden || bezig || wacht || !aanbod}
                onClick={() => aanbod && void doe(() => koop(aanbod))}
              >
                {wacht ? 'Even wachten, we ronden af…'
                  : laden ? 'Prijs ophalen…'
                  : aanbod ? `Neem Plus voor ${aanbod.prijs} per maand`
                  : 'Plus is nu niet beschikbaar'}
              </Button>
              <Tekst klein>
                {Capacitor.getPlatform() === 'android'
                  ? <>Je betaalt via Google Play. Het abonnement verlengt zichzelf elke maand tot je opzegt;
                    opzeggen kan op elk moment in de Play Store: tik op je profielfoto → Betalingen en
                    abonnementen → Abonnementen. Je houdt Plus tot het eind van de periode die je betaalde.</>
                  : <>Je betaalt via je Apple-account. Het abonnement verlengt zichzelf elke maand tot je opzegt;
                    opzeggen kan minstens een dag voor de verlenging in de Instellingen van je iPhone,
                    onder je naam → Abonnementen. Je houdt Plus tot het eind van de periode die je betaalde.</>}
              </Tekst>
            </div>
          ) : (
            <Kader>
              Kookmaatje Plus neem je af in de Kookmaatje-app voor iPhone of Android. Open de app, ga naar Profiel →
              Kookmaatje Plus en log in met hetzelfde account.
            </Kader>
          )
        )}

        {kanKopen() && (
          <Button
            variant="secondary"
            disabled={bezig || wacht}
            onClick={() => void doe(herstel)}
            style={{ alignSelf: 'flex-start' }}
          >Herstel mijn aankoop</Button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
          <Link href={VOORWAARDEN_URL}>Algemene voorwaarden</Link>
          <Link href={PRIVACY_URL}>Privacybeleid</Link>
        </div>
      </Inhoud>

      <OnderBalk />
    </Scherm>
  )
}

function Tekst({ children, klein }: { children: ReactNode; klein?: boolean }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)', fontSize: klein ? 13 : 14, lineHeight: 1.5, margin: 0,
      color: 'rgba(43,20,32,0.75)',
    }}>{children}</p>
  )
}

function Kader({ children, waarschuwing }: { children: ReactNode; waarschuwing?: boolean }) {
  return (
    <div role={waarschuwing ? 'alert' : undefined} style={{
      background: waarschuwing ? 'var(--c-yellow)' : 'var(--c-paper)', color: 'var(--c-ink)',
      borderRadius: 'var(--radius-sm)', padding: '12px 14px',
      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45,
    }}>{children}</div>
  )
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--c-red)',
    }}>{children}</a>
  )
}
