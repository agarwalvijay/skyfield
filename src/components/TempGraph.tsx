import { useMemo } from "react";
import type { HourlyPeriod } from "@/lib/nws";
import { useSettings } from "@/store/settings";
import { displayTempF } from "@/lib/format/units";
import { hourLabel } from "@/lib/format/time";

/**
 * Compact SVG temperature curve with precipitation-probability bars beneath.
 * Renders the next `count` hours.
 */
export function TempGraph({
  periods,
  count = 24,
  accent,
}: {
  periods: HourlyPeriod[];
  count?: number;
  accent: string;
}) {
  const { temp, clock24h } = useSettings();
  const data = periods.slice(0, count);

  const { path, area, points, min, max, w, h } = useMemo(() => {
    const w = Math.max(data.length * 46, 320);
    const h = 120;
    const padTop = 22;
    const padBottom = 30;
    const temps = data.map((d) => d.temperature);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const range = Math.max(max - min, 1);
    const stepX = w / Math.max(data.length - 1, 1);

    const pts = data.map((d, i) => {
      const x = i * stepX;
      const y = padTop + (1 - (d.temperature - min) / range) * (h - padTop - padBottom);
      return { x, y, d };
    });

    const path = pts
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
    const area = `${path} L ${w} ${h} L 0 ${h} Z`;
    return { path, area, points: pts, min, max, w, h };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="tempgraph card">
      <div className="tempgraph-scroll">
        <svg width={w} height={h + 44} viewBox={`0 0 ${w} ${h + 44}`} className="tempgraph-svg">
          <defs>
            <linearGradient id="tg-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity="0.35" />
              <stop offset="1" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* precip bars */}
          {points.map((p, i) => {
            const pop = data[i].probabilityOfPrecipitation?.value ?? 0;
            if (pop < 5) return null;
            const barH = (pop / 100) * 26;
            return (
              <rect
                key={`b${i}`}
                x={p.x - 5}
                y={h - barH}
                width={10}
                height={barH}
                rx={3}
                fill="#5db8ff"
                opacity={0.5}
              />
            );
          })}

          <path d={area} fill="url(#tg-fill)" />
          <path d={path} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => (
            <g key={`p${i}`}>
              <circle cx={p.x} cy={p.y} r={2.6} fill={accent} />
              <text x={p.x} y={p.y - 10} className="tg-temp" textAnchor="middle">
                {displayTempF(p.d.temperature, temp)}°
              </text>
              {i % 2 === 0 && (
                <text x={p.x} y={h + 18} className="tg-hour" textAnchor="middle">
                  {i === 0 ? "Now" : hourLabel(p.d.startTime, clock24h)}
                </text>
              )}
              {(() => {
                const pop = data[i].probabilityOfPrecipitation?.value ?? 0;
                return pop >= 30 ? (
                  <text x={p.x} y={h + 36} className="tg-pop" textAnchor="middle">
                    {Math.round(pop)}%
                  </text>
                ) : null;
              })()}
            </g>
          ))}
        </svg>
      </div>
      <div className="tempgraph-legend faint">
        <span>Low {displayTempF(min, temp)}°</span>
        <span>Next {data.length}h</span>
        <span>High {displayTempF(max, temp)}°</span>
      </div>
    </div>
  );
}
