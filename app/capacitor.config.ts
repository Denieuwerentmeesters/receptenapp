import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'nl.reinoudtencate.receptenapp',
  appName: 'Kookmaatje',
  webDir: 'dist',
  ios: {
    // De app tekent zelf tot achter de statusbalk; elk scherm heeft al
    // env(safe-area-inset-top) in de kop verwerkt.
    contentInset: 'never',
    backgroundColor: '#F8F1EC',
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
      backgroundColor: '#5E1A3B',
    },
    StatusBar: {
      // De koppen zijn rood met crèmekleurige tekst.
      style: 'DARK',
      backgroundColor: '#5E1A3B',
    },
  },
}

export default config
