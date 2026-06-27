import { Platform } from "react-native";
import { syncWidgets } from "./widgetSync";

/**
 * Refresh every configured widget: fetch fresh data for each into the store
 * (newest-wins). The native widgets re-read their row on the next
 * APPWIDGET_UPDATE (periodic / boot / resize / the ⟳ worker's broadcast).
 * Called by the background task and after unit/location changes.
 */
export async function refreshAllWidgets(): Promise<void> {
  if (Platform.OS !== "android") return;
  await syncWidgets(undefined, true).catch(() => {});
}
