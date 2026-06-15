import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  aqiColor,
  aqiAdvice,
  uvColor,
  uvBurnMinutes,
  uvAdvice,
  type AirQuality,
  type UvIndex,
} from "@/lib/weather/airquality";
import { sunTimes, moonPhase, moonEmoji } from "@/lib/weather/sun";
import { card, colors, fonts } from "@/theme";

function fmtTime(d: Date | null, tz?: string): string {
  if (!d) return "--";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
}
function fmtDaylight(min: number): string {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function AirSunCard({
  air,
  uv,
  lat,
  lon,
  timeZone,
}: {
  air: AirQuality | null | undefined;
  uv: UvIndex | null | undefined;
  lat: number;
  lon: number;
  timeZone?: string;
}) {
  const now = new Date();
  const sun = sunTimes(now, lat, lon);
  const moon = moonPhase(now);
  const burn = uv ? uvBurnMinutes(uv.now) : null;

  const advice =
    air && uv
      ? air.usAqi > 100
        ? aqiAdvice(air.category)
        : uv.now >= 6
          ? uvAdvice(uv.category)
          : aqiAdvice(air.category)
      : air
        ? aqiAdvice(air.category)
        : uv
          ? uvAdvice(uv.category)
          : null;

  return (
    <View style={[card, s.wrap]}>
      <Text style={s.title}>AIR &amp; SUN</Text>

      <View style={s.gauges}>
        {air && (
          <View style={s.gauge}>
            <View style={[s.ring, { borderColor: aqiColor(air.category) }]}>
              <Text style={s.num}>{air.usAqi}</Text>
              <Text style={s.cap}>AQI</Text>
            </View>
            <Text style={s.label}>{air.label}</Text>
            {air.dominant && <Text style={s.sub}>{air.dominant} primary</Text>}
          </View>
        )}
        {uv && (
          <View style={s.gauge}>
            <View style={[s.ring, { borderColor: uvColor(uv.category) }]}>
              <Text style={s.num}>{Math.round(uv.now)}</Text>
              <Text style={s.cap}>UV</Text>
            </View>
            <Text style={s.label}>{uv.label}</Text>
            <Text style={s.sub}>
              {burn ? `Burn ~${burn} min` : uv.max >= 3 ? `Peaks ${Math.round(uv.max)}` : "Minimal"}
            </Text>
          </View>
        )}
      </View>

      {advice && <Text style={s.advice}>{advice}</Text>}

      <View style={s.sky}>
        <View style={s.cell}>
          <Text style={s.cellCap}>Sunrise</Text>
          <Text style={s.cellVal}>{fmtTime(sun.sunrise, timeZone)}</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.cellCap}>Sunset</Text>
          <Text style={s.cellVal}>{fmtTime(sun.sunset, timeZone)}</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.cellCap}>Daylight</Text>
          <Text style={s.cellVal}>{fmtDaylight(sun.daylightMinutes)}</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.cellCap}>Moon</Text>
          <Text style={s.cellVal}>
            {moonEmoji(moon.phase)} {Math.round(moon.illumination * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, marginTop: 14 },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.fgFaint,
    marginBottom: 12,
  },
  gauges: { flexDirection: "row", gap: 12 },
  gauge: { flex: 1, alignItems: "center", gap: 5 },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  num: { fontFamily: fonts.bodyBold, fontSize: 26, color: colors.fg, lineHeight: 28 },
  cap: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: colors.fgFaint },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.fg, textAlign: "center" },
  sub: { fontFamily: fonts.body, fontSize: 11, color: colors.fgFaint },
  advice: { fontFamily: fonts.body, fontSize: 13, color: colors.fgDim, marginTop: 12, lineHeight: 18 },
  sky: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  cellCap: { fontFamily: fonts.body, fontSize: 11, color: colors.fgFaint },
  cellVal: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg },
});
