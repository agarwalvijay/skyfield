import * as FileSystem from "expo-file-system/legacy";
import type { WidgetWeather } from "./widgetData";

/**
 * The widget data plane — ONE source of truth, read by the native provider
 * (SkyfieldLarge.java) and written only through here.
 *
 * Design (see the architecture notes): the PRODUCER publishes a location-keyed
 * catalog of weather and is blind to which widget consumes what. Each CONSUMER
 * (a widget instance) subscribes by key via `bindings`. The native render half
 * does a pure lookup: bindings[id] -> key -> places[key].data.
 *
 *   {
 *     active:   "<key>" | null,                 // the app's current location
 *     places:   { "<key>": { at, data } },      // newest-wins per key
 *     bindings: { "<widgetId>": "<key>" | "active" }
 *   }
 *
 * `at` is epoch ms; writes are newest-wins so a slow background fetch can never
 * clobber a fresher value for the same key ("refresh goes backwards" bug).
 */

const FILE = (FileSystem.documentDirectory ?? "") + "widget_store.json";

export interface PlaceRecord {
  at: number;
  data: WidgetWeather;
}

export interface WidgetStore {
  active: string | null;
  places: Record<string, PlaceRecord>;
  bindings: Record<string, string>;
}

const EMPTY: WidgetStore = { active: null, places: {}, bindings: {} };

async function read(): Promise<WidgetStore> {
  try {
    const raw = await FileSystem.readAsStringAsync(FILE);
    const s = JSON.parse(raw);
    return {
      active: s.active ?? null,
      places: s.places ?? {},
      bindings: s.bindings ?? {},
    };
  } catch {
    return { active: null, places: {}, bindings: {} };
  }
}

async function write(s: WidgetStore): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(s));
}

/** Publish weather for a location. Newest-wins; optionally mark it active. */
export async function putPlace(
  key: string,
  data: WidgetWeather,
  at: number = Date.now(),
  active = false,
): Promise<void> {
  const s = await read();
  const existing = s.places[key];
  if (!existing || existing.at <= at) s.places[key] = { at, data };
  if (active) s.active = key;
  await write(s);
}

/** Record a widget's subscription: a location key, or "active" to follow the app. */
export async function setBinding(widgetId: number, target: string): Promise<void> {
  const s = await read();
  s.bindings[String(widgetId)] = target;
  await write(s);
}

/** Fresh data for a specific key, or null past `ttlMs`. */
export async function freshForKey(key: string, ttlMs: number): Promise<WidgetWeather | null> {
  const rec = (await read()).places[key];
  return rec && Date.now() - rec.at < ttlMs ? rec.data : null;
}
