import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedLocation } from "@/store/locations";
import { readGpsLocation, readWidgetLocation } from "@/tasks/widgetLocation";

const KEY = "skyfield.widgetConfig";
const LOCATIONS_KEY = "skyfield.locations"; // zustand persist blob

/** Per-widget config: which location the widget follows. */
export interface WidgetConfig {
  /** "active" follows the app's active location; otherwise a saved-location id. */
  locationId: string;
}

type ConfigMap = Record<number, WidgetConfig>;

export async function readWidgetConfig(widgetId: number): Promise<WidgetConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const map: ConfigMap = raw ? JSON.parse(raw) : {};
    return map[widgetId] ?? { locationId: "active" };
  } catch {
    return { locationId: "active" };
  }
}

export async function writeWidgetConfig(widgetId: number, cfg: WidgetConfig): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const map: ConfigMap = raw ? JSON.parse(raw) : {};
  map[widgetId] = cfg;
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

/** Saved locations from the persisted store (readable in headless contexts). */
export async function readSavedLocations(): Promise<SavedLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
    return raw ? (JSON.parse(raw)?.state?.locations ?? []) : [];
  } catch {
    return [];
  }
}

/** Matches GPS_ID in useGeolocation — kept literal so headless code avoids
 *  importing expo-location. */
export const GPS_LOCATION_ID = "__gps__";

/** Resolve the location a given widget should display. */
export async function resolveWidgetLocation(widgetId: number): Promise<SavedLocation | null> {
  const cfg = await readWidgetConfig(widgetId);
  // Pinned to the device's current location.
  if (cfg.locationId === GPS_LOCATION_ID) {
    return (await readGpsLocation()) ?? readWidgetLocation();
  }
  // Pinned to a specific saved place.
  if (cfg.locationId !== "active") {
    const saved = (await readSavedLocations()).find((l) => l.id === cfg.locationId);
    if (saved) return saved;
  }
  // "Follow the app" — the last active location.
  return readWidgetLocation();
}
