import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native driver wrapper for true screen-off GPS.
 * The browser PWA remains the default deployment; this config is used only
 * when the native Android/iOS projects are added and distributed to drivers.
 */
const config: CapacitorConfig = {
  appId: "lk.ravsoft.taw.carrier",
  appName: "TAW Carrier",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    // Required by background-geolocation to keep updates after 5 minutes.
    useLegacyBridge: true,
  },
};

export default config;
