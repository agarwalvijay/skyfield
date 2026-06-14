import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PressureUnit, TempUnit, WindUnit } from "@/lib/format/units";

export type RadarBasemap = "dark" | "light" | "voyager";

interface SettingsState {
  temp: TempUnit;
  wind: WindUnit;
  pressure: PressureUnit;
  imperialDistance: boolean;
  clock24h: boolean;
  radarColor: number;
  radarBasemap: RadarBasemap;
  setTemp: (t: TempUnit) => void;
  setWind: (w: WindUnit) => void;
  setPressure: (p: PressureUnit) => void;
  setImperialDistance: (v: boolean) => void;
  setClock24h: (v: boolean) => void;
  setRadarColor: (c: number) => void;
  setRadarBasemap: (b: RadarBasemap) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      temp: "F",
      wind: "mph",
      pressure: "inHg",
      imperialDistance: true,
      clock24h: false,
      radarColor: 4,
      radarBasemap: "dark" as RadarBasemap,
      setTemp: (temp) => set({ temp }),
      setWind: (wind) => set({ wind }),
      setPressure: (pressure) => set({ pressure }),
      setImperialDistance: (imperialDistance) => set({ imperialDistance }),
      setClock24h: (clock24h) => set({ clock24h }),
      setRadarColor: (radarColor) => set({ radarColor }),
      setRadarBasemap: (radarBasemap) => set({ radarBasemap }),
    }),
    { name: "skyfield.settings" },
  ),
);
