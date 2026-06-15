import { useState } from "react";
import { motion } from "motion/react";
import { useWeatherCtx } from "@/components/WeatherContext";
import {
  useCurrentConditions,
  useForecast,
  useHourly,
  useNowcast,
  useOutlook,
  useAirQuality,
  useUv,
  useTides,
  useStorms,
  useGridSeries,
} from "@/hooks/useWeather";
import { accumulation } from "@/lib/nws";
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
import { type Condition } from "@/lib/weather/condition";
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
import { LoadingBlock, ErrorBlock } from "@/components/States";

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export function NowScreen({
  sky,
  alerts,
  onSeeDaily,
}: {
  sky: { cond: Condition; theme: SkyTheme };
  alerts: WeatherAlert[];
  onSeeDaily?: () => void;
}) {
  const { meta, metaLoading, metaError, coords } = useWeatherCtx();
  const nowcast = useNowcast(coords);
  const current = useCurrentConditions(meta, nowcast.data?.radarLevel ?? 0);
  const forecast = useForecast(meta);
  const hourly = useHourly(meta);
  const outlook = useOutlook(meta);
  const air = useAirQuality(coords);
  const uv = useUv(coords);
  const tides = useTides(coords);
  const storms = useStorms(coords);
  const grid = useGridSeries(meta);
  const [outlookOpen, setOutlookOpen] = useState(false);
  const { temp, wind, pressure, imperialDistance } = useSettings();

  // Upcoming precip totals (next 24h) from the NWS grid.
  const accum = grid.data ? accumulation(grid.data, 24) : null;
  const inches = (mm: number) => mm / 25.4;

  // Only surface the HWO while it's current (offices issue them daily).
  const freshOutlook =
    outlook.data &&
    Date.now() - new Date(outlook.data.issuanceTime).getTime() < 24 * 3600 * 1000
      ? outlook.data
      : null;

  if (metaError) {
    return (
      <div className="scroll page">
        <div style={{ height: 80 }} />
        <ErrorBlock message="This location isn't covered by the US National Weather Service. Try a location inside the United States." />
      </div>
    );
  }

  const cur = current.data;
  const today = forecast.data?.[0];
  const tonight = forecast.data?.find((p) => !p.isDaytime);
  const high = forecast.data?.find((p) => p.isDaytime)?.temperature ?? today?.temperature ?? null;
  const low = tonight?.temperature ?? null;

  // Radar-driven during precip; otherwise the station's reported condition.
  const condition = cur
    ? effectiveCondition({
        textDescription: cur.textDescription,
        icon: cur.icon,
        temperatureC: cur.temperatureC,
        radarLevel: nowcast.data?.radarLevel ?? 0,
        isDayHint: sky.cond.isDay,
      })
    : sky.cond;

  return (
    <div className="scroll page">
      {/* ---- Hero ---- */}
      <motion.section className="hero" {...fade} transition={{ duration: 0.5 }}>
        <div className="hero-main">
          <div className="hero-glyph">
            <WeatherGlyph
              code={condition.code}
              isDay={condition.isDay}
              size={108}
              accent={sky.theme.accent}
            />
          </div>

          {metaLoading || (current.isLoading && !cur) ? (
            <div className="hero-temp-skel skeleton" />
          ) : (
            <div className="hero-temp display tabular">
              {displayTemp(cur?.temperatureC ?? null, temp)}
              <span className="hero-deg">°</span>
            </div>
          )}
        </div>

        <div className="hero-cond">{condition.label || cur?.textDescription || today?.shortForecast || "—"}</div>

        <div className="hero-meta row">
          {cur?.feelsLikeC != null && (
            <span>Feels {displayTemp(cur.feelsLikeC, temp)}°</span>
          )}
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
      </motion.section>

      {/* ---- Active tropical cyclone nearby ---- */}
      {storms.data && storms.data.length > 0 && (
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.03 }}>
          <TropicalBanner storms={storms.data} />
        </motion.div>
      )}

      {/* ---- Hazardous Weather Outlook ---- */}
      {freshOutlook && (
        <motion.button
          className="card outlook pressable"
          {...fade}
          transition={{ duration: 0.5, delay: 0.04 }}
          onClick={() => setOutlookOpen((o) => !o)}
        >
          <div className="outlook-head row">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--warn)" strokeWidth="2">
              <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" />
            </svg>
            <span className="outlook-title">Hazardous Weather Outlook</span>
            <span className="faint outlook-meta">{freshOutlook.wfo} · {relativeTime(freshOutlook.issuanceTime)}</span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              style={{ transform: outlookOpen ? "rotate(180deg)" : undefined, transition: "transform 0.25s" }}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {outlookOpen && <pre className="afd outlook-text">{freshOutlook.text}</pre>}
        </motion.button>
      )}

      {/* ---- Hourly strip ---- */}
      {hourly.data && hourly.data.length > 0 && (
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.06 }}>
          <HourlyStrip periods={hourly.data} accent={sky.theme.accent} timeZone={meta?.timeZone} />
        </motion.div>
      )}

      {/* ---- MinuteCast ---- */}
      {nowcast.data && (
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.08 }}>
          <NowcastCard nowcast={nowcast.data} />
        </motion.div>
      )}

      {/* ---- Upcoming precip totals (next 24h) ---- */}
      {accum && (accum.rainMm >= 0.3 || accum.snowMm >= 1) && (
        <motion.div className="accum-pills" {...fade} transition={{ duration: 0.5, delay: 0.09 }}>
          {accum.rainMm >= 0.3 && (
            <div className="accum-pill">
              <span className="accum-icon">💧</span>
              <div>
                <div className="accum-val tabular">
                  {imperialDistance ? `${inches(accum.rainMm).toFixed(2)} in` : `${accum.rainMm.toFixed(1)} mm`}
                </div>
                <div className="accum-cap">Rain · next 24h</div>
              </div>
            </div>
          )}
          {accum.snowMm >= 1 && (
            <div className="accum-pill">
              <span className="accum-icon">❄️</span>
              <div>
                <div className="accum-val tabular">
                  {imperialDistance ? `${inches(accum.snowMm).toFixed(1)} in` : `${accum.snowMm.toFixed(0)} mm`}
                </div>
                <div className="accum-cap">Snow · next 24h</div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ---- Multi-day forecast ---- */}
      {forecast.data && forecast.data.length > 0 && (
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.1 }}>
          <DailyForecastCard periods={forecast.data} accent={sky.theme.accent} days={5} onSeeAll={onSeeDaily} />
        </motion.div>
      )}

      {/* ---- Air & Sun (AQI · UV · sun/moon) ---- */}
      {coords && (air.data || uv.data) && (
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.11 }}>
          <AirSunCard
            air={air.data}
            uv={uv.data}
            lat={coords.lat}
            lon={coords.lon}
            timeZone={meta?.timeZone}
          />
        </motion.div>
      )}

      {/* ---- Tides (coastal only) ---- */}
      {tides.data && (
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.12 }}>
          <TidesCard tides={tides.data} timeZone={meta?.timeZone} />
        </motion.div>
      )}

      {/* ---- Today's narrative ---- */}
      {today && (
        <motion.div className="card narrative" {...fade} transition={{ duration: 0.5, delay: 0.1 }}>
          <span className="eyebrow">{today.name}</span>
          <p>{today.detailedForecast}</p>
          {tonight && tonight !== today && (
            <>
              <span className="eyebrow" style={{ marginTop: 12, display: "block" }}>
                {tonight.name}
              </span>
              <p>{tonight.detailedForecast}</p>
            </>
          )}
        </motion.div>
      )}

      {/* ---- Conditions grid ---- */}
      <motion.div {...fade} transition={{ duration: 0.5, delay: 0.14 }}>
        <h2 className="section-title">Conditions</h2>
        {current.isLoading && !cur ? (
          <LoadingBlock lines={1} height={170} />
        ) : cur ? (
          <div className="metric-grid">
            <MetricTile
              label="Wind"
              value={displayWind(cur.windSpeedKph, wind)}
              unit={windUnitLabel(wind)}
              sub={`${degToCompass(cur.windDirectionDeg)}${
                cur.windGustKph ? ` · gusts ${displayWind(cur.windGustKph, wind)}` : ""
              }`}
            />
            <MetricTile
              label="Humidity"
              value={cur.humidityPct != null ? Math.round(cur.humidityPct) : "--"}
              unit="%"
              sub={cur.dewpointC != null ? `Dew pt ${displayTemp(cur.dewpointC, temp)}°` : undefined}
            />
            <MetricTile
              label="Feels Like"
              value={displayTemp(cur.feelsLikeC, temp)}
              unit="°"
              sub={cur.cloudLayer ? cur.cloudLayer.toLowerCase() : undefined}
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
            <MetricTile
              label="Dew Point"
              value={displayTemp(cur.dewpointC, temp)}
              unit="°"
            />
          </div>
        ) : (
          <div className="state-msg card faint">No nearby station is reporting observations right now.</div>
        )}

        {cur && (
          <p className="obs-credit faint">
            {cur.stationName ? `Observed at ${cur.stationName}` : "Latest observation"} ·{" "}
            {relativeTime(cur.timestamp)}
          </p>
        )}
      </motion.div>

      {alerts.length > 0 && <div style={{ height: 8 }} />}
    </div>
  );
}
