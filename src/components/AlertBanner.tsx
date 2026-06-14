import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { WeatherAlert } from "@/lib/nws";
import { alertColor } from "@/lib/weather/alertColor";
import { fullTime } from "@/lib/format/time";

export function AlertBanner({ alerts }: { alerts: WeatherAlert[]; accent: string }) {
  const [open, setOpen] = useState<WeatherAlert | null>(null);
  const top = alerts[0];
  const color = alertColor(top.severity);

  return (
    <>
      <motion.button
        className="alert-banner"
        style={{ background: color }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={() => setOpen(top)}
      >
        <span className="alert-pulse" />
        <span className="alert-banner-text">
          <b>{top.event}</b>
          {alerts.length > 1 && <span className="alert-count">+{alerts.length - 1} more</span>}
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="reader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.div
              className="reader-panel"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 36 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reader-head">
                <div className="alert-list-tabs">
                  {alerts.map((a) => (
                    <button
                      key={a.id}
                      className="alert-chip"
                      data-active={a.id === open.id}
                      style={{ borderColor: alertColor(a.severity) }}
                      onClick={() => setOpen(a)}
                    >
                      {a.event}
                    </button>
                  ))}
                </div>
                <button className="reader-close" onClick={() => setOpen(null)} aria-label="Close">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="reader-body">
                <h3 className="display" style={{ color: alertColor(open.severity) }}>
                  {open.event}
                </h3>
                <div className="alert-tags">
                  <span className="alert-tag">{open.severity}</span>
                  <span className="alert-tag">{open.urgency}</span>
                  <span className="alert-tag">{open.certainty}</span>
                </div>
                {open.headline && <p className="alert-headline">{open.headline}</p>}
                <p className="faint alert-area">{open.areaDesc}</p>
                {open.effective && (
                  <p className="faint alert-time">
                    In effect {fullTime(open.effective, false)}
                    {open.expires ? ` → ${fullTime(open.expires, false)}` : ""}
                  </p>
                )}
                <pre className="afd">{open.description}</pre>
                {open.instruction && (
                  <>
                    <h4 className="alert-precautions">Precautionary / Preparedness Actions</h4>
                    <pre className="afd">{open.instruction}</pre>
                  </>
                )}
                <p className="faint" style={{ marginTop: 16 }}>
                  Issued by {open.sender}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
