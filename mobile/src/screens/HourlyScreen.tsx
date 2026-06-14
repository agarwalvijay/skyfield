import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRefresh } from "@/hooks/useRefresh";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useGridSeries, useHourly } from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import { displayTempF, displayWind, parseWindSpeedMph } from "@/lib/format/units";
import { hourLabel } from "@/lib/format/time";
import { parseCondition } from "@/lib/weather/condition";
import { skyFor } from "@/lib/weather/sky";
import { WeatherGlyph } from "@/components/WeatherGlyph";
import { HourlyGraph } from "@/components/HourlyGraph";
import { ErrorBlock, LoadingBlock, SectionTitle, Segmented } from "@/components/ui";
import { card, colors, fonts } from "@/theme";
import type { HourlyPeriod } from "@/lib/nws";

type ViewMode = "graph" | "list";

export function HourlyScreen() {
  const { meta, coords } = useWeatherCtx();
  const tz = meta?.timeZone;
  const hourly = useHourly(meta);
  const [view, setView] = useState<ViewMode>("graph");
  const grid = useGridSeries(meta, view === "graph");
  const { temp, wind, clock24h } = useSettings();
  const { refreshing, onRefresh } = useRefresh();

  const groups = useMemo(() => {
    const out: { day: string; items: HourlyPeriod[] }[] = [];
    for (const h of hourly.data ?? []) {
      const day = new Date(h.startTime).toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: tz,
      });
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(h);
      else out.push({ day, items: [h] });
    }
    return out;
  }, [hourly.data, tz]);

  return (
    <ScrollView
      contentContainerStyle={s.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f3f6fc" colors={["#2a6df4"]} />
      }
    >
      <View style={s.head}>
        <Text style={s.title}>Hourly</Text>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "graph", label: "Graph" },
            { value: "list", label: "List" },
          ]}
        />
      </View>

      {hourly.isLoading && <LoadingBlock />}
      {hourly.error ? <ErrorBlock onRetry={() => hourly.refetch()} /> : null}

      {hourly.data && view === "graph" && (
        <HourlyGraph periods={hourly.data} grid={grid.data} coords={coords} timeZone={tz} />
      )}

      {hourly.data &&
        view === "list" &&
        groups.map((g) => (
          <View key={g.day}>
            <SectionTitle>{g.day}</SectionTitle>
            <View style={s.list}>
              {g.items.map((h, i) => {
                const cond = parseCondition(h.shortForecast, h.icon, h.isDaytime);
                const pop = h.probabilityOfPrecipitation?.value ?? 0;
                const mph = parseWindSpeedMph(h.windSpeed);
                const isFirst = groups[0] === g && i === 0;
                return (
                  <View key={h.startTime} style={[s.row, i < g.items.length - 1 && s.rowBorder]}>
                    <Text style={s.time}>{isFirst ? "Now" : hourLabel(h.startTime, clock24h, tz)}</Text>
                    <WeatherGlyph code={cond.code} isDay={cond.isDay} size={26} accent={skyFor(cond.code, cond.isDay).accent} />
                    <Text style={s.desc} numberOfLines={1}>
                      {h.shortForecast}
                    </Text>
                    <Text style={[s.pop, { opacity: pop >= 10 ? 1 : 0.25 }]}>{Math.round(pop)}%</Text>
                    <Text style={s.windText}>
                      {mph != null ? displayWind(mph * 1.609, wind) : "--"} {h.windDirection}
                    </Text>
                    <Text style={s.temp}>{displayTempF(h.temperature, temp)}°</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingBottom: 120, paddingTop: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.fg },
  list: { ...card, paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderColor: colors.line },
  time: { width: 42, fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.fg },
  desc: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.fgDim },
  pop: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#7fd4ff", width: 36, textAlign: "right" },
  windText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.fgFaint, width: 58, textAlign: "right" },
  temp: { width: 46, fontFamily: fonts.display, fontSize: 19, color: colors.fg, textAlign: "right" },
});
