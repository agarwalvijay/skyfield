import type { TropicalStorm } from "@/lib/weather/tropical";

export function TropicalBanner({ storms }: { storms: TropicalStorm[] }) {
  if (!storms.length) return null;
  // Lead with the nearest / most significant storm.
  const s = storms[0];
  const title = s.category ? `${s.classification} ${s.name} · Cat ${s.category}` : `${s.classification} ${s.name}`;

  return (
    <div className="card tropical">
      <div className="tropical-icon">🌀</div>
      <div className="tropical-body">
        <div className="tropical-title">{title}</div>
        <div className="tropical-meta faint">
          {s.distanceMi} mi {s.bearing} · {s.windMph} mph · moving {s.movement}
        </div>
        {storms.length > 1 && (
          <div className="tropical-more faint">+{storms.length - 1} more active nearby</div>
        )}
      </div>
    </div>
  );
}
