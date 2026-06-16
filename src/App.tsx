import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import "./components/sky.css";
import "./components/ui.css";
import { GPS_ID, useGeolocation } from "@/hooks/useGeolocation";
import { useLocationStore, type SavedLocation } from "@/store/locations";
import { usePointMeta, useCurrentConditions, useAlerts, useNowcast } from "@/hooks/useWeather";
import { HYDROLOGIC_OUTLOOK } from "@/lib/nws";
import { useSettings } from "@/store/settings";
import { effectiveCondition } from "@/lib/weather/effective";
import { skyFor } from "@/lib/weather/sky";
import { SkyBackground } from "@/components/SkyBackground";
import { WeatherProvider } from "@/components/WeatherContext";
import { TabBar, type TabId } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { LocationSheet } from "@/components/LocationSheet";
import { AlertBanner } from "@/components/AlertBanner";
import { NowScreen } from "@/screens/NowScreen";
import { HourlyScreen } from "@/screens/HourlyScreen";
import { DailyScreen } from "@/screens/DailyScreen";
import { RadarScreen } from "@/screens/RadarScreen";
import { MoreScreen } from "@/screens/MoreScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { Welcome } from "@/components/Welcome";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function App() {
  const queryClient = useQueryClient();
  const { status, locate } = useGeolocation(true);
  const locations = useLocationStore((s) => s.locations);
  const activeId = useLocationStore((s) => s.activeId);
  const gps = useLocationStore((s) => s.gps);

  const [tab, setTab] = useState<TabId>("now");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Wide screens get a single full-viewport dashboard; narrow screens keep the
  // tabbed, scrolling mobile layout.
  const isWide = useMediaQuery("(min-width: 1024px)");

  // When GPS is the chosen location but the live fix isn't ready, don't fall
  // back to a saved location (which would show its forecast, then jump to GPS).
  const gpsPending = activeId === GPS_ID && !gps && status === "locating";

  const active: SavedLocation | null = useMemo(() => {
    if (gpsPending) return null;
    if (gps && activeId === gps.id) return gps;
    return locations.find((l) => l.id === activeId) ?? gps ?? locations[0] ?? null;
  }, [locations, activeId, gps, gpsPending]);

  const coords = active ? { lat: active.lat, lon: active.lon } : null;
  const metaQ = usePointMeta(coords);
  const nowcastQ = useNowcast(coords);
  // Match the current-conditions station to the radar intensity at the exact
  // point (fixes a distant clear/light airport masking a local storm).
  const radarLevel = nowcastQ.data?.radarLevel ?? 0;
  const currentQ = useCurrentConditions(metaQ.data, radarLevel);
  const alertsQ = useAlerts(coords);
  const hydrologicOutlook = useSettings((s) => s.hydrologicOutlook);

  // Honor the "Hydrologic Outlook" setting everywhere alerts are shown.
  const alerts = useMemo(
    () =>
      (alertsQ.data ?? []).filter((a) => hydrologicOutlook || a.event !== HYDROLOGIC_OUTLOOK),
    [alertsQ.data, hydrologicOutlook],
  );

  // Derive sky from the effective condition (radar-driven during precip).
  const sky = useMemo(() => {
    const hour = new Date().getHours();
    const dayHint = hour >= 6 && hour < 19;
    const cond = effectiveCondition({
      textDescription: currentQ.data?.textDescription,
      icon: currentQ.data?.icon,
      temperatureC: currentQ.data?.temperatureC,
      radarLevel,
      isDayHint: dayHint,
    });
    return { cond, theme: skyFor(cond.code, cond.isDay) };
  }, [currentQ.data, radarLevel]);

  // Keep the theme-color meta in sync for the system UI.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", sky.theme.gradient[0]);
  }, [sky.theme]);

  const locating = status === "locating" && !active;

  const wideDash = isWide && !!active;

  return (
    <div className={`app${wideDash ? " app-wide" : ""}`}>
      <SkyBackground theme={sky.theme} code={sky.cond.code} isDay={sky.cond.isDay} />
      <div className="grain" />

      {locating ? (
        <div className="locating">
          <span className="spinner" />
          <p className="muted">Finding your location…</p>
        </div>
      ) : !active ? (
        <Welcome status={status} onUseLocation={locate} onSearch={() => setSheetOpen(true)} />
      ) : (
        <WeatherProvider
          value={{
            location: active,
            coords,
            meta: metaQ.data,
            metaLoading: metaQ.isLoading,
            metaError: (metaQ.error as Error) ?? null,
          }}
        >
          <TopBar
            location={active}
            nearby={metaQ.data?.city ? `${metaQ.data.city}, ${metaQ.data.state}` : undefined}
            onOpenLocations={() => setSheetOpen(true)}
            onRefresh={() => queryClient.invalidateQueries()}
            refreshing={currentQ.isFetching || metaQ.isFetching}
            onOpenMore={wideDash ? () => setMoreOpen(true) : undefined}
          />

          {alerts.length > 0 && (
            <AlertBanner alerts={alerts} accent={sky.theme.accent} />
          )}

          {wideDash ? (
            <DashboardScreen sky={sky} alerts={alerts} />
          ) : (
            <>
              <div className="screen-wrap">
                {/* No AnimatePresence here: with mode="wait", a dropped exit
                   completion leaves the next tab unmounted (blank screen). The
                   keyed remount still plays the enter animation. */}
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  style={{ height: "100%" }}
                >
                  {tab === "now" && (
                    <NowScreen sky={sky} alerts={alerts} onSeeDaily={() => setTab("daily")} />
                  )}
                  {tab === "hourly" && <HourlyScreen />}
                  {tab === "daily" && <DailyScreen accent={sky.theme.accent} />}
                  {tab === "radar" && <RadarScreen alerts={alerts} />}
                  {tab === "more" && <MoreScreen accent={sky.theme.accent} />}
                </motion.div>
              </div>

              <TabBar active={tab} onChange={setTab} alertCount={alerts.length} />
            </>
          )}

          {/* Settings modal — inside the provider so MoreScreen's useWeatherCtx
             resolves (otherwise it throws and blanks the app). */}
          {moreOpen && (
            <div className="more-modal" onClick={() => setMoreOpen(false)}>
              <div className="more-panel" onClick={(e) => e.stopPropagation()}>
                <button className="more-close" onClick={() => setMoreOpen(false)} aria-label="Close settings">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
                <MoreScreen accent={sky.theme.accent} />
              </div>
            </div>
          )}
        </WeatherProvider>
      )}

      <LocationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
