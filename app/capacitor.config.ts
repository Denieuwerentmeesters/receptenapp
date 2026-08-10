import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'nl.receptenapp.app',
  appName: 'Receptenapp',
  webDir: 'dist',
  ios: {
    // De app tekent zelf tot achter de statusbalk; elk scherm heeft al
    // env(safe-area-inset-top) in de kop verwerkt.
    contentInset: 'never',
    backgroundColor: '#FFF6E8',
  },
  plugins: {
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
