import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Nowcast, PrecipType } from "@/lib/nowcast/openmeteo";
import { card, colors, fonts } from "@/theme";

const TYPE_COLOR: Record<PrecipType, string> = {
  rain: "#5db8ff",
  snow: "#eaf4ff",
  mix: "#c4a6ff",
  none: "#5db8ff",
};

/** MinuteCast-style strip: summary + 15-minute precip bars for the next 2h. */
export function NowcastCard({ nowcast }: { nowcast: Nowcast }) {
  const { intervals, summary, type } = nowcast;
  const anyWet = intervals.some((i) => i.wet);
  const maxMm = Math.max(0.5, ...intervals.map((i) => i.precipMm));
  const accent = TYPE_COLOR[type] ?? "#5db8ff";

  // Deterministic labels: oldest time · Now · newest time.
  const nowIdx = intervals.reduce(
    (best, iv, i) =>
      Math.abs(iv.minutesFromNow) < Math.abs(intervals[best].minutesFromNow) ? i : best,
    0,
  );
  const lastIdx = intervals.length - 1;
  const fmtOffset = (min: number) => {
    if (Math.abs(min) >= 55) return `${Math.round(min / 60)}h`;
    const m = Math.round(min / 5) * 5;
    return `${m > 0 ? "+" : ""}${m}m`;
  };
  const labelFor = (i: number, min: number) =>
    i === nowIdx ? "Now" : i === 0 || i === lastIdx ? fmtOffset(min) : "";

  return (
    <View style={[card, s.wrap]}>
      <Text style={s.eyebrow}>{(nowcast.title ?? "Next 2 hours").toUpperCase()}</Text>
      <Text style={[s.summary, { color: anyWet ? accent : colors.fgDim }]}>{summary}</Text>

      {anyWet && (
        <View style={s.bars}>
          {intervals.map((iv, i) => {
            const h = iv.wet ? Math.max(8, (iv.precipMm / maxMm) * 100) : 3;
            const label = labelFor(i, iv.minutesFromNow);
            return (
              <View key={iv.time} style={s.col}>
                <View style={s.track}>
                  <View
                    style={{
                      width: "70%",
                      height: `${h}%`,
                      minHeight: 2,
                      borderRadius: 3,
                      backgroundColor: iv.wet ? TYPE_COLOR[iv.type] : "rgba(255,255,255,0.15)",
                      opacity: iv.estimated ? 0.45 : 1,
                      borderWidth: iv.estimated ? 1 : 0,
                      borderColor: "rgba(255,255,255,0.3)",
                      borderStyle: "dashed",
                    }}
                  />
                </View>
                <Text style={s.label}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, marginTop: 16 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: colors.fgFaint },
  summary: { fontFamily: fonts.bodyBold, fontSize: 17, marginTop: 4 },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 56, marginTop: 12, gap: 3 },
  col: { flex: 1, alignItems: "center", height: "100%", gap: 4 },
  track: { flex: 1, width: "100%", alignItems: "center", justifyContent: "flex-end" },
  label: { fontFamily: fonts.bodyBold, fontSize: 9.5, color: colors.fgFaint, height: 11 },
});
