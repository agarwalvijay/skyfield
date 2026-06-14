import type { SavedLocation } from "@/store/locations";

export function TopBar({
  location,
  nearby,
  onOpenLocations,
  onRefresh,
  refreshing,
}: {
  location: SavedLocation | null;
  nearby?: string;
  onOpenLocations: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="topbar">
      <button className="topbar-loc pressable" onClick={onOpenLocations}>
        {location?.isCurrent ? (
          <svg className="topbar-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="topbar-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        )}
        <span className="topbar-loc-text">
          <span className="topbar-label">{location?.label ?? "Choose location"}</span>
          {location?.isCurrent && nearby && <span className="topbar-sub">near {nearby}</span>}
        </span>
        <svg className="topbar-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        className="topbar-icon pressable"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh weather"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={refreshing ? "spin" : ""}>
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </header>
  );
}
