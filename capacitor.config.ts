import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.querajuda.app',
  appName: 'Quer Ajuda',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
};

export default config;
