import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Fraunces_300Light, Fraunces_400Regular } from "@expo-google-fonts/fraunces";
import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from "@expo-google-fonts/hanken-grotesk";
import { ActivityIndicator, AppState, Platform, Text } from "react-native";
import { GPS_ID, useGeolocation } from "@/hooks/useGeolocation";
import { activeLocation, useLocationStore } from "@/store/locations";
import { useAlerts, useCurrentConditions, useForecast, useNowcast, usePointMeta } from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import { buildWidgetWeather, storeAppSnapshot } from "@/widgets/widgetData";
import { refreshAllWidgets } from "@/widgets/refreshWidgets";
import { writeIosWidget } from "@/widgets/iosWidget";
import { effectiveCondition } from "@/lib/weather/effective";
import { skyFor } from "@/lib/weather/sky";
import { SkyBackground } from "@/components/SkyBackground";
import { WeatherProvider } from "@/components/WeatherContext";
import { TabBar, TopBar, type TabId } from "@/components/chrome";
import { AlertBanner } from "@/components/AlertBanner";
import { LocationSheet } from "@/components/LocationSheet";
import { Welcome } from "@/components/Welcome";
import { NowScreen } from "@/screens/NowScreen";
import { HourlyScreen } from "@/screens/HourlyScreen";
import { DailyScreen } from "@/screens/DailyScreen";
import { RadarScreen } from "@/screens/RadarScreen";
import { MoreScreen } from "@/screens/MoreScreen";
import { syncAlertTask } from "@/tasks/alertTask";
import { storeGpsLocation } from "@/tasks/widgetLocation";
import { colors, fonts } from "@/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Main() {
  const insets = useSafeAreaInsets();
  const { status, locate } = useGeolocation(true);
  const locations = useLocationStore((s) => s.locations);
  const activeId = useLocationStore((s) => s.activeId);
  const gps = useLocationStore((s) => s.gps);

  const [tab, setTab] = useState<TabId>("now");
  const [sheetOpen, setSheetOpen] = useState(false);

  // When GPS is the chosen location but the live fix isn't ready yet, we must
  // NOT fall back to a saved location — otherwise we'd show that location's
  // forecast and then visibly jump to the GPS forecast (the launch "flicker").
  const gpsPending = activeId === GPS_ID && !gps && status === "locating";

  const active = useMemo(() => {
    if (gpsPending) return null;
    return activeLocation({ locations, activeId, gps });
  }, [locations, activeId, gps, gpsPending]);
  const coords = active ? { lat: active.lat, lon: active.lon } : null;
  const metaQ = usePointMeta(coords);
  const nowcastQ = useNowcast(coords);
  // Match the current-conditions station to radar intensity at the exact point.
  const radarLevel = nowcastQ.data?.radarLevel ?? 0;
  const currentQ = useCurrentConditions(metaQ.data, radarLevel);
  const forecastQ = useForecast(metaQ.data);
  const alertsQ = useAlerts(coords);
  const tempUnit = useSettings((sStore) => sStore.temp);
  const windUnit = useSettings((sStore) => sStore.wind);
  const mutedAlerts = useSettings((sStore) => sStore.mutedAlerts);

  // Hide muted event types wherever alerts surface.
  const alerts = useMemo(
    () => (alertsQ.data ?? []).filter((a) => !mutedAlerts.includes(a.event)),
    [alertsQ.data, mutedAlerts],
  );

  // Keep the background alert task aware of the active location.
  useEffect(() => {
    if (active) syncAlertTask(active);
  }, [active]);

  // Persist the device GPS fix so widgets pinned to "Current Location" can
  // track it even when the app is viewing a saved place.
  useEffect(() => {
    if (gps) storeGpsLocation(gps);
  }, [gps]);

  // Share what the app just pulled with home-screen widgets on the same
  // location, so closing the app updates the widget to match (no fetch lag).
  useEffect(() => {
    if (!active) return;
    if (currentQ.data === undefined && !forecastQ.data) return;
    const nc = nowcastQ.data;
    const ncLine = nc && (nc.precipitatingNow || nc.type !== "none") ? nc.summary : null;
    const snapshot = buildWidgetWeather(
      active.label,
      currentQ.data ?? null,
      forecastQ.data ?? [],
      alerts,
      { temp: tempUnit, wind: windUnit },
      ncLine,
    );
    if (Platform.OS === "android") storeAppSnapshot(active, snapshot);
    else if (Platform.OS === "ios") writeIosWidget(snapshot);
  }, [active, currentQ.data, forecastQ.data, alerts, nowcastQ.data, tempUnit, windUnit]);

  // When the app goes to the background, push the latest to widgets.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") refreshAllWidgets();
    });
    return () => sub.remove();
  }, []);

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

  // While we're acquiring the chosen location, show a calm spinner rather than
  // a half-loaded or wrong-location screen.
  const locating = status === "locating" && !active;

  return (
    <View style={s.app}>
      <SkyBackground theme={sky.theme} code={sky.cond.code} isDay={sky.cond.isDay} />
      <StatusBar style="light" />

      {locating ? (
        <View style={s.locating}>
          <ActivityIndicator color="#f3f6fc" size="large" />
          <Text style={s.locatingText}>Finding your location…</Text>
        </View>
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
            topInset={insets.top}
          />
          {alerts.length > 0 && <AlertBanner alerts={alerts} />}

          <View style={{ flex: 1 }}>
            {tab === "now" && <NowScreen sky={sky} onSeeDaily={() => setTab("daily")} />}
            {tab === "hourly" && <HourlyScreen />}
            {tab === "daily" && <DailyScreen accent={sky.theme.accent} />}
            {tab === "radar" && <RadarScreen alerts={alerts} />}
            {tab === "more" && <MoreScreen accent={sky.theme.accent} />}
          </View>

          <TabBar
            active={tab}
            onChange={setTab}
            alertCount={alerts.length}
            bottomInset={insets.bottom}
          />
        </WeatherProvider>
      )}

      <LocationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
  });
  if (!fontsLoaded) return <View style={s.app} />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Main />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.appBg },
  locating: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  locatingText: { fontFamily: fonts.body, fontSize: 15, color: colors.fgDim },
});
