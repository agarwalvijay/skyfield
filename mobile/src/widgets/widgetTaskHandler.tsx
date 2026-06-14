import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { fetchWidgetWeather } from "./widgetData";
import { LargeWidget, SmallWidget } from "./SkyfieldWidgets";

/**
 * Called by the OS for widget lifecycle events (added, periodic update,
 * resized, clicked). Fetches fresh NWS data and re-renders the widget tree.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const widget = props.widgetInfo.widgetName;

  const render = async () => {
    let data = null;
    try {
      data = await fetchWidgetWeather(props.widgetInfo.widgetId);
    } catch {
      // Render the placeholder state on network failure; the next periodic
      // update will retry.
    }
    if (widget === "SkyfieldLarge") props.renderWidget(<LargeWidget data={data} />);
    else props.renderWidget(<SmallWidget data={data} />);
  };

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      await render();
      break;
    case "WIDGET_CLICK":
      // The ⟳ button; the rest of the widget uses OPEN_APP directly.
      if (props.clickAction === "REFRESH") await render();
      break;
    default:
      break;
  }
}
