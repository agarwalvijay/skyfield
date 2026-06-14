import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useForecast } from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import { displayTempF } from "@/lib/format/units";
import { parseCondition } from "@/lib/weather/condition";
import { WeatherGlyph } from "@/components/WeatherGlyph";
import { LoadingBlock, ErrorBlock } from "@/components/States";
import { groupDaily, rangeBounds } from "@/lib/weather/daily";

export function DailyScreen({ accent }: { accent: string }) {
  const { meta } = useWeatherCtx();
  const forecast = useForecast(meta);
  const { temp } = useSettings();
  const [open, setOpen] = useState<string | null>(null);

  const days = useMemo(() => groupDaily(forecast.data ?? []), [forecast.data]);
  const { gMin, gMax } = useMemo(() => rangeBounds(days), [days]);

  return (
    <div className="scroll page">
      <h1 className="page-title display">7-Day</h1>

      {forecast.isLoading && <LoadingBlock lines={6} height={56} />}
      {forecast.error && <ErrorBlock onRetry={() => forecast.refetch()} />}

      {days.length > 0 && (
        <div className="card daily-list">
          {days.map((d, i) => {
            const rep = d.day ?? d.night!;
            const cond = parseCondition(rep.shortForecast, rep.icon, !!d.day);
            const range = Math.max(gMax - gMin, 1);
            const lowPct = d.low != null ? ((d.low - gMin) / range) * 100 : 0;
            const highPct = d.high != null ? ((d.high - gMin) / range) * 100 : 100;
            const isOpen = open === d.key;
            return (
              <div key={d.key} className="daily-wrap">
                <button
                  className="daily-row pressable"
                  onClick={() => setOpen(isOpen ? null : d.key)}
                >
                  <span className="daily-name">{i === 0 ? "Today" : d.name}</span>
                  <span className="daily-pop">
                    {d.pop >= 10 ? (
                      <span style={{ color: "#7fd4ff" }}>{Math.round(d.pop)}%</span>
                    ) : null}
                  </span>
                  <WeatherGlyph code={cond.code} isDay={cond.isDay} size={30} accent={accent} animate={false} />
                  <span className="daily-low tabular faint">
                    {d.low != null ? `${displayTempF(d.low, temp)}°` : "--"}
                  </span>
                  <span className="daily-bar">
                    <span
                      className="daily-bar-fill"
                      style={{
                        left: `${lowPct}%`,
                        right: `${100 - highPct}%`,
                        background: `linear-gradient(90deg, #6fb0ff, ${accent})`,
                      }}
                    />
                  </span>
                  <span className="daily-high tabular display">
                    {d.high != null ? `${displayTempF(d.high, temp)}°` : "--"}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="daily-detail"
                    >
                      <div className="daily-detail-inner">
                        {d.day && (
                          <p>
                            <b>{d.day.name}.</b> {d.day.detailedForecast}
                          </p>
                        )}
                        {d.night && (
                          <p>
                            <b>{d.night.name}.</b> {d.night.detailedForecast}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
