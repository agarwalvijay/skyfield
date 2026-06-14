import type { HourlyPeriod } from "@/lib/nws";
import { useSettings } from "@/store/settings";
import { displayTempF } from "@/lib/format/units";
import { hourLabel } from "@/lib/format/time";
import { parseCondition } from "@/lib/weather/condition";
import { WeatherGlyph } from "./WeatherGlyph";

/** Horizontal scroll of the next N hours. Used on the Now screen. */
export function HourlyStrip({
  periods,
  accent,
  timeZone,
}: {
  periods: HourlyPeriod[];
  accent: string;
  timeZone?: string;
}) {
  const { temp, clock24h } = useSettings();
  const slice = periods.slice(0, 24);

  return (
    <div className="hstrip card">
      {slice.map((h, i) => {
        const cond = parseCondition(h.shortForecast, h.icon, h.isDaytime);
        const pop = h.probabilityOfPrecipitation?.value ?? 0;
        return (
          <div className="hstrip-item" key={h.startTime}>
            <span className="hstrip-time faint">
              {i === 0 ? "Now" : hourLabel(h.startTime, clock24h, timeZone)}
            </span>
            <WeatherGlyph code={cond.code} isDay={cond.isDay} size={30} accent={accent} animate={false} />
            {pop >= 15 ? (
              <span className="hstrip-pop" style={{ color: "#7fd4ff" }}>
                {Math.round(pop)}%
              </span>
            ) : (
              <span className="hstrip-pop" style={{ opacity: 0 }}>
                0%
              </span>
            )}
            <span className="hstrip-temp tabular">{displayTempF(h.temperature, temp)}°</span>
          </div>
        );
      })}
    </div>
  );
}
