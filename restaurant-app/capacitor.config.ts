import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Merlot',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: '#FFF9EC',
      showSpinner: false
    }
  }
};

export default config;
