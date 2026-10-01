import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { SplashScreen } from '@capacitor/splash-screen'

// Fonts in de bundle, geen CDN: de app moet ook werken zonder bereik.
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/700.css'
import '@fontsource/unbounded/900.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/700.css'

import './ds/styles.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Je staat in de kelder van de Lidl, niet op glasvezel: liever een uur
      // oude data tonen dan een leeg scherm.
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

const persister = createSyncStoragePersister({ storage: window.localStorage })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)

// Het opstartscherm blijft staan tot React getekend heeft (launchAutoHide
// staat uit in capacitor.config.ts), anders zie je even een leeg scherm.
// In de browser doet dit niets.
requestAnimationFrame(() => { void SplashScreen.hide().catch(() => { /* geen opstartscherm */ }) })
