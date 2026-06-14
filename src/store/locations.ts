import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedLocation {
  id: string;
  label: string;
  sublabel?: string;
  lat: number;
  lon: number;
  /** True for the device's current GPS position (not user-added). */
  isCurrent?: boolean;
}

interface LocationState {
  locations: SavedLocation[];
  activeId: string | null;
  /** The live GPS location, kept separate from saved ones. */
  gps: SavedLocation | null;
  setGps: (loc: SavedLocation | null) => void;
  addLocation: (loc: Omit<SavedLocation, "id">) => string;
  removeLocation: (id: string) => void;
  reorder: (ids: string[]) => void;
  setActive: (id: string) => void;
  getActive: () => SavedLocation | null;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      locations: [],
      activeId: null,
      gps: null,
      setGps: (loc) =>
        set((s) => ({
          gps: loc,
          // Default the active selection to GPS the first time we get it.
          activeId: s.activeId ?? (loc ? loc.id : null),
        })),
      addLocation: (loc) => {
        const id = uid();
        set((s) => ({
          locations: [...s.locations, { ...loc, id }],
          activeId: id,
        }));
        return id;
      },
      removeLocation: (id) =>
        set((s) => {
          const locations = s.locations.filter((l) => l.id !== id);
          let activeId = s.activeId;
          if (activeId === id) {
            activeId = locations[0]?.id ?? s.gps?.id ?? null;
          }
          return { locations, activeId };
        }),
      reorder: (ids) =>
        set((s) => {
          const map = new Map(s.locations.map((l) => [l.id, l]));
          const next = ids.map((id) => map.get(id)).filter(Boolean) as SavedLocation[];
          return { locations: next };
        }),
      setActive: (id) => set({ activeId: id }),
      getActive: () => {
        const s = get();
        if (s.gps && s.activeId === s.gps.id) return s.gps;
        return s.locations.find((l) => l.id === s.activeId) ?? s.gps ?? s.locations[0] ?? null;
      },
    }),
    {
      name: "skyfield.locations",
      // Don't persist the live GPS fix.
      partialize: (s) => ({ locations: s.locations, activeId: s.activeId }),
    },
  ),
);
