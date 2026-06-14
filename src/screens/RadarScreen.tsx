import { lazy, Suspense } from "react";
import { useWeatherCtx } from "@/components/WeatherContext";
import { Segmented } from "@/components/Segmented";
import { useSettings } from "@/store/settings";
import { useLocationStore } from "@/store/locations";
import type { WeatherAlert } from "@/lib/nws";
import { EmptyBlock } from "@/components/States";

// MapLibre is ~700KB; only load it when the Radar tab is actually opened.
const RadarMap = lazy(() =>
  import("@/components/RadarMap").then((m) => ({ default: m.RadarMap })),
);

export function RadarScreen({ alerts }: { alerts: WeatherAlert[] }) {
  const { coords, location } = useWeatherCtx();
  const gps = useLocationStore((s) => s.gps);
  const { radarBasemap, setRadarBasemap } = useSettings();
  const gpsCoords = gps ? { lat: gps.lat, lon: gps.lon } : null;
  const viewingGps = location?.isCurrent === true;

  return (
    <div className="radar-screen">
      <div className="radar-header">
        <h1 className="page-title display" style={{ margin: 0 }}>
          Radar
        </h1>
        <Segmented
          id="basemap"
          value={radarBasemap}
          onChange={setRadarBasemap}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "voyager", label: "Streets" },
          ]}
        />
      </div>

      {coords ? (
        <Suspense
          fallback={
            <div className="radar-map-wrap">
              <div className="radar-map skeleton" style={{ borderRadius: 0 }} />
            </div>
          }
        >
          <RadarMap forecast={coords} gps={gpsCoords} viewingGps={viewingGps} alerts={alerts} />
        </Suspense>
      ) : (
        <div className="page">
          <EmptyBlock>Select a location to view radar.</EmptyBlock>
        </div>
      )}
    </div>
  );
}
