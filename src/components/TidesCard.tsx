import type { Tides } from "@/lib/weather/tides";

function fmtTime(t: number, tz?: string): string {
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export function TidesCard({ tides, timeZone }: { tides: Tides; timeZone?: string }) {
  return (
    <div className="card tides">
      <div className="tides-head">
        <h2 className="section-title" style={{ margin: 0 }}>
          Tides
        </h2>
        <span className="faint tides-station">
          {tides.stationName} · {tides.distanceKm} km
        </span>
      </div>
      <div className="tides-row">
        {tides.events.map((e) => (
          <div key={e.time} className="tides-cell">
            <span className={`tides-arrow ${e.type}`}>{e.type === "high" ? "▲" : "▼"}</span>
            <span className="tides-type">{e.type === "high" ? "High" : "Low"}</span>
            <span className="tides-time tabular">{fmtTime(e.time, timeZone)}</span>
            <span className="tides-ht faint tabular">{e.heightFt.toFixed(1)} ft</span>
          </div>
        ))}
      </div>
    </div>
  );
}
