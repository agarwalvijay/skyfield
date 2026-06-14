import { useMemo, useState } from "react";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useGridSeries, useHourly } from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import { displayTempF, parseWindSpeedMph, displayWind } from "@/lib/format/units";
import { hourLabel } from "@/lib/format/time";
import { parseCondition } from "@/lib/weather/condition";
import { skyFor } from "@/lib/weather/sky";
import { WeatherGlyph } from "@/components/WeatherGlyph";
import { HourlyGraph } from "@/components/HourlyGraph";
import { Segmented } from "@/components/Segmented";
import { LoadingBlock, ErrorBlock } from "@/components/States";
import type { HourlyPeriod } from "@/lib/nws";

type View = "graph" | "list";

export function HourlyScreen() {
  const { meta, coords } = useWeatherCtx();
  const tz = meta?.timeZone;
  const hourly = useHourly(meta);
  const [view, setView] = useState<View>("graph");
  const grid = useGridSeries(meta, view === "graph");
  const { temp, wind, clock24h } = useSettings();

  // Group hours by day for the list view's section headers.
  const groups = useMemo(() => {
    const out: { day: string; items: HourlyPeriod[] }[] = [];
    for (const h of hourly.data ?? []) {
      const day = new Date(h.startTime).toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: tz,
      });
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(h);
      else out.push({ day, items: [h] });
    }
    return out;
  }, [hourly.data, tz]);

  return (
    <div className="scroll page">
      <div className="hourly-head">
        <h1 className="page-title display">Hourly</h1>
        <Segmented
          id="hview"
          value={view}
          onChange={setView}
          options={[
            { value: "graph", label: "Graph" },
            { value: "list", label: "List" },
          ]}
        />
      </div>

      {hourly.isLoading && <LoadingBlock lines={4} height={64} />}
      {hourly.error && <ErrorBlock onRetry={() => hourly.refetch()} />}

      {hourly.data && view === "graph" && (
        <HourlyGraph periods={hourly.data} grid={grid.data} coords={coords} timeZone={tz} />
      )}

      {hourly.data && view === "list" && (
        <>
          {groups.map((g) => (
            <section key={g.day} className="hour-group">
              <h2 className="section-title">{g.day}</h2>
              <div className="card hour-list">
                {g.items.map((h, i) => {
                  const cond = parseCondition(h.shortForecast, h.icon, h.isDaytime);
                  const pop = h.probabilityOfPrecipitation?.value ?? 0;
                  const mph = parseWindSpeedMph(h.windSpeed);
                  const isFirst = groups[0] === g && i === 0;
                  return (
                    <div className="hour-row" key={h.startTime}>
                      <span className="hour-time tabular">
                        {isFirst ? "Now" : hourLabel(h.startTime, clock24h, tz)}
                      </span>
                      <WeatherGlyph code={cond.code} isDay={cond.isDay} size={28} accent={skyFor(cond.code, cond.isDay).accent} animate={false} />
                      <span className="hour-desc muted">{h.shortForecast}</span>
                      <span className="hour-pop" style={{ opacity: pop >= 10 ? 1 : 0.25 }}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="#5db8ff">
                          <path d="M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13z" />
                        </svg>
                        {Math.round(pop)}%
                      </span>
                      <span className="hour-wind faint tabular">
                        {mph != null ? displayWind(mph * 1.609, wind) : "--"} {h.windDirection}
                      </span>
                      <span className="hour-temp display tabular">{displayTempF(h.temperature, temp)}°</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
