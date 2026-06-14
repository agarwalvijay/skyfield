import { motion } from "motion/react";
import type { GeoStatus } from "@/hooks/useGeolocation";
import { WeatherGlyph } from "./WeatherGlyph";

export function Welcome({
  status,
  onUseLocation,
  onSearch,
}: {
  status: GeoStatus;
  onUseLocation: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="welcome">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="welcome-glyph"
      >
        <WeatherGlyph code="partly" isDay size={120} accent="#ffd166" />
      </motion.div>

      <motion.h1
        className="welcome-title display"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6 }}
      >
        Skyfield
      </motion.h1>
      <motion.p
        className="welcome-sub muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.6 }}
      >
        Hyperlocal weather, radar, and alerts — straight from the U.S. National Weather Service.
      </motion.p>

      <motion.div
        className="welcome-actions"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <button className="btn-primary" onClick={onUseLocation}>
          {status === "locating" ? "Locating…" : "Use my location"}
        </button>
        <button className="btn-ghost" onClick={onSearch}>
          Search for a place
        </button>
        {status === "denied" && (
          <p className="welcome-note faint">
            Location access was denied. You can still search for any U.S. city above.
          </p>
        )}
      </motion.div>
    </div>
  );
}
