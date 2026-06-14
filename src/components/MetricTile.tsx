import type { ReactNode } from "react";

export function MetricTile({
  label,
  value,
  unit,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="metric card">
      <div className="metric-head">
        {icon}
        <span className="eyebrow">{label}</span>
      </div>
      <div className="metric-value tabular">
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sub && <div className="metric-sub faint">{sub}</div>}
    </div>
  );
}
