import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveAlerts, severityRank } from "@/lib/nws";
import { readWidgetLocation, storeWidgetLocation } from "./widgetLocation";
import type { SavedLocation } from "@/store/locations";

export const ALERT_TASK = "skyfield-alert-check";
const SEEN_KEY = "skyfield.seenAlertIds";
const ENABLED_KEY = "skyfield.settings"; // zustand persist blob

async function notificationsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ENABLED_KEY);
    if (!raw) return true;
    return JSON.parse(raw)?.state?.alertNotifications !== false;
  } catch {
    return true;
  }
}

/**
 * Background check: fetch active alerts for the last active location and fire
 * a local notification for any alert id we haven't notified about before.
 */
TaskManager.defineTask(ALERT_TASK, async () => {
  try {
    // Always refresh widgets on each background run — Android's own
    // updatePeriodMillis is best-effort and frequently never fires.
    const { refreshAllWidgets } = await import("@/widgets/refreshWidgets");
    await refreshAllWidgets();

    if (!(await notificationsEnabled())) return BackgroundTask.BackgroundTaskResult.Success;
    const loc = await readWidgetLocation();
    if (!loc) return BackgroundTask.BackgroundTaskResult.Success;

    const alerts = await getActiveAlerts({ lat: loc.lat, lon: loc.lon });
    if (alerts.length === 0) return BackgroundTask.BackgroundTaskResult.Success;

    const seenRaw = await AsyncStorage.getItem(SEEN_KEY);
    const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);
    const fresh = alerts
      .filter((a) => !seen.has(a.id))
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

    for (const a of fresh.slice(0, 3)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${a.event} — ${loc.label}`,
          body: a.headline ?? a.description.slice(0, 180),
          sound: a.severity === "Extreme" || a.severity === "Severe" ? "default" : undefined,
        },
        trigger: null, // fire immediately
      });
      seen.add(a.id);
    }

    // Keep the seen set bounded (alerts expire quickly).
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

let registered = false;

/**
 * Called from the app whenever the active location changes: persists the
 * location for headless tasks and (once) registers the periodic check +
 * notification permissions.
 */
export async function syncAlertTask(loc: SavedLocation): Promise<void> {
  try {
    await storeWidgetLocation(loc);
    if (registered) return;
    registered = true;

    await Notifications.requestPermissionsAsync();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Available) {
      await BackgroundTask.registerTaskAsync(ALERT_TASK, {
        minimumInterval: 15, // minutes; OS decides actual cadence
      });
    }
  } catch {
    // Non-fatal: alerts still show in-app.
  }
}
