import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ForecastPeriod } from "@/lib/nws";
import { groupDaily, rangeBounds } from "@/lib/weather/daily";
import { useSettings } from "@/store/settings";
import { displayTempF } from "@/lib/format/units";
import { parseCondition } from "@/lib/weather/condition";
import { WeatherGlyph } from "./WeatherGlyph";
import { card, colors, fonts } from "@/theme";

/** Compact multi-day strip for the Now screen (Apple-Weather style). */
export function DailyForecastCard({
  periods,
  accent,
  days = 5,
  onSeeAll,
}: {
  periods: ForecastPeriod[];
  accent: string;
  days?: number;
  onSeeAll?: () => void;
}) {
  const { temp } = useSettings();
  const all = groupDaily(periods);
  const list = all.slice(0, days);
  const { gMin, gMax } = rangeBounds(all);
  const range = Math.max(gMax - gMin, 1);

  return (
    <View style={[card, s.wrap]}>
      <View style={s.head}>
        <Text style={s.eyebrow}>{days}-DAY FORECAST</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={s.all}>7-Day ›</Text>
          </Pressable>
        )}
      </View>
      {list.map((d, i) => {
        const rep = d.day ?? d.night!;
        const cond = parseCondition(rep.shortForecast, rep.icon, !!d.day);
        const lowPct = d.low != null ? ((d.low - gMin) / range) * 100 : 0;
        const highPct = d.high != null ? ((d.high - gMin) / range) * 100 : 100;
        return (
          <View key={d.key} style={[s.row, i < list.length - 1 && s.rowBorder]}>
            <Text style={s.name}>{i === 0 ? "Today" : d.name.slice(0, 3)}</Text>
            <Text style={s.pop}>{d.pop >= 20 ? `${Math.round(d.pop)}%` : ""}</Text>
            <WeatherGlyph code={cond.code} isDay={cond.isDay} size={26} accent={accent} />
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
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, marginTop: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: colors.fgFaint },
  all: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.fgDim },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 },
  rowBorder: { borderBottomWidth: 1, borderColor: colors.line },
  name: { width: 44, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.fg },
  pop: { width: 34, fontFamily: fonts.bodyBold, fontSize: 11, color: "#7fd4ff", textAlign: "center" },
  low: { width: 36, fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.fgDim, textAlign: "right" },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.13)", overflow: "hidden" },
  barFill: { position: "absolute", top: 0, bottom: 0, borderRadius: 3 },
  high: { width: 42, fontFamily: fonts.display, fontSize: 18, color: colors.fg, textAlign: "right" },
});
