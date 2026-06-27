import { NativeModules, Platform } from "react-native";

/**
 * Ask the native provider to repaint from the store right now, instead of
 * waiting on Android's unreliable ~30-min updatePeriodMillis. Call after any
 * store write. No-op off Android / if the native module is unavailable; the
 * widget still repaints on its next tick.
 */
export function requestWidgetRepaint(): void {
  if (Platform.OS !== "android") return;
  try {
    NativeModules.WidgetBridge?.requestUpdate?.();
  } catch {
    // non-fatal
  }
}
