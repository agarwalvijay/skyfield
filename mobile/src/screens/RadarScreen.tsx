import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  RasterSource,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useRadarFrames } from "@/hooks/useWeather";
import { radarTileUrl } from "@/lib/radar/rainviewer";
import { useLocationStore } from "@/store/locations";
import { useSettings, type RadarBasemap } from "@/store/settings";
import { alertColor } from "@/lib/weather/alertColor";
import type { WeatherAlert } from "@/lib/nws";
import { EmptyBlock, Segmented } from "@/components/ui";
import { colors, fonts } from "@/theme";

const BASEMAP_PATH: Record<RadarBasemap, string> = {
  dark: "dark_all",
  light: "light_all",
  voyager: "rastertiles/voyager",
};

function baseStyle(basemap: RadarBasemap): StyleSpecification {
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: ["a", "b", "c", "d"].map(
          (s) => `https://${s}.basemaps.cartocdn.com/${BASEMAP_PATH[basemap]}/{z}/{x}/{y}.png`,
        ),
        tileSize: 256,
        attribution: "© OpenStreetMap © CARTO",
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto" }],
  };
}

export function RadarScreen({ alerts }: { alerts: WeatherAlert[] }) {
  const { coords, location } = useWeatherCtx();
  const gps = useLocationStore((s) => s.gps);
  const { radarBasemap, setRadarBasemap, radarColor } = useSettings();
  const { data: radar } = useRadarFrames();
  const [frameIdx, setFrameIdx] = useState(0);
  // Open paused on the latest (current) frame; play restarts from the oldest.
  const [playing, setPlaying] = useState(false);
  const togglePlay = () => {
    if (!playing) setFrameIdx(0);
    setPlaying((p) => !p);
  };
  const cameraRef = useRef<CameraRef>(null);

  // Draggable timeline scrubber. Refs hold live values so the (once-created)
  // PanResponder never closes over stale state.
  const framesLenRef = useRef(0);
  framesLenRef.current = radar?.frames.length ?? 0;
  const trackWRef = useRef(240);
  const seekTo = useRef((locationX: number) => {
    const len = framesLenRef.current;
    if (len <= 1) return;
    const ratio = Math.max(0, Math.min(1, locationX / trackWRef.current));
    setFrameIdx(Math.round(ratio * (len - 1)));
  }).current;
  const scrub = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setPlaying(false);
        seekTo(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => seekTo(e.nativeEvent.locationX),
    }),
  ).current;

  const flyTo = (lon: number, lat: number) =>
    cameraRef.current?.flyTo({ center: [lon, lat], duration: 700 });

  useEffect(() => {
    if (radar?.frames) {
      const lastPast = radar.frames.filter((f) => !f.forecast).length - 1;
      setFrameIdx((idx) => (idx === 0 ? Math.max(lastPast, 0) : idx));
    }
  }, [radar]);

  useEffect(() => {
    if (!playing || !radar) return;
    const id = setInterval(() => setFrameIdx((i) => (i + 1) % radar.frames.length), 700);
    return () => clearInterval(id);
  }, [playing, radar]);

  const alertShape = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: alerts
        .filter((a) => a.geometry)
        .map((a) => ({
          type: "Feature" as const,
          geometry: a.geometry as GeoJSON.Geometry,
          properties: { color: alertColor(a.severity) },
        })),
    }),
    [alerts],
  );

  const point = (lon: number, lat: number) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [lon, lat] },
    properties: {},
  });

  // The forecast location currently being viewed.
  const viewingGps = location?.isCurrent === true;
  // "You are here" — the device's true GPS fix, shown whenever it's known.
  const gpsShape = useMemo(() => (gps ? point(gps.lon, gps.lat) : null), [gps]);
  // The forecast location, shown as a second marker only when it differs from
  // the GPS dot (i.e. a saved place is selected). When viewing current
  // location the two coincide, so we draw a single dot.
  const forecastShape = useMemo(
    () => (!viewingGps && coords ? point(coords.lon, coords.lat) : null),
    [coords, viewingGps],
  );
  const showTwoDots = !!gpsShape && !!forecastShape;

  if (!coords) {
    return (
      <View style={s.page}>
        <EmptyBlock>Select a location to view radar.</EmptyBlock>
      </View>
    );
  }

  const current = radar?.frames[frameIdx];
  const progress = radar ? frameIdx / Math.max(radar.frames.length - 1, 1) : 0;

  return (
    <View style={s.screen}>
      <View style={s.head}>
        <Text style={s.title}>Radar</Text>
        <Segmented
          value={radarBasemap}
          onChange={setRadarBasemap}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "voyager", label: "Streets" },
          ]}
        />
      </View>

      <View style={s.mapWrap}>
        <MapLibreMap style={{ flex: 1 }} mapStyle={baseStyle(radarBasemap)}>
          {/* Default to the device's true location; fall back to the forecast
             location only when GPS is unknown. */}
          <Camera
            ref={cameraRef}
            initialViewState={{ center: [gps?.lon ?? coords.lon, gps?.lat ?? coords.lat], zoom: 6.5 }}
          />

          {radar?.frames.map((f, i) => (
            <RasterSource
              key={f.path}
              id={`radar-${f.path}`}
              tiles={[radarTileUrl(radar.host, f, { color: radarColor, smooth: true, size: 512 })]}
              tileSize={512}
              maxzoom={7}
            >
              <Layer
                id={`radar-layer-${f.path}`}
                type="raster"
                paint={{ "raster-opacity": i === frameIdx ? 0.72 : 0.005, "raster-fade-duration": 0 }}
              />
            </RasterSource>
          ))}

          {alertShape.features.length > 0 && (
            <GeoJSONSource id="alerts" data={alertShape}>
              <Layer
                id="alerts-fill"
                type="fill"
                paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.18 }}
              />
              <Layer
                id="alerts-line"
                type="line"
                paint={{ "line-color": ["get", "color"], "line-width": 1.6 }}
              />
            </GeoJSONSource>
          )}

          {/* Forecast-location marker (accent ring) — drawn under the GPS dot,
             only when a non-GPS place is selected. */}
          {forecastShape && (
            <GeoJSONSource id="forecast-loc" data={forecastShape}>
              <Layer
                id="forecast-dot"
                type="circle"
                paint={{
                  "circle-radius": 8,
                  "circle-color": "#ffd166",
                  "circle-opacity": 0.9,
                  "circle-stroke-width": 2.5,
                  "circle-stroke-color": "#0a0e1a",
                }}
              />
            </GeoJSONSource>
          )}

          {/* "You are here" GPS dot (blue) — whenever the device fix is known. */}
          {gpsShape && (
            <GeoJSONSource id="me" data={gpsShape}>
              <Layer
                id="me-dot"
                type="circle"
                paint={{
                  "circle-radius": 7,
                  "circle-color": "#ffffff",
                  "circle-stroke-width": 3,
                  "circle-stroke-color": "#2a6df4",
                }}
              />
            </GeoJSONSource>
          )}
        </MapLibreMap>

        {/* Recenter buttons */}
        <View style={s.recenter}>
          {gps && (
            <Pressable style={s.recenterBtn} onPress={() => flyTo(gps.lon, gps.lat)}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
                <Circle cx={12} cy={12} r={3.5} />
                <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </Svg>
            </Pressable>
          )}
          {forecastShape && coords && (
            <Pressable
              style={[s.recenterBtn, { borderColor: "#ffd166" }]}
              onPress={() => flyTo(coords.lon, coords.lat)}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ffd166" strokeWidth={2}>
                <Path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" strokeLinejoin="round" />
                <Circle cx={12} cy={10} r={2.4} />
              </Svg>
            </Pressable>
          )}
        </View>

        {/* Marker key — only when both dots are visible. */}
        {showTwoDots && (
          <View style={s.dotKey}>
            <View style={s.dotKeyRow}>
              <View style={[s.keyDot, { backgroundColor: "#ffffff", borderColor: "#2a6df4" }]} />
              <Text style={s.legendText}>You</Text>
            </View>
            <View style={s.dotKeyRow}>
              <View style={[s.keyDot, { backgroundColor: "#ffd166", borderColor: "#0a0e1a" }]} />
              <Text style={s.legendText}>Forecast</Text>
            </View>
          </View>
        )}

        {/* Legend */}
        <View style={s.legend}>
          {(
            [
              ["#5db8ff", "light"],
              ["#ffd633", "mod"],
              ["#ff9500", "heavy"],
              ["#e8392b", "intense"],
            ] as const
          ).map(([c, label]) => (
            <View key={label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: c }]} />
              <Text style={s.legendText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Controls */}
        <View style={s.controls}>
          <Pressable style={s.play} onPress={togglePlay}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill={colors.fg}>
              {playing ? (
                <>
                  <Rect x={6} y={5} width={4} height={14} rx={1} />
                  <Rect x={14} y={5} width={4} height={14} rx={1} />
                </>
              ) : (
                <Path d="M7 5l12 7-12 7z" />
              )}
            </Svg>
          </Pressable>
          <View
            style={s.track}
            onLayout={(e) => {
              trackWRef.current = e.nativeEvent.layout.width;
            }}
            {...scrub.panHandlers}
          >
            <View style={s.trackLine} />
            <View style={[s.trackThumb, { left: `${progress * 100}%` }]} />
          </View>
          <Text style={s.timeLabel}>
            {current
              ? `${current.forecast ? "FCST " : ""}${new Date(current.time * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : "Loading…"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 18 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.fg },
  mapWrap: { flex: 1, marginBottom: 86, overflow: "hidden" },
  legend: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(14,18,28,0.78)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: "#e8edf6" },
  dotKey: {
    position: "absolute",
    top: 50,
    left: 10,
    gap: 5,
    backgroundColor: "rgba(14,18,28,0.78)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dotKeyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  keyDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  recenter: { position: "absolute", right: 12, bottom: 96, gap: 10 },
  recenterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,18,28,0.85)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  controls: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(14,18,28,0.85)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  play: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  track: { flex: 1, height: 28, justifyContent: "center" },
  trackLine: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  trackThumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    marginLeft: -7,
  },
  timeLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.fg, minWidth: 64, textAlign: "right" },
});
