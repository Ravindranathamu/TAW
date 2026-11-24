import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

export interface AutomaticPoint {
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  accuracyM: number;
  at: string;
}

export interface GpsSession {
  mode: "native" | "browser";
  stop: () => Promise<void>;
}

export interface GpsOptions {
  onPoint: (point: AutomaticPoint) => void;
  onError?: (message: string) => void;
  onMode?: (mode: "native" | "browser") => void;
}

/**
 * Starts automatic location publishing.
 * - Browser/PWA: watchPosition while the page is open.
 * - Native TAW wrapper: Capacitor background geolocation continues with the screen off.
 */
export async function startAutomaticGps(options: GpsOptions): Promise<GpsSession> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");

  if (Capacitor.isNativePlatform()) {
    // Android 13+ needs notification permission for the persistent tracking notice.
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let notificationPermission = await LocalNotifications.checkPermissions();
    if (notificationPermission.display !== "granted") {
      notificationPermission = await LocalNotifications.requestPermissions();
    }
    if (notificationPermission.display !== "granted") {
      options.onError?.("Allow notifications so TAW can keep the background tracking service alive.");
    }

    const plugin = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
    const id = await plugin.addWatcher(
      {
        backgroundMessage: "TAW is sharing the driver's live location with the customer.",
        backgroundTitle: "TAW live trip tracking",
        requestPermissions: true,
        stale: false,
        distanceFilter: 15,
      },
      (position, error) => {
        if (error) {
          options.onError?.(error.message || "Background location error.");
          return;
        }
        if (!position) return;
        options.onPoint({
          lat: position.latitude,
          lng: position.longitude,
          speedKmh: Math.max(0, (position.speed ?? 0) * 3.6),
          heading: position.bearing ?? 0,
          accuracyM: position.accuracy ?? 0,
          at: new Date(position.time ?? Date.now()).toISOString(),
        });
      },
    );
    options.onMode?.("native");
    return { mode: "native", stop: () => plugin.removeWatcher({ id }) };
  }

  if (!navigator.geolocation) {
    options.onError?.("Geolocation is unavailable on this device.");
    return { mode: "browser", stop: async () => undefined };
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      options.onPoint({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speedKmh: Math.max(0, (position.coords.speed ?? 0) * 3.6),
        heading: position.coords.heading ?? 0,
        accuracyM: position.coords.accuracy ?? 0,
        at: new Date(position.timestamp).toISOString(),
      });
    },
    (error) => options.onError?.(error.message || "Location unavailable."),
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    },
  );
  options.onMode?.("browser");
  return {
    mode: "browser",
    stop: async () => navigator.geolocation.clearWatch(watchId),
  };
}
