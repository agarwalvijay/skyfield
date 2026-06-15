import type { SavedLocation } from "@/store/locations";

export function TopBar({
  location,
  nearby,
  onOpenLocations,
  onRefresh,
  refreshing,
  onOpenMore,
}: {
  location: SavedLocation | null;
  nearby?: string;
  onOpenLocations: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** When provided (desktop dashboard), shows a settings button. */
  onOpenMore?: () => void;
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

      <div className="topbar-actions">
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

        {onOpenMore && (
          <button className="topbar-icon pressable" onClick={onOpenMore} aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
