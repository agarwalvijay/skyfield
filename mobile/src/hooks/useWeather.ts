import { useQuery } from "@tanstack/react-query";
import {
  getActiveAlerts,
  getCurrentConditions,
  getForecast,
  getForecastDiscussion,
  getHourlyForecast,
  getGridSeries,
  getHazardousOutlook,
  getPointMeta,
  severityRank,
  type Coordinates,
  type PointMeta,
} from "@/lib/nws";
import { getRadarFrames } from "@/lib/radar/rainviewer";
import { getNowcast } from "@/lib/nowcast/openmeteo";
import { getAirQuality, getUvIndex } from "@/lib/weather/airquality";
import { getTides } from "@/lib/weather/tides";
import { getNearbyStorms } from "@/lib/weather/tropical";

const key = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

/** Resolve grid metadata for a coordinate (the gateway call). */
export function usePointMeta(coords: Coordinates | null) {
  return useQuery({
    queryKey: ["point", coords && key(coords.lat, coords.lon)],
    queryFn: ({ signal }) => getPointMeta(coords!, signal),
    enabled: !!coords,
    staleTime: 1000 * 60 * 60 * 24, // grid mapping is stable
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function useCurrentConditions(meta: PointMeta | undefined, radarLevel = 0) {
  return useQuery({
    queryKey: ["current", meta?.gridId, meta?.gridX, meta?.gridY, radarLevel],
    queryFn: ({ signal }) => getCurrentConditions(meta!, signal, radarLevel),
    enabled: !!meta,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });
}

export function useForecast(meta: PointMeta | undefined) {
  return useQuery({
    queryKey: ["forecast", meta?.gridId, meta?.gridX, meta?.gridY],
    queryFn: ({ signal }) => getForecast(meta!, signal),
    enabled: !!meta,
    staleTime: 1000 * 60 * 15,
  });
}

export function useHourly(meta: PointMeta | undefined) {
  return useQuery({
    queryKey: ["hourly", meta?.gridId, meta?.gridX, meta?.gridY],
    queryFn: ({ signal }) => getHourlyForecast(meta!, signal),
    enabled: !!meta,
    staleTime: 1000 * 60 * 15,
  });
}

export function useAlerts(coords: Coordinates | null) {
  return useQuery({
    queryKey: ["alerts", coords && key(coords.lat, coords.lon)],
    queryFn: async ({ signal }) => {
      const alerts = await getActiveAlerts(coords!, signal);
      return alerts.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
    },
    enabled: !!coords,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 3,
  });
}

export function useDiscussion(meta: PointMeta | undefined, enabled = true) {
  return useQuery({
    queryKey: ["discussion", meta?.gridId],
    queryFn: ({ signal }) => getForecastDiscussion(meta!, signal),
    enabled: !!meta && enabled,
    staleTime: 1000 * 60 * 30,
  });
}

export function useOutlook(meta: PointMeta | undefined) {
  return useQuery({
    queryKey: ["outlook", meta?.gridId],
    queryFn: ({ signal }) => getHazardousOutlook(meta!, signal),
    enabled: !!meta,
    staleTime: 1000 * 60 * 30,
  });
}

export function useGridSeries(meta: PointMeta | undefined, enabled = true) {
  return useQuery({
    queryKey: ["griddata", meta?.gridId, meta?.gridX, meta?.gridY],
    queryFn: ({ signal }) => getGridSeries(meta!, signal),
    enabled: !!meta && enabled,
    staleTime: 1000 * 60 * 30,
  });
}

export function useNowcast(coords: Coordinates | null) {
  return useQuery({
    queryKey: ["nowcast", coords && key(coords.lat, coords.lon)],
    queryFn: ({ signal }) => getNowcast(coords!, signal),
    enabled: !!coords,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });
}

export function useAirQuality(coords: Coordinates | null) {
  return useQuery({
    queryKey: ["airquality", coords && key(coords.lat, coords.lon)],
    queryFn: ({ signal }) => getAirQuality(coords!, signal),
    enabled: !!coords,
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 60,
  });
}

export function useUv(coords: Coordinates | null) {
  return useQuery({
    queryKey: ["uv", coords && key(coords.lat, coords.lon)],
    queryFn: ({ signal }) => getUvIndex(coords!, signal),
    enabled: !!coords,
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 30,
  });
}

export function useTides(coords: Coordinates | null) {
  return useQuery({
    queryKey: ["tides", coords && key(coords.lat, coords.lon)],
    queryFn: ({ signal }) => getTides(coords!, signal),
    enabled: !!coords,
    staleTime: 1000 * 60 * 60,
  });
}

export function useStorms(coords: Coordinates | null) {
  return useQuery({
    queryKey: ["storms", coords && key(coords.lat, coords.lon)],
    queryFn: ({ signal }) => getNearbyStorms(coords!, signal),
    enabled: !!coords,
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 20,
  });
}

export function useRadarFrames() {
  return useQuery({
    queryKey: ["radar-frames"],
    queryFn: ({ signal }) => getRadarFrames(signal),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 3,
  });
}
