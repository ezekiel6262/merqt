import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.merqt.app',
  appName: 'Merqt',
  webDir: 'capacitor-shell',
  server: {
    url: 'https://merqt.com',
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#2d457d',
  },
}

export default config
