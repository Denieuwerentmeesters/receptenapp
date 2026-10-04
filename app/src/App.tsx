import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'
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
import { Fout, Laden } from './components/Staten'
import { huidigeSessie } from './lib/auth'
import { zorgVoorGebruiker } from './lib/gebruiker'
import { foutTekst } from './lib/fouten'

type Status = 'bezig' | 'uitgelogd' | 'klaar' | 'fout'

/**
 * Startvolgorde: kijken of er een sessie is, en zo ja de gebruikersrij
 * aanmaken. Pas daarna mag er een query lopen — anders vuurt de eerste request
 * zonder geldige JWT en krijg je een 401 waar je niets aan hebt.
 */
export default function App() {
  const [status, setStatus] = useState<Status>('bezig')
  const [fout, setFout] = useState('')

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
      await zorgVoorGebruiker()
      setStatus('klaar')
    } catch (e) {
      setFout(foutTekst(e))
      setStatus('fout')
    }
  }, [])

  useEffect(() => { void start() }, [start])

  if (status === 'bezig') return <Laden tekst="De app wordt klaargezet" />
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
      <Routes>
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
      </Routes>
    </Router>
  )
}
