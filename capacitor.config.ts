import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tvquine12.app',
  appName: 'TVQuine12',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000'
  }
};

export default config;
