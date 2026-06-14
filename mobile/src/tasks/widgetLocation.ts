import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedLocation } from "@/store/locations";

const KEY = "skyfield.widgetLocation";
const GPS_KEY = "skyfield.gpsLocation";

/**
 * The last active location, persisted for headless contexts (widgets and the
 * background alert task) which can't read live app state.
 */
export async function storeWidgetLocation(loc: SavedLocation): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(loc));
}

export async function readWidgetLocation(): Promise<SavedLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedLocation) : null;
  } catch {
    return null;
  }
}

/**
 * The latest device GPS fix, persisted separately so a widget pinned to
 * "Current Location" tracks the device even when the app is viewing a saved
 * place. (Widgets can't read fresh GPS headlessly, so they use this.)
 */
export async function storeGpsLocation(loc: SavedLocation): Promise<void> {
  await AsyncStorage.setItem(GPS_KEY, JSON.stringify(loc));
}

export async function readGpsLocation(): Promise<SavedLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(GPS_KEY);
    return raw ? (JSON.parse(raw) as SavedLocation) : null;
  } catch {
    return null;
  }
}
