import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'nl.reinoudtencate.receptenapp',
  appName: 'Pinch',
  webDir: 'dist',
  ios: {
    // De app tekent zelf tot achter de statusbalk; elk scherm heeft al
    // env(safe-area-inset-top) in de kop verwerkt.
    contentInset: 'never',
    backgroundColor: '#FFF6E8',
  },
  plugins: {
    CapacitorHttp: {
      // fetch loopt via iOS in plaats van via de webview. Nodig voor het
      // inloggen: de webview gooit de sessiecookie van een ander domein weg.
      // Zie src/lib/config.ts.
      enabled: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#AB2328',
    },
    StatusBar: {
      // De koppen zijn rood met crèmekleurige tekst.
      style: 'DARK',
      backgroundColor: '#AB2328',
    },
  },
}

export default config
