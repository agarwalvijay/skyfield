import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { fetchWidgetWeatherQuick, readLastSnapshot, type WidgetWeather } from "./widgetData";
import { LargeWidget, SmallWidget } from "./SkyfieldWidgets";

/**
 * Called by the OS for widget lifecycle events (added, periodic update,
 * resized, clicked).
 *
 * CRITICAL: render IMMEDIATELY with whatever we already have (last snapshot, or
 * the placeholder if none) so the widget is never blank — THEN try a fresh fetch
 * under a hard timeout and re-render only if it returns data. The previous code
 * awaited an un-timed network chain before the first render, so on boot / after
 * the cache expired the headless fetch could hang and renderWidget never fired,
 * leaving the widget invisible until the app was opened.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const widget = props.widgetInfo.widgetName;
  const el = (data: WidgetWeather | null, updating = false) =>
    widget === "SkyfieldLarge" ? (
      <LargeWidget data={data} updating={updating} />
    ) : (
      <SmallWidget data={data} updating={updating} />
    );

  // force=true skips the cache (explicit refresh → real network pull).
  // feedback=true shows the "…" updating state while it fetches.
  const render = async ({ force = false, feedback = false } = {}) => {
    // 1) Always paint something right away (never blank).
    const last = await readLastSnapshot().catch(() => null);
    props.renderWidget(el(last, feedback));

    // 2) Refresh with fresh data under a timeout; re-render on the result.
    const fresh = await fetchWidgetWeatherQuick(props.widgetInfo.widgetId, 12000, force).catch(
      () => null,
    );
    if (fresh) props.renderWidget(el(fresh, false));
    else if (feedback) props.renderWidget(el(last, false)); // clear "…" on a failed refresh
  };

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      await render();
      break;
    case "WIDGET_CLICK":
      // The ⟳ button; the rest of the widget uses OPEN_APP directly.
      if (props.clickAction === "REFRESH") await render({ force: true, feedback: true });
      break;
    default:
      break;
  }
}
