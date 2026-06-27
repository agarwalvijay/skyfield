import React from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useWeatherCtx } from "@/components/WeatherContext";
import {
  useCurrentConditions,
  useForecast,
  useHourly,
  useNowcast,
  useAirQuality,
  useUv,
  useTides,
  useStorms,
} from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import {
  degToCompass,
  displayPressure,
  displayTemp,
  displayTempF,
  displayVisibility,
  displayWind,
  windUnitLabel,
} from "@/lib/format/units";
import { hourLabel, relativeTime } from "@/lib/format/time";
import { parseCondition, type Condition } from "@/lib/weather/condition";
import { effectiveCondition } from "@/lib/weather/effective";
import type { SkyTheme } from "@/lib/weather/sky";
import type { WeatherAlert } from "@/lib/nws";
import { WeatherGlyph } from "@/components/WeatherGlyph";
import { NowcastCard } from "@/components/NowcastCard";
import { DailyForecastCard } from "@/components/DailyForecastCard";
import { AirSunCard } from "@/components/AirSunCard";
import { TidesCard } from "@/components/TidesCard";
import { TropicalBanner } from "@/components/TropicalBanner";
import { ErrorBlock, MetricTile } from "@/components/ui";
import { RadarScreen } from "./RadarScreen";
import { card, colors, fonts } from "@/theme";

/**
 * Tablet dashboard — everything at a glance, mirroring the web DashboardScreen.
 * Responsive: 3 columns on wide/landscape (left · radar · forecast), 2 columns
 * stacked under a radar panel on narrower tablet portrait. Reuses NowScreen's
 * cards; App swaps this in for NowScreen on tablets.
 */
export function DashboardScreen({
  sky,
  alerts,
}: {
  sky: { cond: Condition; theme: SkyTheme };
  alerts: WeatherAlert[];
}) {
  const { width } = useWindowDimensions();
  const threeCol = width >= 1080;

  const { meta, metaError, coords } = useWeatherCtx();
  const nowcast = useNowcast(coords);
  const radarLevel = nowcast.data?.radarLevel ?? 0;
  const current = useCurrentConditions(meta, radarLevel);
  const forecast = useForecast(meta);
  const hourly = useHourly(meta);
  const air = useAirQuality(coords);
  const uv = useUv(coords);
  const tides = useTides(coords);
  const storms = useStorms(coords);
  const { temp, wind, pressure, imperialDistance, clock24h } = useSettings();
  const tz = meta?.timeZone;

  if (metaError) {
    return (
      <View style={s.errorWrap}>
        <ErrorBlock message="This location isn't covered by the US National Weather Service. Try a location inside the United States." />
      </View>
    );
  }

  const cur = current.data;
  const today = forecast.data?.[0];
  const high = forecast.data?.find((p) => p.isDaytime)?.temperature ?? today?.temperature ?? null;
  const low = forecast.data?.find((p) => !p.isDaytime)?.temperature ?? null;
  const condition = cur
    ? effectiveCondition({
        textDescription: cur.textDescription,
        icon: cur.icon,
        temperatureC: cur.temperatureC,
        radarLevel,
        isDayHint: sky.cond.isDay,
      })
    : sky.cond;

  // ---- Reusable pieces (composed differently per layout) ----
  const hero = (
    <View style={s.hero}>
      <View style={s.heroTop}>
        <WeatherGlyph code={condition.code} isDay={condition.isDay} size={76} accent={sky.theme.accent} />
        <Text style={s.heroTemp}>
          {displayTemp(cur?.temperatureC ?? null, temp)}
          <Text style={s.heroDeg}>°</Text>
        </Text>
      </View>
      <Text style={s.heroCond}>
        {condition.label || cur?.textDescription || today?.shortForecast || "—"}
      </Text>
      <View style={s.heroMeta}>
        {cur?.feelsLikeC != null && <Text style={s.heroMetaText}>Feels {displayTemp(cur.feelsLikeC, temp)}°</Text>}
        {high != null && <Text style={s.heroMetaText}>H {displayTempF(high, temp)}°</Text>}
        {low != null && <Text style={s.heroMetaText}>L {displayTempF(low, temp)}°</Text>}
      </View>
    </View>
  );

  const airCard =
    coords && (air.data || uv.data) ? (
      <AirSunCard air={air.data} uv={uv.data} lat={coords.lat} lon={coords.lon} timeZone={tz} />
    ) : null;

  const metrics = cur ? (
    <View style={s.grid}>
      <MetricTile label="Wind" value={displayWind(cur.windSpeedKph, wind)} unit={windUnitLabel(wind)} sub={degToCompass(cur.windDirectionDeg)} />
      <MetricTile label="Humidity" value={cur.humidityPct != null ? `${Math.round(cur.humidityPct)}` : "--"} unit="%" />
      <MetricTile label="Pressure" value={displayPressure(cur.pressurePa, pressure)} unit={pressure === "inHg" ? "inHg" : "hPa"} />
      <MetricTile label="Visibility" value={displayVisibility(cur.visibilityM, imperialDistance).split(" ")[0]} unit={imperialDistance ? "mi" : "km"} />
    </View>
  ) : null;

  const nowcastEl = nowcast.data ? <NowcastCard nowcast={nowcast.data} /> : null;
  const tropicalEl = storms.data && storms.data.length > 0 ? <TropicalBanner storms={storms.data} /> : null;

  const hourlyStrip =
    hourly.data && hourly.data.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip} contentContainerStyle={s.stripInner}>
        {hourly.data.slice(0, 24).map((h, i) => {
          const c = parseCondition(h.shortForecast, h.icon, h.isDaytime);
          const pop = h.probabilityOfPrecipitation?.value ?? 0;
          return (
            <View key={h.startTime} style={s.stripItem}>
              <Text style={s.stripTime}>{i === 0 ? "Now" : hourLabel(h.startTime, clock24h, tz)}</Text>
              <WeatherGlyph code={c.code} isDay={c.isDay} size={26} accent={sky.theme.accent} />
              <Text style={[s.stripPop, { opacity: pop >= 15 ? 1 : 0 }]}>{Math.round(pop)}%</Text>
              <Text style={s.stripTemp}>{displayTempF(h.temperature, temp)}°</Text>
            </View>
          );
        })}
      </ScrollView>
    ) : null;

  const dailyCard =
    forecast.data && forecast.data.length > 0 ? (
      <DailyForecastCard periods={forecast.data} accent={sky.theme.accent} days={7} />
    ) : null;

  const tidesEl = tides.data ? <TidesCard tides={tides.data} timeZone={tz} /> : null;
  const creditEl = cur ? (
    <Text style={s.credit}>
      {cur.stationName ? `Observed at ${cur.stationName}` : "Latest observation"} · {relativeTime(cur.timestamp)}
    </Text>
  ) : null;

  // ---- 3-column (wide / landscape) ----
  if (threeCol) {
    return (
      <View style={s.row}>
        <ScrollView style={s.sideCol} contentContainerStyle={s.colInner} showsVerticalScrollIndicator={false}>
          {hero}
          {airCard}
          {metrics}
        </ScrollView>
        <View style={s.centerCol}>
          <View style={s.radarFlex}>
            <RadarScreen alerts={alerts} />
          </View>
          {nowcastEl}
        </View>
        <ScrollView style={s.sideCol} contentContainerStyle={s.colInner} showsVerticalScrollIndicator={false}>
          {tropicalEl}
          {hourlyStrip}
          {dailyCard}
          {tidesEl}
          {creditEl}
        </ScrollView>
      </View>
    );
  }

  // ---- 2-column (tablet portrait): radar on top, two card columns below ----
  return (
    <ScrollView contentContainerStyle={s.twoColPage} showsVerticalScrollIndicator={false}>
      {tropicalEl}
      <View style={s.radarPanel}>
        <RadarScreen alerts={alerts} />
      </View>
      <View style={s.twoColRow}>
        <View style={s.twoColCol}>
          {hero}
          {metrics}
          {airCard}
        </View>
        <View style={s.twoColCol}>
          {nowcastEl}
          {hourlyStrip}
          {dailyCard}
          {tidesEl}
        </View>
      </View>
      {creditEl}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // 3-col
  row: { flex: 1, flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  sideCol: { width: 360, flexGrow: 0, flexShrink: 0 },
  colInner: { gap: 12, paddingBottom: 24 },
  centerCol: { flex: 1, gap: 12, minWidth: 0 },
  radarFlex: { flex: 1, borderRadius: 22, overflow: "hidden", backgroundColor: colors.glass },

  // 2-col
  twoColPage: { padding: 16, gap: 12, paddingBottom: 120 },
  radarPanel: { height: 320, borderRadius: 22, overflow: "hidden", backgroundColor: colors.glass },
  twoColRow: { flexDirection: "row", gap: 12 },
  twoColCol: { flex: 1, gap: 12 },

  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  hero: { ...card, padding: 18, alignItems: "center" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  heroTemp: { fontFamily: fonts.displayLight, fontSize: 68, color: colors.fg, letterSpacing: -2 },
  heroDeg: { fontSize: 32, color: colors.fgDim },
  heroCond: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.fg, textAlign: "center", marginTop: 8 },
  heroMeta: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 8 },
  heroMetaText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fgDim },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  strip: { ...card },
  stripInner: { paddingVertical: 14, paddingHorizontal: 8 },
  stripItem: { alignItems: "center", gap: 7, width: 54 },
  stripTime: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.fgFaint },
  stripPop: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: "#7fd4ff" },
  stripTemp: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.fg },

  credit: { fontFamily: fonts.body, fontSize: 12, color: colors.fgFaint, textAlign: "center", marginTop: 6 },
});
