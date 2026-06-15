import type { CSSProperties } from "react";
import {
  aqiColor,
  aqiAdvice,
  uvColor,
  uvBurnMinutes,
  uvAdvice,
  type AirQuality,
  type UvIndex,
} from "@/lib/weather/airquality";
import { sunTimes, moonPhase, moonEmoji } from "@/lib/weather/sun";

function fmtTime(d: Date | null, tz?: string): string {
  if (!d) return "--";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
}

function fmtDaylight(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

export function AirSunCard({
  air,
  uv,
  lat,
  lon,
  timeZone,
}: {
  air: AirQuality | null | undefined;
  uv: UvIndex | null | undefined;
  lat: number;
  lon: number;
  timeZone?: string;
}) {
  const now = new Date();
  const sun = sunTimes(now, lat, lon);
  const moon = moonPhase(now);
  const burn = uv ? uvBurnMinutes(uv.now) : null;

  // Lead with whichever health metric is more elevated for the one-line advice.
  const advice =
    air && uv
      ? air.usAqi > 100
        ? aqiAdvice(air.category)
        : uv.now >= 6
          ? uvAdvice(uv.category)
          : aqiAdvice(air.category)
      : air
        ? aqiAdvice(air.category)
        : uv
          ? uvAdvice(uv.category)
          : null;

  return (
    <div className="card airsun">
      <h2 className="section-title" style={{ margin: "0 0 12px" }}>
        Air &amp; Sun
      </h2>

      <div className="airsun-gauges">
        {air && (
          <div className="airsun-gauge">
            <div className="airsun-ring" style={{ "--c": aqiColor(air.category) } as CSSProperties}>
              <span className="airsun-num tabular">{air.usAqi}</span>
              <span className="airsun-cap">AQI</span>
            </div>
            <div className="airsun-label">{air.label}</div>
            {air.dominant && <div className="airsun-sub faint">{air.dominant} primary</div>}
          </div>
        )}

        {uv && (
          <div className="airsun-gauge">
            <div className="airsun-ring" style={{ "--c": uvColor(uv.category) } as CSSProperties}>
              <span className="airsun-num tabular">{Math.round(uv.now)}</span>
              <span className="airsun-cap">UV</span>
            </div>
            <div className="airsun-label">{uv.label}</div>
            <div className="airsun-sub faint">
              {burn ? `Burn ~${burn} min` : uv.max >= 3 ? `Peaks ${Math.round(uv.max)}` : "Minimal"}
            </div>
          </div>
        )}
      </div>

      {advice && <p className="airsun-advice">{advice}</p>}

      <div className="airsun-sky">
        <div className="airsun-cell">
          <span className="airsun-cell-cap faint">Sunrise</span>
          <span className="airsun-cell-val tabular">{fmtTime(sun.sunrise, timeZone)}</span>
        </div>
        <div className="airsun-cell">
          <span className="airsun-cell-cap faint">Sunset</span>
          <span className="airsun-cell-val tabular">{fmtTime(sun.sunset, timeZone)}</span>
        </div>
        <div className="airsun-cell">
          <span className="airsun-cell-cap faint">Daylight</span>
          <span className="airsun-cell-val tabular">{fmtDaylight(sun.daylightMinutes)}</span>
        </div>
        <div className="airsun-cell">
          <span className="airsun-cell-cap faint">Moon</span>
          <span className="airsun-cell-val">
            {moonEmoji(moon.phase)} {Math.round(moon.illumination * 100)}%
          </span>
          <span className="airsun-cell-cap faint" style={{ fontSize: "0.62rem" }}>
            {moon.name}
          </span>
        </div>
      </div>
    </div>
  );
}
