import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.proxly.arrival',
  appName: 'Proxly',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#14B8A6',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#14B8A6',
    },
    LocalNotifications: {
      smallIcon: 'notification_icon',
      iconColor: '#14B8A6',
      sound: 'beep.wav',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    allowedOrientations: ['portrait'],
  },
  ios: {
    scheme: 'Proxly',
    allowedOrientations: ['portrait'],
  },
};

export default config;
