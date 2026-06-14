import type { ForecastPeriod } from "@/lib/nws";
import { groupDaily, rangeBounds } from "@/lib/weather/daily";
import { useSettings } from "@/store/settings";
import { displayTempF } from "@/lib/format/units";
import { parseCondition } from "@/lib/weather/condition";
import { WeatherGlyph } from "./WeatherGlyph";

/** Compact multi-day strip for the Now screen (Apple-Weather style). */
export function DailyForecastCard({
  periods,
  accent,
  days = 5,
  onSeeAll,
}: {
  periods: ForecastPeriod[];
  accent: string;
  days?: number;
  onSeeAll?: () => void;
}) {
  const { temp } = useSettings();
  const all = groupDaily(periods);
  const list = all.slice(0, days);
  const { gMin, gMax } = rangeBounds(all);
  const range = Math.max(gMax - gMin, 1);

  return (
    <div className="dailycard card">
      <div className="dailycard-head">
        <span className="eyebrow">{days}-Day Forecast</span>
        {onSeeAll && (
          <button className="dailycard-all" onClick={onSeeAll}>
            7-Day ›
          </button>
        )}
      </div>
      <div className="dailycard-list">
        {list.map((d, i) => {
          const rep = d.day ?? d.night!;
          const cond = parseCondition(rep.shortForecast, rep.icon, !!d.day);
          const lowPct = d.low != null ? ((d.low - gMin) / range) * 100 : 0;
          const highPct = d.high != null ? ((d.high - gMin) / range) * 100 : 100;
          return (
            <div className="dailycard-row" key={d.key}>
              <span className="dailycard-name">{i === 0 ? "Today" : d.name.slice(0, 3)}</span>
              <span className="dailycard-pop">
                {d.pop >= 20 ? <span style={{ color: "#7fd4ff" }}>{Math.round(d.pop)}%</span> : null}
              </span>
              <WeatherGlyph code={cond.code} isDay={cond.isDay} size={26} accent={accent} animate={false} />
              <span className="dailycard-low tabular">
                {d.low != null ? `${displayTempF(d.low, temp)}°` : "--"}
              </span>
              <span className="dailycard-bar">
                <span
                  className="dailycard-bar-fill"
                  style={{
                    left: `${lowPct}%`,
                    right: `${100 - highPct}%`,
                    background: `linear-gradient(90deg, #6fb0ff, ${accent})`,
                  }}
                />
              </span>
              <span className="dailycard-high tabular display">
                {d.high != null ? `${displayTempF(d.high, temp)}°` : "--"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
