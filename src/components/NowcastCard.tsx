import type { Nowcast, PrecipType } from "@/lib/nowcast/openmeteo";

const TYPE_COLOR: Record<PrecipType, string> = {
  rain: "#5db8ff",
  snow: "#eaf4ff",
  mix: "#c4a6ff",
  none: "#5db8ff",
};

/** MinuteCast-style strip: summary + 15-minute precip bars for the next 2h. */
export function NowcastCard({ nowcast }: { nowcast: Nowcast }) {
  const { intervals, summary, type } = nowcast;
  const anyWet = intervals.some((i) => i.wet);
  const maxMm = Math.max(0.5, ...intervals.map((i) => i.precipMm));
  const accent = TYPE_COLOR[type] ?? "#5db8ff";

  // Deterministic labels: oldest time · Now · newest time. (A fixed ±min
  // window left labels missing depending on radar frame timing.)
  const nowIdx = intervals.reduce(
    (best, iv, i) =>
      Math.abs(iv.minutesFromNow) < Math.abs(intervals[best].minutesFromNow) ? i : best,
    0,
  );
  const lastIdx = intervals.length - 1;
  const fmtOffset = (min: number) => {
    if (Math.abs(min) >= 55) return `${Math.round(min / 60)}h`;
    const m = Math.round(min / 5) * 5;
    return `${m > 0 ? "+" : ""}${m}m`;
  };
  const labelFor = (i: number, min: number) =>
    i === nowIdx ? "Now" : i === 0 || i === lastIdx ? fmtOffset(min) : "";

  return (
    <div className="card nowcast">
      <div className="nowcast-head">
        <span className="eyebrow">{nowcast.title ?? "Next 2 hours"}</span>
        <span className="nowcast-summary" style={{ color: anyWet ? accent : "var(--fg-dim)" }}>
          {summary}
        </span>
      </div>

      {anyWet && (
        <div className="nowcast-bars">
          {intervals.map((iv, i) => {
            const h = iv.wet ? Math.max(8, (iv.precipMm / maxMm) * 100) : 2;
            const label = labelFor(i, iv.minutesFromNow);
            return (
              <div className="nowcast-bar-col" key={iv.time}>
                <div className="nowcast-bar-track">
                  <div
                    className="nowcast-bar-fill"
                    style={{
                      height: `${h}%`,
                      background: iv.wet ? TYPE_COLOR[iv.type] : "rgba(255,255,255,0.15)",
                      opacity: iv.estimated ? 0.45 : 1,
                      outline: iv.estimated ? "1px dashed rgba(255,255,255,0.3)" : "none",
                    }}
                  />
                </div>
                <span className="nowcast-bar-label faint">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
