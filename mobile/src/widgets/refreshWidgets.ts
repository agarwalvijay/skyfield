import { Platform } from "react-native";
import { fetchWidgetWeather } from "./widgetData";

/**
 * The widget is now NATIVE (SkyfieldLarge.java) and renders from the JSON
 * snapshot file. "Refreshing" means: fetch fresh data for the active location
 * and rewrite that file (storeAppSnapshot does the write inside
 * fetchWidgetWeather). The native widget re-reads the file on its next update
 * (periodic / resize / boot) or when the app opens. Called by the background
 * task and after unit/location changes.
 */
export async function refreshAllWidgets(): Promise<void> {
  if (Platform.OS !== "android") return;
  // widgetId 0 → resolveWidgetLocation falls back to the active location.
  await fetchWidgetWeather(0, true).catch(() => {});
}
