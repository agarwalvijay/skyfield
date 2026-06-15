import { lazy, Suspense } from "react";
import { useWeatherCtx } from "@/components/WeatherContext";
import {
  useCurrentConditions,
  useForecast,
  useHourly,
  useNowcast,
  useAirQuality,
  useUv,
  useStorms,
  useTides,
} from "@/hooks/useWeather";
import { useLocationStore } from "@/store/locations";
import { useSettings } from "@/store/settings";
import {
  degToCompass,
  displayPressure,
  displayTemp,
  displayTempF,
  displayVisibility,
  displayWind,
  windUnitLabel,
} from "@/lib/format/units";
import { relativeTime } from "@/lib/format/time";
import type { Condition } from "@/lib/weather/condition";
import { effectiveCondition } from "@/lib/weather/effective";
import type { SkyTheme } from "@/lib/weather/sky";
import type { WeatherAlert } from "@/lib/nws";
import { WeatherGlyph } from "@/components/WeatherGlyph";
import { MetricTile } from "@/components/MetricTile";
import { HourlyStrip } from "@/components/HourlyStrip";
import { NowcastCard } from "@/components/NowcastCard";
import { DailyForecastCard } from "@/components/DailyForecastCard";
import { AirSunCard } from "@/components/AirSunCard";
import { TidesCard } from "@/components/TidesCard";
import { TropicalBanner } from "@/components/TropicalBanner";
import { ErrorBlock } from "@/components/States";

const RadarMap = lazy(() =>
  import("@/components/RadarMap").then((m) => ({ default: m.RadarMap })),
);

/**
 * Single full-viewport dashboard for wide screens — everything at a glance,
 * no page scroll. Collapses to the tabbed mobile layout below the breakpoint
 * (handled in App).
 */
export function DashboardScreen({
  sky,
  alerts,
}: {
  sky: { cond: Condition; theme: SkyTheme };
  alerts: WeatherAlert[];
}) {
  const { meta, metaError, coords } = useWeatherCtx();
  const gps = useLocationStore((s) => s.gps);
  const { temp, wind, pressure, imperialDistance } = useSettings();

  const nowcast = useNowcast(coords);
  const radarLevel = nowcast.data?.radarLevel ?? 0;
  const current = useCurrentConditions(meta, radarLevel);
  const forecast = useForecast(meta);
  const hourly = useHourly(meta);
  const air = useAirQuality(coords);
  const uv = useUv(coords);
  const storms = useStorms(coords);
  const tides = useTides(coords);

  if (metaError) {
    return (
      <div className="dashboard dashboard-error">
        <ErrorBlock message="This location isn't covered by the US National Weather Service. Try a location inside the United States." />
      </div>
    );
  }

  const cur = current.data;
  const today = forecast.data?.[0];
  const high = forecast.data?.find((p) => p.isDaytime)?.temperature ?? today?.temperature ?? null;
  const low = forecast.data?.find((p) => !p.isDaytime)?.temperature ?? null;

  const condition = cur
    ? effectiveCondition({
        textDescription: cur.textDescription,
        icon: cur.icon,
        temperatureC: cur.temperatureC,
        radarLevel,
        isDayHint: sky.cond.isDay,
      })
    : sky.cond;

  const gpsCoords = gps ? { lat: gps.lat, lon: gps.lon } : null;
  const viewingGps = !!gps && coords?.lat === gps.lat && coords?.lon === gps.lon;

  return (
    <div className="dashboard">
      {/* ---- Left: current conditions ---- */}
      <section className="dash-col dash-now">
        <div className="card dash-hero">
          <div className="dash-hero-top">
            <WeatherGlyph
              code={condition.code}
              isDay={condition.isDay}
              size={84}
              accent={sky.theme.accent}
            />
            <div className="dash-hero-temp display tabular">
              {displayTemp(cur?.temperatureC ?? null, temp)}
              <span className="dash-deg">°</span>
            </div>
          </div>
          <div className="dash-hero-cond">
            {condition.label || cur?.textDescription || today?.shortForecast || "—"}
          </div>
          <div className="dash-hero-meta row">
            {cur?.feelsLikeC != null && <span>Feels {displayTemp(cur.feelsLikeC, temp)}°</span>}
            {high != null && (
              <span className="hero-hl">
                <b>H</b> {displayTempF(high, temp)}°
              </span>
            )}
            {low != null && (
              <span className="hero-hl">
                <b>L</b> {displayTempF(low, temp)}°
              </span>
            )}
          </div>
        </div>

        {cur && (
          <div className="metric-grid dash-metrics">
            <MetricTile
              label="Wind"
              value={displayWind(cur.windSpeedKph, wind)}
              unit={windUnitLabel(wind)}
              sub={degToCompass(cur.windDirectionDeg)}
            />
            <MetricTile
              label="Humidity"
              value={cur.humidityPct != null ? Math.round(cur.humidityPct) : "--"}
              unit="%"
            />
            <MetricTile
              label="Pressure"
              value={displayPressure(cur.pressurePa, pressure)}
              unit={pressure === "inHg" ? "inHg" : "hPa"}
            />
            <MetricTile
              label="Visibility"
              value={displayVisibility(cur.visibilityM, imperialDistance).split(" ")[0]}
              unit={imperialDistance ? "mi" : "km"}
            />
          </div>
        )}

        {(air.data || uv.data) && coords && (
          <AirSunCard
            air={air.data}
            uv={uv.data}
            lat={coords.lat}
            lon={coords.lon}
            timeZone={meta?.timeZone}
          />
        )}
      </section>

      {/* ---- Center: radar ---- */}
      <section className="dash-col dash-radar">
        {coords && (
          <div className="card dash-radar-card">
            <Suspense fallback={<div className="dash-radar-load skeleton" />}>
              <RadarMap forecast={coords} gps={gpsCoords} viewingGps={viewingGps} alerts={alerts} />
            </Suspense>
          </div>
        )}
        {nowcast.data && (
          <div className="dash-nowcast">
            <NowcastCard nowcast={nowcast.data} />
          </div>
        )}
      </section>

      {/* ---- Right: forecast ---- */}
      <section className="dash-col dash-fcst">
        {storms.data && storms.data.length > 0 && <TropicalBanner storms={storms.data} />}

        {hourly.data && hourly.data.length > 0 && (
          <HourlyStrip periods={hourly.data} accent={sky.theme.accent} timeZone={meta?.timeZone} />
        )}

        {forecast.data && forecast.data.length > 0 && (
          <DailyForecastCard periods={forecast.data} accent={sky.theme.accent} days={7} />
        )}

        {tides.data && <TidesCard tides={tides.data} timeZone={meta?.timeZone} />}

        {cur && (
          <p className="obs-credit faint">
            {cur.stationName ? `Observed at ${cur.stationName}` : "Latest observation"} ·{" "}
            {relativeTime(cur.timestamp)}
          </p>
        )}
      </section>
    </div>
  );
}
