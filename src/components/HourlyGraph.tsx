import { useMemo, useRef, useState } from "react";
import type { HourlyPeriod, GridSeries } from "@/lib/nws";
import { useSettings } from "@/store/settings";
import {
  compassToDeg,
  cToF,
  displayTempF,
  displayWind,
  parseWindSpeedMph,
  windUnitLabel,
} from "@/lib/format/units";
import { dayShort, hourLabel } from "@/lib/format/time";
import { isDaylight } from "@/lib/weather/sun";
import type { Coordinates } from "@/lib/nws";

const PX = 22; // px per hour
const PAD_L = 10;
const PAD_R = 14;
const ARROW_Y = 16;
const PLOT_TOP = 34;
const PLOT_H = 230;
const HOUR_Y = PLOT_TOP + PLOT_H + 20;
const SVG_H = HOUR_Y + 10;
const PRECIP_H = 96;

const SERIES = {
  temp: { label: "Temp", color: "#ffd166" },
  feels: { label: "Feels Like", color: "#ff6b6b" },
  dew: { label: "Dew Pt", color: "#ff9f43" },
  humidity: { label: "Humidity", color: "#e879f9" },
  wind: { label: "Wind", color: "#4ade80" },
  gust: { label: "Gusts", color: "#22d3ee" },
  cloud: { label: "Clouds", color: "#cbd5e1" },
  pop: { label: "Precip %", color: "#5db8ff" },
} as const;

type SeriesKey = keyof typeof SERIES;

/** Series that come from gridpoint data rather than the hourly forecast. */
const GRID_ONLY: SeriesKey[] = ["cloud", "feels", "gust"];
/** Off by default to keep the first view readable (mirrors the original). */
const DEFAULT_OFF: SeriesKey[] = ["feels", "dew", "gust"];

interface Pt {
  x: number;
  v: number | null;
}

/** Build path segments, breaking the line at null gaps. */
function segments(pts: Pt[], y: (v: number) => number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const p of pts) {
    if (p.v == null) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur += cur ? ` L ${p.x} ${y(p.v)}` : `M ${p.x} ${y(p.v)}`;
  }
  if (cur) out.push(cur);
  return out;
}

export function HourlyGraph({
  periods,
  grid,
  coords,
  timeZone,
}: {
  periods: HourlyPeriod[];
  grid: GridSeries | undefined;
  coords: Coordinates | null;
  timeZone?: string;
}) {
  const { temp, wind, clock24h, imperialDistance } = useSettings();
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set(DEFAULT_OFF));
  const [scrub, setScrub] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const hours = useMemo(() => periods.slice(0, 72), [periods]);

  const data = useMemo(() => {
    return hours.map((h, i) => {
      const eh = Math.floor(Date.parse(h.startTime) / 3_600_000);
      // Real solar day/night (NWS isDaytime is a fixed 6am–6pm convention).
      const mid = new Date(Date.parse(h.startTime) + 30 * 60_000);
      const isDay = coords ? isDaylight(mid, coords.lat, coords.lon) : h.isDaytime;
      return {
        x: PAD_L + i * PX + PX / 2,
        time: h.startTime,
        isDay,
        tempF: h.temperatureUnit === "C" ? cToF(h.temperature) : h.temperature,
        feelsF: grid?.apparentC.has(eh) ? cToF(grid.apparentC.get(eh)!) : null,
        dewF: h.dewpoint?.value != null ? cToF(h.dewpoint.value) : null,
        gustMph: grid?.gustKmh.has(eh) ? grid.gustKmh.get(eh)! / 1.609 : null,
        humidity: h.relativeHumidity?.value ?? null,
        pop: h.probabilityOfPrecipitation?.value ?? null,
        windMph: parseWindSpeedMph(h.windSpeed),
        windDir: h.windDirection,
        cloud: grid?.skyCover.get(eh) ?? null,
        qpfMm: grid?.qpfMm.get(eh) ?? 0,
        snowMm: grid?.snowMm.get(eh) ?? 0,
      };
    });
  }, [hours, grid, coords]);

  const width = PAD_L + hours.length * PX + PAD_R;

  // Per-family vertical scales so each series reads on its own range.
  // Temperature (with feels/dew) auto-fits the day's actual min→max, so the
  // daily high AND low are clearly visible instead of squished near the top of
  // a fixed 0–100 axis. The left axis is labeled in degrees (the headline
  // series); % series (humidity/precip/cloud) and wind keep their own scaling.
  const tempRange = useMemo(() => {
    const vals: number[] = [];
    for (const d of data) {
      if (!hidden.has("temp") && d.tempF != null) vals.push(d.tempF);
      if (!hidden.has("feels") && d.feelsF != null) vals.push(d.feelsF);
      if (!hidden.has("dew") && d.dewF != null) vals.push(d.dewF);
    }
    if (!vals.length) return { lo: 0, hi: 100 };
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(4, (hi - lo) * 0.18);
    return { lo: lo - pad, hi: hi + pad };
  }, [data, hidden]);

  const windMax = useMemo(() => {
    let m = 1;
    for (const d of data) m = Math.max(m, d.windMph ?? 0, d.gustMph ?? 0);
    return m * 1.1;
  }, [data]);

  const tempTicks = useMemo(() => {
    const { lo, hi } = tempRange;
    return [0, 1, 2, 3, 4].map((i) => Math.round(lo + ((hi - lo) * i) / 4));
  }, [tempRange]);

  const yTemp = (v: number) =>
    PLOT_TOP + (1 - (v - tempRange.lo) / (tempRange.hi - tempRange.lo)) * PLOT_H;
  const yPct = (v: number) => PLOT_TOP + (1 - v / 100) * PLOT_H;
  const yWind = (v: number) => PLOT_TOP + (1 - v / windMax) * PLOT_H;

  // Per-day high & low temperature points, marked directly on the curve.
  const extrema = useMemo(() => {
    if (hidden.has("temp")) return [] as { x: number; v: number; kind: "high" | "low" }[];
    const byDay = new Map<string, { hiI: number; hiV: number; loI: number; loV: number }>();
    data.forEach((d, i) => {
      if (d.tempF == null) return;
      const k = dayShort(d.time, timeZone);
      const e = byDay.get(k);
      if (!e) byDay.set(k, { hiI: i, hiV: d.tempF, loI: i, loV: d.tempF });
      else {
        if (d.tempF > e.hiV) {
          e.hiV = d.tempF;
          e.hiI = i;
        }
        if (d.tempF < e.loV) {
          e.loV = d.tempF;
          e.loI = i;
        }
      }
    });
    const out: { x: number; v: number; kind: "high" | "low" }[] = [];
    for (const e of byDay.values()) {
      out.push({ x: data[e.hiI].x, v: e.hiV, kind: "high" });
      if (e.loI !== e.hiI) out.push({ x: data[e.loI].x, v: e.loV, kind: "low" });
    }
    return out;
  }, [data, hidden, timeZone]);

  // Night shading bands.
  const nights = useMemo(() => {
    const bands: { x0: number; x1: number }[] = [];
    let start: number | null = null;
    data.forEach((d, i) => {
      if (!d.isDay && start == null) start = PAD_L + i * PX;
      if (d.isDay && start != null) {
        bands.push({ x0: start, x1: PAD_L + i * PX });
        start = null;
      }
    });
    if (start != null) bands.push({ x0: start, x1: width - PAD_R });
    return bands;
  }, [data, width]);

  // Day boundaries (midnight) for labels.
  const dayMarks = useMemo(() => {
    const marks: { x: number; label: string }[] = [];
    let prev = "";
    data.forEach((d, i) => {
      const day = dayShort(d.time, timeZone);
      if (day !== prev) {
        marks.push({ x: PAD_L + i * PX, label: day });
        prev = day;
      }
    });
    return marks;
  }, [data, timeZone]);

  // Precipitation amounts chart scale.
  const mmToDisplay = (mm: number) => (imperialDistance ? mm / 25.4 : mm);
  const precipUnit = imperialDistance ? "in" : "mm";
  const precipMax = useMemo(() => {
    let m = 0;
    for (const d of data) m = Math.max(m, mmToDisplay(d.qpfMm), mmToDisplay(d.snowMm));
    return Math.max(m, imperialDistance ? 0.05 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, imperialDistance]);
  const hasPrecip = data.some((d) => d.qpfMm > 0.01 || d.snowMm > 0.01);

  const toggle = (k: SeriesKey) =>
    setHidden((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const show = (k: SeriesKey) => !hidden.has(k);

  // ---- Scrubbing ----
  const onPointer = (e: React.PointerEvent) => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - PAD_L;
    const idx = Math.round((x - PX / 2) / PX);
    setScrub(Math.max(0, Math.min(hours.length - 1, idx)));
  };

  const sd = scrub != null ? data[scrub] : null;
  const tooltipFlip = sd != null && sd.x > width - 170;

  return (
    <div className="hgraph card">
      <div className="hgraph-legend">
        {(Object.keys(SERIES) as SeriesKey[]).map((k) => {
          const needsGrid = GRID_ONLY.includes(k) && !grid;
          const off = !show(k) || needsGrid;
          return (
            <button
              key={k}
              className="hgraph-chip"
              data-off={off}
              onClick={() => toggle(k)}
              disabled={needsGrid}
            >
              <i style={{ background: SERIES[k].color }} />
              {SERIES[k].label}
            </button>
          );
        })}
      </div>

      <div className="hgraph-plot">
        {/* Y-axis labels pinned outside the scroll area. */}
        <div className="hg-axis-pin" aria-hidden="true">
          {tempTicks.map((t) => (
            <span key={t} style={{ top: yTemp(t) }}>
              {displayTempF(t, temp)}°
            </span>
          ))}
          <span style={{ top: SVG_H + 14 }}>
            {precipMax.toFixed(imperialDistance ? 2 : 1)} {precipUnit}
          </span>
        </div>

        <div
          className="hgraph-scroll"
          onPointerDown={onPointer}
          onPointerMove={(e) => e.buttons > 0 && onPointer(e)}
          onPointerUp={() => setScrub(null)}
          onPointerLeave={() => setScrub(null)}
        >
          <div ref={contentRef} style={{ width, position: "relative" }}>
          <svg width={width} height={SVG_H}>
            {/* Night bands */}
            {nights.map((n, i) => (
              <rect
                key={i}
                x={n.x0}
                y={PLOT_TOP - 6}
                width={n.x1 - n.x0}
                height={PLOT_H + 12}
                fill="rgba(2,6,18,0.35)"
                rx={6}
              />
            ))}

            {/* Gridlines at the temperature ticks. */}
            {tempTicks.map((t) => (
              <line
                key={t}
                x1={PAD_L}
                x2={width - PAD_R}
                y1={yTemp(t)}
                y2={yTemp(t)}
                stroke="rgba(255,255,255,0.08)"
              />
            ))}

            {/* Day boundary markers */}
            {dayMarks.map((m) => (
              <g key={m.x}>
                <line
                  x1={m.x}
                  x2={m.x}
                  y1={PLOT_TOP - 20}
                  y2={PLOT_TOP + PLOT_H}
                  stroke="rgba(255,255,255,0.14)"
                  strokeDasharray="3 4"
                />
                <text x={m.x + 5} y={PLOT_TOP - 8} className="hg-day">
                  {m.label}
                </text>
              </g>
            ))}

            {/* Wind direction arrows (every 2h) */}
            {show("wind") &&
              data.map((d, i) => {
                if (i % 3 !== 0) return null;
                const from = compassToDeg(d.windDir ?? "");
                if (from == null) return null;
                const to = from + 180;
                return (
                  <g key={`a${i}`} transform={`translate(${d.x} ${ARROW_Y}) rotate(${to})`}>
                    <path
                      d="M0 5 L0 -3 M0 -5 L-3.5 0 M0 -5 L3.5 0"
                      stroke={SERIES.wind.color}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </g>
                );
              })}

            {/* Series lines */}
            {show("cloud") &&
              grid &&
              segments(data.map((d) => ({ x: d.x, v: d.cloud })), yPct).map((p, i) => (
                <path key={`c${i}`} d={p} fill="none" stroke={SERIES.cloud.color} strokeWidth="1.6" opacity="0.75" />
              ))}
            {show("pop") &&
              segments(data.map((d) => ({ x: d.x, v: d.pop })), yPct).map((p, i) => (
                <path key={`p${i}`} d={p} fill="none" stroke={SERIES.pop.color} strokeWidth="2" />
              ))}
            {show("humidity") &&
              segments(data.map((d) => ({ x: d.x, v: d.humidity })), yPct).map((p, i) => (
                <path key={`h${i}`} d={p} fill="none" stroke={SERIES.humidity.color} strokeWidth="2" />
              ))}
            {show("wind") &&
              segments(data.map((d) => ({ x: d.x, v: d.windMph })), yWind).map((p, i) => (
                <path key={`w${i}`} d={p} fill="none" stroke={SERIES.wind.color} strokeWidth="2" />
              ))}
            {show("gust") &&
              segments(data.map((d) => ({ x: d.x, v: d.gustMph })), yWind).map((p, i) => (
                <path key={`g${i}`} d={p} fill="none" stroke={SERIES.gust.color} strokeWidth="1.8" strokeDasharray="4 3" />
              ))}
            {show("dew") &&
              segments(data.map((d) => ({ x: d.x, v: d.dewF })), yTemp).map((p, i) => (
                <path key={`d${i}`} d={p} fill="none" stroke={SERIES.dew.color} strokeWidth="2" />
              ))}
            {show("feels") &&
              segments(data.map((d) => ({ x: d.x, v: d.feelsF })), yTemp).map((p, i) => (
                <path key={`f${i}`} d={p} fill="none" stroke={SERIES.feels.color} strokeWidth="2" strokeDasharray="6 4" />
              ))}
            {show("temp") &&
              segments(data.map((d) => ({ x: d.x, v: d.tempF })), yTemp).map((p, i) => (
                <path key={`t${i}`} d={p} fill="none" stroke={SERIES.temp.color} strokeWidth="2.6" />
              ))}

            {/* Per-day high / low markers */}
            {show("temp") &&
              extrema.map((e, k) => {
                const color = e.kind === "high" ? SERIES.temp.color : "#8ec5ff";
                return (
                  <g key={`ex${k}`}>
                    <circle cx={e.x} cy={yTemp(e.v)} r={3.4} fill={color} />
                    <text
                      x={e.x}
                      y={e.kind === "high" ? yTemp(e.v) - 9 : yTemp(e.v) + 17}
                      className="hg-val"
                      fill={color}
                      textAnchor="middle"
                    >
                      {e.kind === "high" ? "↑" : "↓"}
                      {displayTempF(e.v, temp)}°
                    </text>
                  </g>
                );
              })}

            {/* Hour labels */}
            {data.map((d, i) =>
              i % 3 === 0 ? (
                <text key={`x${i}`} x={d.x} y={HOUR_Y} className="hg-hour">
                  {hourLabel(d.time, clock24h, timeZone)}
                </text>
              ) : null,
            )}

            {/* Scrub line */}
            {sd && (
              <line x1={sd.x} x2={sd.x} y1={PLOT_TOP - 22} y2={PLOT_TOP + PLOT_H} stroke="#fff" strokeWidth="1.2" opacity="0.85" />
            )}
          </svg>

          {/* Precip amounts chart */}
          <svg width={width} height={PRECIP_H + 26} className="hg-precip">
            {nights.map((n, i) => (
              <rect key={i} x={n.x0} y={0} width={n.x1 - n.x0} height={PRECIP_H} fill="rgba(2,6,18,0.35)" rx={6} />
            ))}
            <line x1={PAD_L} x2={width - PAD_R} y1={PRECIP_H} y2={PRECIP_H} stroke="rgba(255,255,255,0.14)" />
            {!hasPrecip && (
              <text x={PAD_L + 4} y={PRECIP_H - 10} className="hg-noprecip">
                No precipitation expected
              </text>
            )}
            {data.map((d, i) => {
              const qh = (mmToDisplay(d.qpfMm) / precipMax) * (PRECIP_H - 18);
              const sh = (mmToDisplay(d.snowMm) / precipMax) * (PRECIP_H - 18);
              return (
                <g key={`pb${i}`}>
                  {qh > 0.5 && (
                    <rect x={d.x - 7} y={PRECIP_H - qh} width={sh > 0.5 ? 7 : 14} height={qh} rx={2} fill="#5db8ff" opacity={0.85} />
                  )}
                  {sh > 0.5 && (
                    <rect x={d.x + 0.5} y={PRECIP_H - sh} width={7} height={sh} rx={2} fill="#eef3fb" opacity={0.9} />
                  )}
                </g>
              );
            })}
            {sd && <line x1={sd.x} x2={sd.x} y1={0} y2={PRECIP_H} stroke="#fff" strokeWidth="1.2" opacity="0.85" />}
            <text x={PAD_L} y={PRECIP_H + 18} className="hg-precip-legend">
              <tspan fill="#5db8ff">▪ Liquid (QPF)</tspan>
              <tspan fill="#eef3fb" dx="12">▪ Snow</tspan>
              <tspan fill="rgba(243,246,252,0.4)" dx="12">{precipUnit}/hr</tspan>
            </text>
          </svg>

          {/* Scrub tooltip */}
          {sd && (
            <div
              className="hg-tip"
              style={{ left: tooltipFlip ? sd.x - 158 : sd.x + 10, top: 30 }}
            >
              <div className="hg-tip-time">
                {dayShort(sd.time, timeZone)} · {hourLabel(sd.time, clock24h, timeZone)}
              </div>
              {sd.tempF != null && show("temp") && (
                <div><i style={{ background: SERIES.temp.color }} />{displayTempF(sd.tempF, temp)}°</div>
              )}
              {sd.feelsF != null && show("feels") && (
                <div><i style={{ background: SERIES.feels.color }} />feels {displayTempF(sd.feelsF, temp)}°</div>
              )}
              {sd.dewF != null && show("dew") && (
                <div><i style={{ background: SERIES.dew.color }} />dew pt {displayTempF(sd.dewF, temp)}°</div>
              )}
              {sd.humidity != null && show("humidity") && (
                <div><i style={{ background: SERIES.humidity.color }} />{Math.round(sd.humidity)}% humidity</div>
              )}
              {sd.windMph != null && show("wind") && (
                <div>
                  <i style={{ background: SERIES.wind.color }} />
                  {displayWind(sd.windMph * 1.609, wind)} {windUnitLabel(wind)} {sd.windDir}
                </div>
              )}
              {sd.gustMph != null && show("gust") && (
                <div>
                  <i style={{ background: SERIES.gust.color }} />
                  gusts {displayWind(sd.gustMph * 1.609, wind)} {windUnitLabel(wind)}
                </div>
              )}
              {sd.cloud != null && show("cloud") && (
                <div><i style={{ background: SERIES.cloud.color }} />{Math.round(sd.cloud)}% clouds</div>
              )}
              {sd.pop != null && show("pop") && (
                <div><i style={{ background: SERIES.pop.color }} />{Math.round(sd.pop)}% precip</div>
              )}
              {(sd.qpfMm > 0.01 || sd.snowMm > 0.01) && (
                <div>
                  <i style={{ background: "#5db8ff" }} />
                  {mmToDisplay(sd.qpfMm + sd.snowMm).toFixed(2)} {precipUnit}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
      <p className="hgraph-hint faint">Touch and hold the chart to read exact values · scroll for 3 days</p>
    </div>
  );
}
