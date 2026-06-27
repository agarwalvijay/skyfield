import { AppRegistry } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchWidgetWeather } from "./widgetData";
import { requestWidgetRepaint } from "./widgetBridge";

/**
 * One fetch path, three triggers (see architecture notes):
 *   - periodic  → the expo-background-task (alertTask) calls syncWidgets()
 *   - on-demand → the native ⟳ button enqueues WidgetSyncWorker, which runs the
 *                 "SkyfieldWidgetSync" headless task below even with the app closed
 *   - app open  → storeAppSnapshot publishes the active row directly
 */

const CONFIG_KEY = "skyfield.widgetConfig"; // map of { [widgetId]: WidgetConfig }
export const WIDGET_SYNC_TASK = "SkyfieldWidgetSync";

/** Widget ids the user has configured (the headless side can't enumerate the
 *  live AppWidgetManager, but every configured widget is in this map). */
async function configuredWidgetIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return Object.keys(map)
      .map((k) => Number(k))
      .filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

/** Fetch fresh data for the given widgets (or all configured) into the store. */
export async function syncWidgets(ids?: number[], force = true): Promise<void> {
  const list = ids && ids.length ? [...ids] : await configuredWidgetIds();
  // Always cover id 0 → resolves to the active location, so a freshly-added
  // (not-yet-configured) widget still gets data and an "active" row exists.
  if (!list.includes(0)) list.push(0);
  for (const id of list) {
    await fetchWidgetWeather(id, force).catch(() => {});
  }
  // Repaint now (works from the headless background task too) rather than
  // waiting on the widget's next ~30-min tick.
  requestWidgetRepaint();
}

/** Register the headless task the native WidgetSyncWorker invokes. Call once at
 *  module load (index.ts) so it exists in headless contexts too. */
export function registerWidgetSyncTask(): void {
  AppRegistry.registerHeadlessTask(
    WIDGET_SYNC_TASK,
    () =>
      async (data?: { widgetIds?: number[]; force?: boolean }) => {
        const ids = data?.widgetIds?.length ? data.widgetIds : undefined;
        await syncWidgets(ids, data?.force ?? true);
      },
  );
}
