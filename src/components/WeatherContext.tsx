import { createContext, useContext, type ReactNode } from "react";
import type { Coordinates, PointMeta } from "@/lib/nws";
import type { SavedLocation } from "@/store/locations";

interface WeatherCtx {
  location: SavedLocation | null;
  coords: Coordinates | null;
  meta: PointMeta | undefined;
  metaLoading: boolean;
  metaError: Error | null;
}

const Ctx = createContext<WeatherCtx | null>(null);

export function WeatherProvider({ value, children }: { value: WeatherCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWeatherCtx(): WeatherCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWeatherCtx must be used within WeatherProvider");
  return v;
}
