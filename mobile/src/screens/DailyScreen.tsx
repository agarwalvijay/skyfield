import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRefresh } from "@/hooks/useRefresh";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useForecast } from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import { displayTempF } from "@/lib/format/units";
import { parseCondition } from "@/lib/weather/condition";
import { WeatherGlyph } from "@/components/WeatherGlyph";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { card, colors, fonts } from "@/theme";
import { groupDaily, rangeBounds } from "@/lib/weather/daily";

export function DailyScreen({ accent }: { accent: string }) {
  const { meta } = useWeatherCtx();
  const forecast = useForecast(meta);
  const { temp } = useSettings();
  const [open, setOpen] = useState<string | null>(null);
  const { refreshing, onRefresh } = useRefresh();

  const days = useMemo(() => groupDaily(forecast.data ?? []), [forecast.data]);
  const { gMin, gMax } = useMemo(() => rangeBounds(days), [days]);

  return (
    <ScrollView
      contentContainerStyle={s.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f3f6fc" colors={["#2a6df4"]} />
      }
    >
      <Text style={s.title}>7-Day</Text>

      {forecast.isLoading && <LoadingBlock />}
      {forecast.error ? <ErrorBlock onRetry={() => forecast.refetch()} /> : null}

      {days.length > 0 && (
        <View style={s.list}>
          {days.map((d, i) => {
            const rep = d.day ?? d.night!;
            const cond = parseCondition(rep.shortForecast, rep.icon, !!d.day);
            const range = Math.max(gMax - gMin, 1);
            const lowPct = d.low != null ? ((d.low - gMin) / range) * 100 : 0;
            const highPct = d.high != null ? ((d.high - gMin) / range) * 100 : 100;
            const isOpen = open === d.key;
            return (
              <View key={d.key} style={i < days.length - 1 && s.rowBorder}>
                <Pressable style={s.row} onPress={() => setOpen(isOpen ? null : d.key)}>
                  <Text style={s.name}>{i === 0 ? "Today" : d.name}</Text>
                  <Text style={s.pop}>{d.pop >= 10 ? `${Math.round(d.pop)}%` : ""}</Text>
                  <WeatherGlyph code={cond.code} isDay={cond.isDay} size={28} accent={accent} />
                  <Text style={s.low}>{d.low != null ? `${displayTempF(d.low, temp)}°` : "--"}</Text>
                  <View style={s.bar}>
                    <View
                      style={[
                        s.barFill,
                        { left: `${lowPct}%`, right: `${100 - highPct}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                  <Text style={s.high}>{d.high != null ? `${displayTempF(d.high, temp)}°` : "--"}</Text>
                </Pressable>
                {isOpen && (
                  <View style={s.detail}>
                    {d.day && (
                      <Text style={s.detailText}>
                        <Text style={s.detailName}>{d.day.name}. </Text>
                        {d.day.detailedForecast}
                      </Text>
                    )}
                    {d.night && (
                      <Text style={s.detailText}>
                        <Text style={s.detailName}>{d.night.name}. </Text>
                        {d.night.detailedForecast}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingBottom: 120, paddingTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.fg, marginBottom: 14 },
  list: { ...card, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderColor: colors.line },
  name: { width: 64, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.fg },
  pop: { width: 34, fontFamily: fonts.bodyBold, fontSize: 11.5, color: "#7fd4ff", textAlign: "center" },
  low: { width: 36, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fgDim, textAlign: "right" },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.13)", overflow: "hidden" },
  barFill: { position: "absolute", top: 0, bottom: 0, borderRadius: 3 },
  high: { width: 42, fontFamily: fonts.display, fontSize: 18, color: colors.fg, textAlign: "right" },
  detail: { paddingBottom: 14, gap: 6 },
  detailText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.fgDim },
  detailName: { fontFamily: fonts.bodyBold, color: colors.fg },
});
