import React from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { fetchWidgetWeather } from "./widgetData";
import { LargeWidget, SmallWidget } from "./SkyfieldWidgets";

/**
 * Re-fetch and re-render every placed Skyfield widget. Used by the background
 * task (Android's updatePeriodMillis alone is unreliable) and after unit or
 * location changes in the app.
 */
export async function refreshAllWidgets(): Promise<void> {
  if (Platform.OS !== "android") return;
  for (const name of ["SkyfieldLarge", "SkyfieldSmall"] as const) {
    await requestWidgetUpdate({
      widgetName: name,
      renderWidget: async (info) => {
        const data = await fetchWidgetWeather(info.widgetId).catch(() => null);
        return name === "SkyfieldLarge"
          ? React.createElement(LargeWidget, { data })
          : React.createElement(SmallWidget, { data });
      },
      widgetNotFound: () => {},
    }).catch(() => {});
  }
}
