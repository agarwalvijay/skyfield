import { Platform } from "react-native";
import type { WidgetWeather } from "./widgetData";

const APP_GROUP = "group.com.atsumilabs.skyfield";

/**
 * Push the latest snapshot to the iOS WidgetKit extension via the shared App
 * Group (read in Swift from UserDefaults(suiteName:)), then reload its timeline.
 */
export async function writeIosWidget(snapshot: WidgetWeather): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set("widgetData", JSON.stringify(snapshot));
    ExtensionStorage.reloadWidget();
  } catch {
    // No extension yet (e.g. Expo Go) — ignore.
  }
}
