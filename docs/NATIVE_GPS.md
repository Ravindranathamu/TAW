# Native driver wrapper for screen-off GPS

A browser PWA cannot guarantee location updates once the phone screen is off or the browser is suspended. TAW therefore supports a native Capacitor wrapper for drivers. The owner and customer views stay on the normal web deployment.

The application code is already wired: `src/lib/location.ts` detects a native platform and registers `@capacitor-community/background-geolocation`; on the web it falls back to `navigator.geolocation.watchPosition`. Drivers never enter coordinates manually.

## Add the native platform

```bash
npm install @capacitor/android
npm run build
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```

For iOS, on a macOS build machine:

```bash
npm install @capacitor/ios
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios
```

`capacitor.config.ts` sets `android.useLegacyBridge = true`, which is required by the background-geolocation plugin to keep updates running beyond five minutes in the background.

## Android manifest additions

Add to `android/app/src/main/AndroidManifest.xml` if Capacitor does not merge it:

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

The plugin already contributes fine/coarse location, foreground service, `FOREGROUND_SERVICE_LOCATION` and `POST_NOTIFICATIONS`. The app requests notification permission at tracker start (Android 13+) through `@capacitor/local-notifications`; drivers must choose **Allow** for the persistent "TAW live trip tracking" notification.

If location forwarding must continue after Android throttles WebView networking, enable Capacitor's native HTTP plugin (`@capacitor/http`) in the native project. The current implementation posts through the app's normal `fetch` path.

## iOS additions

Add to `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>TAW needs your location to share live tracking with the owner and customer.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>TAW needs your location while the screen is off during an assigned trip.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

## Verification checklist

1. Sign in at `/driver-login`, open an active trip, and confirm "Background GPS is active".
2. Lock the phone and travel a short distance.
3. Confirm the owner `/map` marker moves (cloud mode polls every 10 seconds).
4. Confirm the customer `/track/:token` map moves without a page refresh.
5. End the trip and confirm the watcher stops.

Without the native wrapper, the UI reports browser mode and states that tracking works only while the driver page remains open.
