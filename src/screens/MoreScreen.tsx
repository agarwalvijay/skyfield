import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useDiscussion } from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import { Segmented } from "@/components/Segmented";
import { relativeTime } from "@/lib/format/time";

export function MoreScreen({ accent }: { accent: string }) {
  const { meta } = useWeatherCtx();
  const settings = useSettings();
  const [readerOpen, setReaderOpen] = useState(false);
  const discussion = useDiscussion(meta, readerOpen);

  return (
    <div className="scroll page">
      <h1 className="page-title display">More</h1>

      {/* Forecast Discussion */}
      <section>
        <h2 className="section-title">Forecaster Discussion</h2>
        <button className="card more-row pressable" onClick={() => setReaderOpen(true)}>
          <div className="more-row-icon" style={{ color: accent }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 5h16v11H7l-3 3z" strokeLinejoin="round" />
              <path d="M8 9h8M8 12h5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="more-row-text">
            <span className="more-row-title">Area Forecast Discussion</span>
            <span className="more-row-sub faint">
              The meteorologist's full reasoning {meta ? `· ${meta.gridId}` : ""}
            </span>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className="faint">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      {/* Units */}
      <section>
        <h2 className="section-title">Units</h2>
        <div className="card settings-card">
          <SettingRow label="Temperature">
            <Segmented
              id="temp"
              value={settings.temp}
              onChange={settings.setTemp}
              options={[
                { value: "F", label: "°F" },
                { value: "C", label: "°C" },
              ]}
            />
          </SettingRow>
          <hr className="divider" />
          <SettingRow label="Wind speed">
            <Segmented
              id="wind"
              value={settings.wind}
              onChange={settings.setWind}
              options={[
                { value: "mph", label: "mph" },
                { value: "kmh", label: "km/h" },
                { value: "ms", label: "m/s" },
                { value: "kn", label: "kn" },
              ]}
            />
          </SettingRow>
          <hr className="divider" />
          <SettingRow label="Pressure">
            <Segmented
              id="pres"
              value={settings.pressure}
              onChange={settings.setPressure}
              options={[
                { value: "inHg", label: "inHg" },
                { value: "hPa", label: "hPa" },
              ]}
            />
          </SettingRow>
          <hr className="divider" />
          <SettingRow label="Distance">
            <Segmented
              id="dist"
              value={settings.imperialDistance ? "mi" : "km"}
              onChange={(v) => settings.setImperialDistance(v === "mi")}
              options={[
                { value: "mi", label: "miles" },
                { value: "km", label: "km" },
              ]}
            />
          </SettingRow>
          <hr className="divider" />
          <SettingRow label="Clock">
            <Segmented
              id="clock"
              value={settings.clock24h ? "24" : "12"}
              onChange={(v) => settings.setClock24h(v === "24")}
              options={[
                { value: "12", label: "12h" },
                { value: "24", label: "24h" },
              ]}
            />
          </SettingRow>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="section-title">About</h2>
        <div className="card about-card">
          <p>
            <b>Skyfield</b> delivers hyperlocal forecasts straight from the U.S. National Weather
            Service point-forecast API — the same source meteorologists use — with no middleman.
          </p>
          <p className="faint">
            Weather data © NOAA / National Weather Service (public domain). Radar © RainViewer. Maps
            © OpenStreetMap, © CARTO. Not affiliated with NOAA or the NWS.
          </p>
          <p className="faint">An Atsumi Labs app · atsumilabs.com</p>
        </div>
      </section>

      <div style={{ height: 24 }} />

      {/* Discussion reader */}
      <AnimatePresence>
        {readerOpen && (
          <motion.div
            className="reader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="reader-panel"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 36 }}
            >
              <div className="reader-head">
                <div>
                  <h3 className="display">Area Forecast Discussion</h3>
                  {discussion.data && (
                    <span className="faint">
                      {discussion.data.wfo} · issued {relativeTime(discussion.data.issuanceTime)}
                    </span>
                  )}
                </div>
                <button className="reader-close" onClick={() => setReaderOpen(false)} aria-label="Close">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="reader-body">
                {discussion.isLoading && <p className="faint">Loading discussion…</p>}
                {discussion.error && <p className="faint">Couldn't load the discussion.</p>}
                {discussion.data === null && <p className="faint">No discussion is available for this office.</p>}
                {discussion.data && <pre className="afd">{discussion.data.text}</pre>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      {children}
    </div>
  );
}
