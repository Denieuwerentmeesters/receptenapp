import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, Route, HashRouter as Router, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { haalGedeeldeLink, linkUitSchema, toevoegPad } from './lib/deelknop'
import { planWeekmenuMelding } from './lib/weekmenuMelding'
import { DezeWeek } from './screens/DezeWeek'
import { Kookmodus } from './screens/Kookmodus'
import { Ontdekken } from './screens/Ontdekken'
import { Samenstellen } from './screens/Samenstellen'
import { Favorieten } from './screens/Favorieten'
import { Bespaard } from './screens/Bespaard'
import { Voorraadkast } from './screens/Voorraadkast'
import { Geschiedenis } from './screens/Geschiedenis'
import { Profiel } from './screens/Profiel'
import { ReceptToevoegen } from './screens/ReceptToevoegen'
import { Beoordelen } from './screens/Beoordelen'
import { Recept } from './screens/Recept'
import { Boodschappen } from './screens/Boodschappen'
import { Instellingen } from './screens/Instellingen'
import { Inloggen } from './screens/Inloggen'
import { Account } from './screens/Account'
import { Onboarding } from './screens/Onboarding'
import { Uitleg } from './components/Uitleg'
import { Fout, Laden } from './components/Staten'
import { huidigeSessie } from './lib/auth'
import { andereGebruiker, zorgVoorGebruiker } from './lib/gebruiker'
import { vergeetHuishouden } from './lib/huishouden'
import { foutTekst } from './lib/fouten'
import { useQueryClient } from '@tanstack/react-query'
import { useVoorkeuren } from './lib/queries'

type Status = 'bezig' | 'uitgelogd' | 'klaar' | 'fout'

/**
 * Startvolgorde: kijken of er een sessie is, en zo ja de gebruikersrij
 * aanmaken. Pas daarna mag er een query lopen — anders vuurt de eerste request
 * zonder geldige JWT en krijg je een 401 waar je niets aan hebt.
 */
export default function App() {
  const [status, setStatus] = useState<Status>('bezig')
  const [fout, setFout] = useState('')
  const qc = useQueryClient()
  // De laadanimatie blijft bij het openen minstens drie seconden staan, ook
  // als de sessie sneller binnen is: even het logo zien laten pruttelen.
  const [animatieKlaar, setAnimatieKlaar] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setAnimatieKlaar(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  const start = useCallback(async () => {
    setStatus('bezig')
    try {
      const sessie = await huidigeSessie()
      if (!sessie) {
        setStatus('uitgelogd')
        return
      }
      // Idempotent: maakt de gebruiker en de voorkeurenrij aan als ze er nog
      // niet zijn, en doet verder niets.
      const id = await zorgVoorGebruiker()
      // De kopie van de vorige gebruiker mag hier niet blijven staan: de poort
      // zou zijn voorkeuren lezen en een nieuw account langs de onboarding sturen.
      if (andereGebruiker(id)) {
        vergeetHuishouden()
        qc.clear()
      }
      setStatus('klaar')
    } catch (e) {
      setFout(foutTekst(e))
      setStatus('fout')
    }
  }, [qc])

  useEffect(() => { void start() }, [start])

  if (status === 'bezig' || !animatieKlaar) return <Laden />
  if (status === 'uitgelogd') return <Inloggen onKlaar={() => void start()} />
  if (status === 'fout') {
    return (
      <Fout
        kop="De app kan niet starten"
        tekst={fout}
        stappen={[
          'Controleer of app/.env.local is ingevuld met je Neon-gegevens.',
          'Controleer of de Data API en Auth aan staan op de Neon-branch.',
          'Controleer of de migraties in db/migrations gedraaid zijn.',
        ]}
        onOpnieuw={() => void start()}
      />
    )
  }

  return (
    // HashRouter, niet BrowserRouter: in een Capacitor-webview draait de app van
    // het bestandssysteem en is er geen server die diepe paden kan serveren.
    <Router>
      <GedeeldeLink />
      <Routes>
        <Route element={<Poort />}>
        <Route path="/welkom" element={<Onboarding />} />
        <Route path="/uitleg" element={<UitlegTerugkijken />} />
        <Route path="/" element={<Navigate to="/deze-week" replace />} />
        <Route path="/deze-week" element={<DezeWeek />} />
        {/* Oude paden: Vandaag en Weekmenu zijn samen "Deze week" geworden. */}
        <Route path="/vandaag" element={<Navigate to="/deze-week" replace />} />
        <Route path="/weekmenu" element={<Navigate to="/deze-week" replace />} />
        <Route path="/ontdekken" element={<Ontdekken />} />
        <Route path="/samenstellen" element={<Samenstellen />} />
        <Route path="/recept/:id" element={<Recept />} />
        <Route path="/koken/:id" element={<Kookmodus />} />
        <Route path="/boodschappen" element={<Boodschappen />} />
        <Route path="/favorieten" element={<Favorieten />} />
        <Route path="/voorraadkast" element={<Voorraadkast />} />
        <Route path="/geschiedenis" element={<Geschiedenis />} />
        <Route path="/bespaard" element={<Bespaard />} />
        <Route path="/profiel" element={<Profiel />} />
        <Route path="/toevoegen" element={<ReceptToevoegen />} />
        <Route path="/beoordelen" element={<Beoordelen />} />
        <Route path="/instellingen" element={<Instellingen />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/deze-week" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}

/**
 * Wie de onboarding nog niet gehad heeft gaat eerst naar /welkom, welk scherm
 * hij ook opent. Dat moet vóór Deze week: daar maakt de generator het
 * weekmenu, en dat hoort pas te gebeuren als je voorkeuren er staan.
 *
 * Alleen null telt als "nog niet". Ontbreekt de kolom (de migratie is nog niet
 * gedraaid, of de voorkeuren komen uit een oude kopie op je toestel), dan
 * laten we je gewoon door.
 */
function Poort() {
  const voorkeuren = useVoorkeuren()
  const plek = useLocation()
  // De weekmenu-melding volgt de instelling: bij elke start en elke wijziging opnieuw plannen.
  const v = voorkeuren.data
  useEffect(() => {
    if (v) void planWeekmenuMelding(v)
  }, [v?.pushbericht_aan, v?.pushbericht_dag, v?.pushbericht_tijd]) // eslint-disable-line react-hooks/exhaustive-deps
  if (voorkeuren.isPending) return <Laden />
  const nieuw = voorkeuren.data?.onboarding_klaar_op === null
  if (nieuw && plek.pathname !== '/welkom') return <Navigate to="/welkom" replace />
  return <Outlet />
}

/** "Bekijk de uitleg" in Instellingen: alleen de kaarten, zonder de vragen. */
function UitlegTerugkijken() {
  const navigeer = useNavigate()
  const terug = () => navigeer('/instellingen', { replace: true })
  return <Uitleg laatsteKnop="Klaar" overslaanTekst="Sluit" onKlaar={terug} onOverslaan={terug} onTerug={terug} />
}

/**
 * De deelknop van iOS (lib/deelknop.ts): een link die via pinch://toevoegen
 * binnenkomt, of die de extension in de App Group achterliet, opent het
 * toevoegscherm. Beide wegen kunnen dezelfde link brengen; de laatste
 * onthouden we even, zodat het scherm niet twee keer start.
 */
function GedeeldeLink() {
  const navigeer = useNavigate()
  const laatste = useRef<{ link: string; op: number } | null>(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let gestopt = false
    const open = (link: string) => {
      if (gestopt) return
      const nu = Date.now()
      if (laatste.current?.link === link && nu - laatste.current.op < 10_000) return
      laatste.current = { link, op: nu }
      navigeer(toevoegPad(link))
    }
    const uitSchema = (url: string) => {
      const link = linkUitSchema(url)
      if (!link) return
      // De extension zette 'm ook in de App Group; die kopie hoeft niet meer.
      void haalGedeeldeLink()
      open(link)
    }
    const uitGroep = () => haalGedeeldeLink().then((link) => { if (link) open(link) })

    void CapacitorApp.getLaunchUrl().then((r) => (r?.url ? uitSchema(r.url) : uitGroep()))
    const l1 = CapacitorApp.addListener('appUrlOpen', (e) => uitSchema(e.url))
    const l2 = CapacitorApp.addListener('appStateChange', (s) => { if (s.isActive) void uitGroep() })
    return () => {
      gestopt = true
      void l1.then((h) => h.remove())
      void l2.then((h) => h.remove())
    }
  }, [navigeer])

  return null
}
