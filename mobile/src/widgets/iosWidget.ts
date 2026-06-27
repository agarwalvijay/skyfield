import { Platform } from "react-native";
import type { WidgetWeather } from "./widgetData";
import type { SavedLocation } from "@/store/locations";
import type { TempUnit, WindUnit } from "@/lib/format/units";

const APP_GROUP = "group.com.atsumilabs.skyfield";

/**
 * Push to the iOS WidgetKit extension via the shared App Group, then reload its
 * timeline. Writes two things:
 *   - `widgetData`   the last rendered snapshot (instant render / fetch fallback)
 *   - `widgetConfig` the location + units so the widget can fetch FRESH data
 *                    itself on each OS timeline reload (option a; see index.swift)
 */
export async function writeIosWidget(
  snapshot: WidgetWeather,
  loc?: SavedLocation | null,
  units?: { temp: TempUnit; wind: WindUnit },
): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set("widgetData", JSON.stringify(snapshot));
    if (loc && units) {
      storage.set(
        "widgetConfig",
        JSON.stringify({
          lat: loc.lat,
          lon: loc.lon,
          place: snapshot.place,
          tempUnit: units.temp,
          windUnit: units.wind,
        }),
      );
    }
    ExtensionStorage.reloadWidget();
  } catch {
    // No extension yet (e.g. Expo Go) — ignore.
  }
}
