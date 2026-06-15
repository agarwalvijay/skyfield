import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Tides } from "@/lib/weather/tides";
import { card, colors, fonts } from "@/theme";

function fmtTime(t: number, tz?: string): string {
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export function TidesCard({ tides, timeZone }: { tides: Tides; timeZone?: string }) {
  return (
    <View style={[card, s.wrap]}>
      <View style={s.head}>
        <Text style={s.title}>TIDES</Text>
        <Text style={s.station} numberOfLines={1}>
          {tides.stationName} · {tides.distanceKm} km
        </Text>
      </View>
      <View style={s.row}>
        {tides.events.map((e) => (
          <View key={e.time} style={s.cell}>
            <Text style={[s.arrow, { color: e.type === "high" ? "#5db8ff" : colors.fgFaint }]}>
              {e.type === "high" ? "▲" : "▼"}
            </Text>
            <Text style={s.type}>{e.type === "high" ? "High" : "Low"}</Text>
            <Text style={s.time}>{fmtTime(e.time, timeZone)}</Text>
            <Text style={s.ht}>{e.heightFt.toFixed(1)} ft</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, marginTop: 14 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 8 },
  title: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.fgFaint },
  station: { fontFamily: fonts.body, fontSize: 11, color: colors.fgFaint, flexShrink: 1 },
  row: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  arrow: { fontSize: 13 },
  type: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.fg },
  time: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg },
  ht: { fontFamily: fonts.body, fontSize: 11, color: colors.fgFaint },
});
