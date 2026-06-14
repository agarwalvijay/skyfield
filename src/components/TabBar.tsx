import { motion } from "motion/react";

export type TabId = "now" | "hourly" | "daily" | "radar" | "more";

const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  {
    id: "now",
    label: "Now",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "hourly",
    label: "Hourly",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "daily",
    label: "7-Day",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "radar",
    label: "Radar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 12L19 7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "more",
    label: "More",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function TabBar({
  active,
  onChange,
  alertCount,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  alertCount: number;
}) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            className="tab"
            data-active={isActive}
            onClick={() => onChange(t.id)}
            aria-label={t.label}
            aria-current={isActive}
          >
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                className="tab-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span style={{ position: "relative" }}>
              {t.icon}
              {t.id === "radar" && alertCount > 0 && <i className="tab-dot" />}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
