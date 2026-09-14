import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pbrili',
  appName: '排班日历',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
