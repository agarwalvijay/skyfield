import React from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { fetchWidgetWeatherQuick, readLastSnapshot } from "./widgetData";
import { SmallWidget } from "./SkyfieldWidgets";

/**
 * Re-render the JS-rendered widgets. NOTE: SkyfieldLarge is now a NATIVE widget
 * (SkyfieldLarge.java) that reads the JSON snapshot file written by
 * storeAppSnapshot — we must NOT call requestWidgetUpdate for it, or the
 * library would overwrite the native layout with its own bitmap. Only the small
 * widget still goes through react-native-android-widget here. (Refreshing the
 * data via storeAppSnapshot already rewrites the file the native widget reads.)
 */
export async function refreshAllWidgets(): Promise<void> {
  if (Platform.OS !== "android") return;
  await requestWidgetUpdate({
    widgetName: "SkyfieldSmall",
    renderWidget: async (info) => {
      const data =
        (await fetchWidgetWeatherQuick(info.widgetId, 12000).catch(() => null)) ??
        (await readLastSnapshot().catch(() => null));
      return React.createElement(SmallWidget, { data });
    },
    widgetNotFound: () => {},
  }).catch(() => {});
}
