import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { useLocationStore } from "@/store/locations";

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";

export const GPS_ID = "__gps__";

/**
 * Requests device location via expo-location and feeds it into the location
 * store as the special "Current Location" entry.
 */
export function useGeolocation(auto = true) {
  const setGps = useLocationStore((s) => s.setGps);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback(
    (lat: number, lon: number) => {
      setGps({ id: GPS_ID, label: "Current Location", lat, lon, isCurrent: true });
      setStatus("granted");
    },
    [setGps],
  );

  const locate = useCallback(async () => {
    setStatus("locating");
    setError(null);
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }

      // Try for a fresh, high-accuracy fix, but don't block the UI on it: if it
      // takes longer than ~3s, fall back to the OS's last-known position so the
      // app shows *something near you* fast, then sharpens when the fresh fix
      // arrives. (Balanced accuracy could be a mile off; High is GPS-grade.)
      const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let settled = false;

      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const winner = await Promise.race([fresh, timeout]);

      if (winner) {
        settled = true;
        publish(winner.coords.latitude, winner.coords.longitude);
      } else {
        // Timed out — use last known immediately.
        const last = await Location.getLastKnownPositionAsync();
        if (last) publish(last.coords.latitude, last.coords.longitude);
      }

      // Let the fresh fix land in the background and refine the position.
      fresh
        .then((pos) => publish(pos.coords.latitude, pos.coords.longitude))
        .catch(() => {
          if (!settled) setStatus("unavailable");
        });
    } catch (e) {
      setStatus("unavailable");
      setError(e instanceof Error ? e.message : "Location unavailable");
    }
  }, [publish]);

  useEffect(() => {
    if (auto) locate();
  }, [auto, locate]);

  return { status, error, locate, gpsId: GPS_ID };
}
