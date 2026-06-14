import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useRadarFrames } from "@/hooks/useWeather";
import { radarTileUrl, type RadarFrame } from "@/lib/radar/rainviewer";
import { useSettings } from "@/store/settings";
import type { Coordinates, WeatherAlert } from "@/lib/nws";
import { alertColor } from "@/lib/weather/alertColor";

interface Props {
  /** The forecast location currently being viewed. */
  forecast: Coordinates;
  /** The device's true GPS fix, if known. */
  gps: Coordinates | null;
  /** True when the viewed location IS the GPS location (draw a single dot). */
  viewingGps: boolean;
  alerts: WeatherAlert[];
}

// CARTO basemaps — free raster tiles, no API key.
const BASEMAP_PATH: Record<string, string> = {
  dark: "dark_all",
  light: "light_all",
  voyager: "rastertiles/voyager",
};

function baseStyle(basemap: string): maplibregl.StyleSpecification {
  const path = BASEMAP_PATH[basemap] ?? BASEMAP_PATH.dark;
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: ["a", "b", "c", "d"].map(
          (s) => `https://${s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}.png`,
        ),
        tileSize: 256,
        attribution: "© OpenStreetMap © CARTO",
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto" }],
  };
}

const RADAR_LAYER = "radar-layer";

export function RadarMap({ forecast, gps, viewingGps, alerts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Default to the device location; fall back to the forecast location.
  const initCenter = gps ?? forecast;
  const showForecastDot = !viewingGps;
  const showTwoDots = !!gps && showForecastDot;

  const flyTo = (c: Coordinates) =>
    mapRef.current?.flyTo({ center: [c.lon, c.lat], duration: 700 });
  const [ready, setReady] = useState(false);
  const { data: radar } = useRadarFrames();
  const { radarColor, radarBasemap } = useSettings();

  const [frameIdx, setFrameIdx] = useState(0);
  // Open paused on the latest (current) frame; play restarts from the oldest.
  const [playing, setPlaying] = useState(false);
  const togglePlay = () => {
    if (!playing) setFrameIdx(0);
    setPlaying((p) => !p);
  };
  const framesRef = useRef<RadarFrame[]>([]);
  // Mirror frameIdx into a ref so the (async) layer-setup effect can apply the
  // active frame's opacity the moment its layers exist, without depending on
  // frameIdx (which would re-add layers on every animation tick).
  const frameIdxRef = useRef(0);
  useEffect(() => {
    frameIdxRef.current = frameIdx;
  }, [frameIdx]);

  // ---- Init map (recreated when the basemap setting changes; all overlays
  // re-add themselves via the `ready` flag flipping false → true) ----
  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(radarBasemap),
      center: [initCenter.lon, initCenter.lat],
      zoom: 7,
      attributionControl: false,
      maxZoom: 12,
      minZoom: 3,
      // Keeps the GL buffer readable so screenshots/share-image work.
      preserveDrawingBuffer: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarBasemap]);

  // ---- Markers: "You" (GPS) + "Forecast" (viewed location, when different) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers: maplibregl.Marker[] = [];

    if (showForecastDot) {
      const el = document.createElement("div");
      el.className = "radar-marker radar-marker-forecast";
      markers.push(
        new maplibregl.Marker({ element: el }).setLngLat([forecast.lon, forecast.lat]).addTo(map),
      );
    }
    if (gps) {
      const el = document.createElement("div");
      el.className = "radar-marker";
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([gps.lon, gps.lat]).addTo(map));
    }
    return () => markers.forEach((m) => m.remove());
  }, [forecast.lat, forecast.lon, gps?.lat, gps?.lon, showForecastDot, ready]);

  // ---- Alert polygons ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const features = alerts
      .filter((a) => a.geometry)
      .map((a) => ({
        type: "Feature" as const,
        geometry: a.geometry as GeoJSON.Geometry,
        properties: { color: alertColor(a.severity), event: a.event },
      }));

    const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
    const existing = map.getSource("alerts") as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource("alerts", { type: "geojson", data });
      map.addLayer({
        id: "alerts-fill",
        type: "fill",
        source: "alerts",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: "alerts-line",
        type: "line",
        source: "alerts",
        paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-opacity": 0.9 },
      });
    }
  }, [alerts, ready]);

  // ---- Radar frame layers ----
  // All frames are added as persistent layers once; animation just toggles
  // opacity. Recreating sources per tick would re-fetch tiles constantly and
  // the layer would never finish loading before being destroyed.
  const layerId = (f: RadarFrame) => `${RADAR_LAYER}-${f.path}`;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !radar) return;

    const setup = () => {
      const wanted = new Set(radar.frames.map((f) => layerId(f)));
      // Drop layers/sources from a previous radar refresh.
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.id.startsWith(RADAR_LAYER) && !wanted.has(layer.id)) {
          map.removeLayer(layer.id);
          if (map.getSource(layer.id)) map.removeSource(layer.id);
        }
      }
      const beforeId = map.getLayer("alerts-fill") ? "alerts-fill" : undefined;
      for (const frame of radar.frames) {
        const id = layerId(frame);
        if (map.getLayer(id)) continue;
        const url = radarTileUrl(radar.host, frame, { color: radarColor, smooth: true, size: 512 });
        // RainViewer free tiles only exist through z7; cap maxzoom so MapLibre
        // overscales z7 tiles instead of fetching "Not Supported" error tiles.
        if (!map.getSource(id)) {
          map.addSource(id, { type: "raster", tiles: [url], tileSize: 512, maxzoom: 7 });
        }
        map.addLayer(
          {
            id,
            type: "raster",
            source: id,
            // 0.005 instead of 0: MapLibre skips tile loading entirely for
            // zero-opacity layers, which would leave every frame blank.
            paint: { "raster-opacity": 0.005, "raster-fade-duration": 0 },
          },
          beforeId,
        );
      }
      // Layers are added at ~0 opacity; reveal the active frame now that they
      // exist. Without this the map shows nothing until something else (e.g.
      // pressing play) re-triggers the frame-display effect below.
      const activeId = radar.frames[frameIdxRef.current]
        ? layerId(radar.frames[frameIdxRef.current])
        : null;
      if (activeId && map.getLayer(activeId)) {
        map.setPaintProperty(activeId, "raster-opacity", 0.72);
      }
    };

    if (map.isStyleLoaded()) setup();
    else map.once("idle", setup);
  }, [ready, radar, radarColor]);

  useEffect(() => {
    if (radar?.frames) {
      framesRef.current = radar.frames;
      // Start at the most recent observed frame (last past frame).
      const lastPast = radar.frames.filter((f) => !f.forecast).length - 1;
      setFrameIdx((idx) => (idx === 0 ? Math.max(lastPast, 0) : idx));
    }
  }, [radar]);

  // Show the active frame, hide the rest.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !radar) return;
    for (let i = 0; i < radar.frames.length; i++) {
      const id = layerId(radar.frames[i]);
      if (!map.getLayer(id)) continue;
      map.setPaintProperty(id, "raster-opacity", i === frameIdx ? 0.72 : 0.005);
    }
  }, [ready, radar, frameIdx]);

  // ---- Animation loop ----
  useEffect(() => {
    if (!playing || !radar) return;
    const id = setInterval(() => {
      setFrameIdx((i) => (i + 1) % radar.frames.length);
    }, 700);
    return () => clearInterval(id);
  }, [playing, radar]);

  const current = radar?.frames[frameIdx];

  return (
    <div className="radar-map-wrap">
      <div ref={containerRef} className="radar-map" />

      <span className="radar-legend">
        <i style={{ background: "#5db8ff" }} /> light
        <i style={{ background: "#3ad36b" }} /> mod
        <i style={{ background: "#ffd84d" }} /> heavy
        <i style={{ background: "#ff5a5f" }} /> intense
      </span>

      {/* Marker key when both dots show */}
      {showTwoDots && (
        <div className="radar-dotkey card">
          <span><i className="dot-you" /> You</span>
          <span><i className="dot-forecast" /> Forecast</span>
        </div>
      )}

      {/* Recenter buttons */}
      <div className="radar-recenter">
        {gps && (
          <button className="radar-recenter-btn" onClick={() => flyTo(gps)} aria-label="Center on my location">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="12" cy="12" r="3.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {showForecastDot && (
          <button
            className="radar-recenter-btn"
            style={{ borderColor: "#ffd166" }}
            onClick={() => flyTo(forecast)}
            aria-label="Center on forecast location"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#ffd166" strokeWidth="2">
              <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
          </button>
        )}
      </div>

      {/* Timeline + controls */}
      <div className="radar-controls card">
        <button
          className="radar-play"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M7 5l12 7-12 7z" />
            </svg>
          )}
        </button>

        <div className="radar-timeline">
          <input
            type="range"
            min={0}
            max={Math.max((radar?.frames.length ?? 1) - 1, 0)}
            value={frameIdx}
            onChange={(e) => {
              setPlaying(false);
              setFrameIdx(Number(e.target.value));
            }}
          />
          <div className="radar-time-label tabular">
            {current ? (
              <>
                {current.forecast && <span className="radar-fcst">FORECAST</span>}
                {new Date(current.time * 1000).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </>
            ) : (
              "Loading radar…"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
