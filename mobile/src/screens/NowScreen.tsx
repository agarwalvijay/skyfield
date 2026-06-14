import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRefresh } from "@/hooks/useRefresh";
import Svg, { Path } from "react-native-svg";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useCurrentConditions, useForecast, useHourly, useNowcast, useOutlook } from "@/hooks/useWeather";
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
import { WeatherGlyph } from "@/components/WeatherGlyph";
import { NowcastCard } from "@/components/NowcastCard";
import { DailyForecastCard } from "@/components/DailyForecastCard";
import { ErrorBlock, LoadingBlock, MetricTile, SectionTitle } from "@/components/ui";
import { card, colors, fonts } from "@/theme";

export function NowScreen({
  sky,
  onSeeDaily,
}: {
  sky: { cond: Condition; theme: SkyTheme };
  onSeeDaily?: () => void;
}) {
  const { meta, metaLoading, metaError, coords } = useWeatherCtx();
  const nowcast = useNowcast(coords);
  const current = useCurrentConditions(meta, nowcast.data?.radarLevel ?? 0);
  const forecast = useForecast(meta);
  const hourly = useHourly(meta);
  const outlook = useOutlook(meta);
  const { refreshing, onRefresh } = useRefresh();
  const [outlookOpen, setOutlookOpen] = useState(false);
  const { temp, wind, pressure, imperialDistance, clock24h } = useSettings();
  const tz = meta?.timeZone;

  const freshOutlook =
    outlook.data &&
    Date.now() - new Date(outlook.data.issuanceTime).getTime() < 24 * 3600 * 1000
      ? outlook.data
      : null;

  if (metaError) {
    return (
      <ScrollView contentContainerStyle={s.page}>
        <ErrorBlock message="This location isn't covered by the US National Weather Service. Try a location inside the United States." />
      </ScrollView>
    );
  }

  const cur = current.data;
  const today = forecast.data?.[0];
  const tonight = forecast.data?.find((p) => !p.isDaytime);
  const high = forecast.data?.find((p) => p.isDaytime)?.temperature ?? today?.temperature ?? null;
  const low = tonight?.temperature ?? null;
  const condition = cur
    ? effectiveCondition({
        textDescription: cur.textDescription,
        icon: cur.icon,
        temperatureC: cur.temperatureC,
        radarLevel: nowcast.data?.radarLevel ?? 0,
        isDayHint: sky.cond.isDay,
      })
    : sky.cond;

  return (
    <ScrollView
      contentContainerStyle={s.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f3f6fc" colors={["#2a6df4"]} />
      }
    >
      {/* Hero */}
      <View style={s.heroMain}>
        <WeatherGlyph code={condition.code} isDay={condition.isDay} size={100} accent={sky.theme.accent} />
        <Text style={s.heroTemp}>
          {displayTemp(cur?.temperatureC ?? null, temp)}
          <Text style={s.heroDeg}>°</Text>
        </Text>
      </View>
      <Text style={s.heroCond}>{condition.label || cur?.textDescription || today?.shortForecast || "—"}</Text>
      <View style={s.heroMeta}>
        {cur?.feelsLikeC != null && <Text style={s.heroMetaText}>Feels {displayTemp(cur.feelsLikeC, temp)}°</Text>}
        {high != null && <Text style={s.heroMetaText}>H {displayTempF(high, temp)}°</Text>}
        {low != null && <Text style={s.heroMetaText}>L {displayTempF(low, temp)}°</Text>}
      </View>

      {(metaLoading || (current.isLoading && !cur)) && <LoadingBlock />}

      {/* Hazardous Weather Outlook */}
      {freshOutlook && (
        <Pressable style={s.outlook} onPress={() => setOutlookOpen((o) => !o)}>
          <View style={s.outlookHead}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={colors.warn} strokeWidth={2}>
              <Path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              <Path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" />
            </Svg>
            <Text style={s.outlookTitle}>Hazardous Weather Outlook</Text>
            <Text style={s.outlookMeta}>{freshOutlook.wfo} · {relativeTime(freshOutlook.issuanceTime)}</Text>
          </View>
          {outlookOpen && (
            <Text style={s.outlookText} selectable>
              {freshOutlook.text}
            </Text>
          )}
        </Pressable>
      )}

      {/* Hourly strip */}
      {hourly.data && hourly.data.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip} contentContainerStyle={s.stripInner}>
          {hourly.data.slice(0, 24).map((h, i) => {
            const cond = parseCondition(h.shortForecast, h.icon, h.isDaytime);
            const pop = h.probabilityOfPrecipitation?.value ?? 0;
            return (
              <View key={h.startTime} style={s.stripItem}>
                <Text style={s.stripTime}>{i === 0 ? "Now" : hourLabel(h.startTime, clock24h, tz)}</Text>
                <WeatherGlyph code={cond.code} isDay={cond.isDay} size={28} accent={sky.theme.accent} />
                <Text style={[s.stripPop, { opacity: pop >= 15 ? 1 : 0 }]}>{Math.round(pop)}%</Text>
                <Text style={s.stripTemp}>{displayTempF(h.temperature, temp)}°</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* MinuteCast */}
      {nowcast.data && <NowcastCard nowcast={nowcast.data} />}

      {/* Multi-day forecast */}
      {forecast.data && forecast.data.length > 0 && (
        <DailyForecastCard periods={forecast.data} accent={sky.theme.accent} days={5} onSeeAll={onSeeDaily} />
      )}

      {/* Narrative */}
      {today && (
        <View style={s.narrative}>
          <Text style={s.eyebrow}>{today.name.toUpperCase()}</Text>
          <Text style={s.narrativeText}>{today.detailedForecast}</Text>
          {tonight && tonight !== today && (
            <>
              <Text style={[s.eyebrow, { marginTop: 12 }]}>{tonight.name.toUpperCase()}</Text>
              <Text style={s.narrativeText}>{tonight.detailedForecast}</Text>
            </>
          )}
        </View>
      )}

      {/* Conditions grid */}
      {cur && (
        <>
          <SectionTitle>Conditions</SectionTitle>
          <View style={s.grid}>
            <MetricTile
              label="Wind"
              value={displayWind(cur.windSpeedKph, wind)}
              unit={windUnitLabel(wind)}
              sub={`${degToCompass(cur.windDirectionDeg)}${cur.windGustKph ? ` · gusts ${displayWind(cur.windGustKph, wind)}` : ""}`}
            />
            <MetricTile
              label="Humidity"
              value={cur.humidityPct != null ? `${Math.round(cur.humidityPct)}` : "--"}
              unit="%"
              sub={cur.dewpointC != null ? `Dew pt ${displayTemp(cur.dewpointC, temp)}°` : undefined}
            />
            <MetricTile label="Feels Like" value={displayTemp(cur.feelsLikeC, temp)} unit="°" />
            <MetricTile
              label="Pressure"
              value={displayPressure(cur.pressurePa, pressure)}
              unit={pressure === "inHg" ? "inHg" : "hPa"}
            />
            <MetricTile
              label="Visibility"
              value={displayVisibility(cur.visibilityM, imperialDistance).split(" ")[0]}
              unit={imperialDistance ? "mi" : "km"}
            />
            <MetricTile label="Dew Point" value={displayTemp(cur.dewpointC, temp)} unit="°" />
          </View>
          <Text style={s.credit}>
            {cur.stationName ? `Observed at ${cur.stationName}` : "Latest observation"} · {relativeTime(cur.timestamp)}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingBottom: 120, paddingTop: 6 },
  heroMain: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  heroTemp: { fontFamily: fonts.displayLight, fontSize: 88, color: colors.fg, letterSpacing: -3 },
  heroDeg: { fontSize: 44, color: colors.fgDim },
  heroCond: { fontFamily: fonts.bodySemi, fontSize: 18, color: colors.fg, textAlign: "center", marginTop: 2 },
  heroMeta: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 8 },
  heroMetaText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fgDim },
  strip: { ...card, marginTop: 18 },
  stripInner: { paddingVertical: 14, paddingHorizontal: 8 },
  stripItem: { alignItems: "center", gap: 7, width: 56 },
  stripTime: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.fgFaint },
  stripPop: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: "#7fd4ff" },
  stripTemp: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.fg },
  narrative: { ...card, padding: 17, marginTop: 14 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: colors.fgFaint },
  narrativeText: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21.5, color: colors.fg, marginTop: 5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  credit: { fontFamily: fonts.body, fontSize: 12, color: colors.fgFaint, textAlign: "center", marginTop: 14 },
  outlook: { ...card, padding: 14, marginTop: 16, borderLeftWidth: 3, borderLeftColor: colors.warn },
  outlookHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  outlookTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.fg },
  outlookMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.fgFaint },
  outlookText: {
    fontFamily: "monospace" as never,
    fontSize: 12,
    lineHeight: 18,
    color: colors.fgDim,
    marginTop: 12,
  },
});
