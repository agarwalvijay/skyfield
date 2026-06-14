import { useEffect, useRef, useState } from "react";
import { motion, Reorder, useDragControls } from "motion/react";
import { searchPlaces, placeLabel, type GeoResult } from "@/lib/geocode/geocode";
import { useLocationStore, type SavedLocation } from "@/store/locations";
import { useGeolocation } from "@/hooks/useGeolocation";

function SavedRow({
  loc,
  active,
  onChoose,
  onRemove,
}: {
  loc: SavedLocation;
  active: boolean;
  onChoose: () => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={loc.id}
      dragListener={false}
      dragControls={controls}
      className="loc-item-wrap"
    >
      <button
        className="loc-drag"
        aria-label={`Reorder ${loc.label}`}
        onPointerDown={(e) => {
          e.preventDefault();
          controls.start(e);
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 8h14M5 12h14M5 16h14" strokeLinecap="round" />
        </svg>
      </button>
      <button className="loc-item pressable" data-active={active} onClick={onChoose}>
        <svg className="loc-item-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
        <span className="loc-item-label">{loc.label}</span>
        {active && <span className="loc-active-dot" />}
      </button>
      <button className="loc-remove" onClick={onRemove} aria-label={`Remove ${loc.label}`}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </Reorder.Item>
  );
}

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locations, activeId, gps, setActive, addLocation, removeLocation, reorder } =
    useLocationStore();
  const { locate, status } = useGeolocation(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fresh search box each time the sheet opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchPlaces(q, ctrl.signal);
        setResults(r);
      } catch {
        /* aborted or failed */
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const choose = (id: string) => {
    setActive(id);
    onClose();
  };

  const addPlace = (r: GeoResult) => {
    addLocation({ label: placeLabel(r), sublabel: r.country, lat: r.lat, lon: r.lon });
    onClose();
  };

  return (
    <motion.div
      className="sheet-scrim"
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      style={{ pointerEvents: open ? "auto" : "none" }}
      onClick={onClose}
    >
      <motion.div
        className="sheet"
        initial={false}
        animate={{ y: open ? 0 : "110%" }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2 className="display">Locations</h2>
          <button className="reader-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sheet-search">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="faint">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, ZIP, or place"
          />
          {query && (
            <button className="faint" onClick={() => setQuery("")} aria-label="Clear">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="sheet-body">
          {/* Search results */}
          {query.trim().length >= 2 && (
            <div className="sheet-results">
              {searching && <p className="faint sheet-hint">Searching…</p>}
              {!searching && results.length === 0 && <p className="faint sheet-hint">No matches.</p>}
              {results.map((r) => (
                <button key={r.id} className="loc-result pressable" onClick={() => addPlace(r)}>
                  <div>
                    <span className="loc-result-name">{r.name}</span>
                    <span className="loc-result-sub faint">
                      {[r.admin1, r.admin2, r.country].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--accent)" }}>
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Saved + GPS list */}
          {query.trim().length < 2 && (
            <div className="sheet-saved">
              <button
                className="loc-item pressable"
                data-active={gps && activeId === gps.id}
                onClick={() => {
                  if (gps) choose(gps.id);
                  else locate();
                }}
              >
                <svg className="loc-item-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                </svg>
                <span className="loc-item-label">
                  {gps ? gps.label : status === "locating" ? "Locating…" : "Use my location"}
                </span>
                {gps && activeId === gps.id && <span className="loc-active-dot" />}
              </button>

              <Reorder.Group
                axis="y"
                values={locations.map((l) => l.id)}
                onReorder={reorder}
                as="div"
              >
                {locations.map((l) => (
                  <SavedRow
                    key={l.id}
                    loc={l}
                    active={activeId === l.id}
                    onChoose={() => choose(l.id)}
                    onRemove={() => removeLocation(l.id)}
                  />
                ))}
              </Reorder.Group>

              {locations.length === 0 && !gps && (
                <p className="faint sheet-hint">Search above to add your first location.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
