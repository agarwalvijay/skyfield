import { useCallback, useEffect, useState } from "react";
import { useLocationStore } from "@/store/locations";

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";

export const GPS_ID = "__gps__";

/**
 * Requests the device location and feeds it into the location store as the
 * special "Current Location" entry. Falls back gracefully when denied.
 */
export function useGeolocation(auto = true) {
  const setGps = useLocationStore((s) => s.setGps);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          id: GPS_ID,
          label: "Current Location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          isCurrent: true,
        });
        setStatus("granted");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("unavailable");
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  }, [setGps]);

  useEffect(() => {
    if (auto) locate();
  }, [auto, locate]);

  return { status, error, locate, gpsId: GPS_ID };
}
