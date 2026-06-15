import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { Coordinates, GridSeries, HourlyPeriod } from "@/lib/nws";
import { useSettings } from "@/store/settings";
import {
  compassToDeg,
  cToF,
  displayTempF,
  displayWind,
  parseWindSpeedMph,
  windUnitLabel,
} from "@/lib/format/units";
import { dayShort, hourLabel } from "@/lib/format/time";
import { isDaylight } from "@/lib/weather/sun";
import { card, colors, fonts } from "@/theme";

const PX = 22;
const PAD_L = 10;
const PAD_R = 14;
const ARROW_Y = 16;
const PLOT_TOP = 34;
const PLOT_H = 220;
const HOUR_Y = PLOT_TOP + PLOT_H + 20;
const SVG_H = HOUR_Y + 10;
const PRECIP_H = 80;

const SERIES = {
  temp: { label: "Temp", color: "#ffd166" },
  feels: { label: "Feels Like", color: "#ff6b6b" },
  dew: { label: "Dew Pt", color: "#ff9f43" },
  humidity: { label: "Humidity", color: "#e879f9" },
  wind: { label: "Wind", color: "#4ade80" },
  gust: { label: "Gusts", color: "#22d3ee" },
  cloud: { label: "Clouds", color: "#cbd5e1" },
  pop: { label: "Precip %", color: "#5db8ff" },
} as const;
type SeriesKey = keyof typeof SERIES;
const DEFAULT_OFF: SeriesKey[] = ["feels", "dew", "gust"];

interface Pt {
  x: number;
  v: number | null;
}
function segments(pts: Pt[], y: (v: number) => number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const p of pts) {
    if (p.v == null) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur += cur ? ` L ${p.x} ${y(p.v)}` : `M ${p.x} ${y(p.v)}`;
  }
  if (cur) out.push(cur);
  return out;
}

export function HourlyGraph({
  periods,
  grid,
  coords,
  timeZone,
}: {
  periods: HourlyPeriod[];
  grid: GridSeries | undefined;
  coords: Coordinates | null;
  timeZone?: string;
}) {
  const { temp, wind, clock24h, imperialDistance } = useSettings();
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set(DEFAULT_OFF));
  const [scrub, setScrub] = useState<number | null>(null);

  const hours = useMemo(() => periods.slice(0, 72), [periods]);

  const data = useMemo(
    () =>
      hours.map((h, i) => {
        const eh = Math.floor(Date.parse(h.startTime) / 3_600_000);
        const mid = new Date(Date.parse(h.startTime) + 30 * 60_000);
        const isDay = coords ? isDaylight(mid, coords.lat, coords.lon) : h.isDaytime;
        return {
          x: PAD_L + i * PX + PX / 2,
          time: h.startTime,
          isDay,
          tempF: h.temperatureUnit === "C" ? cToF(h.temperature) : h.temperature,
          feelsF: grid?.apparentC.has(eh) ? cToF(grid.apparentC.get(eh)!) : null,
          dewF: h.dewpoint?.value != null ? cToF(h.dewpoint.value) : null,
          gustMph: grid?.gustKmh.has(eh) ? grid.gustKmh.get(eh)! / 1.609 : null,
          humidity: h.relativeHumidity?.value ?? null,
          pop: h.probabilityOfPrecipitation?.value ?? null,
          windMph: parseWindSpeedMph(h.windSpeed),
          windDir: h.windDirection,
          cloud: grid?.skyCover.get(eh) ?? null,
          qpfMm: grid?.qpfMm.get(eh) ?? 0,
          snowMm: grid?.snowMm.get(eh) ?? 0,
        };
      }),
    [hours, grid, coords],
  );

  const width = PAD_L + hours.length * PX + PAD_R;

  // Per-family vertical scales so each reads on its own range. Temperature
  // (with feels/dew) auto-fits the day's actual min→max — this is what makes
  // the daily high AND low clearly visible instead of squished near the top of
  // a fixed 0–100 axis. The left axis is labeled in degrees (the headline
  // series); % series (humidity/precip/cloud) and wind keep their own scaling.
  const tempRange = useMemo(() => {
    const vals: number[] = [];
    for (const d of data) {
      if (!hidden.has("temp") && d.tempF != null) vals.push(d.tempF);
      if (!hidden.has("feels") && d.feelsF != null) vals.push(d.feelsF);
      if (!hidden.has("dew") && d.dewF != null) vals.push(d.dewF);
    }
    if (!vals.length) return { lo: 0, hi: 100 };
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(4, (hi - lo) * 0.18);
    return { lo: lo - pad, hi: hi + pad };
  }, [data, hidden]);

  const windMax = useMemo(() => {
    let m = 1;
    for (const d of data) m = Math.max(m, d.windMph ?? 0, d.gustMph ?? 0);
    return m * 1.1;
  }, [data]);

  const tempTicks = useMemo(() => {
    const { lo, hi } = tempRange;
    return [0, 1, 2, 3, 4].map((i) => Math.round(lo + ((hi - lo) * i) / 4));
  }, [tempRange]);

  const yTemp = (v: number) =>
    PLOT_TOP + (1 - (v - tempRange.lo) / (tempRange.hi - tempRange.lo)) * PLOT_H;
  const yPct = (v: number) => PLOT_TOP + (1 - v / 100) * PLOT_H;
  const yWind = (v: number) => PLOT_TOP + (1 - v / windMax) * PLOT_H;

  const nights = useMemo(() => {
    const bands: { x0: number; x1: number }[] = [];
    let start: number | null = null;
    data.forEach((d, i) => {
      if (!d.isDay && start == null) start = PAD_L + i * PX;
      if (d.isDay && start != null) {
        bands.push({ x0: start, x1: PAD_L + i * PX });
        start = null;
      }
    });
    if (start != null) bands.push({ x0: start, x1: width - PAD_R });
    return bands;
  }, [data, width]);

  const dayMarks = useMemo(() => {
    const marks: { x: number; label: string }[] = [];
    let prev = "";
    data.forEach((d, i) => {
      const day = dayShort(d.time, timeZone);
      if (day !== prev) {
        marks.push({ x: PAD_L + i * PX, label: day });
        prev = day;
      }
    });
    return marks;
  }, [data, timeZone]);

  const mmToDisplay = (mm: number) => (imperialDistance ? mm / 25.4 : mm);
  const precipUnit = imperialDistance ? "in" : "mm";
  const precipMax = useMemo(() => {
    let m = 0;
    for (const d of data) m = Math.max(m, mmToDisplay(d.qpfMm), mmToDisplay(d.snowMm));
    return Math.max(m, imperialDistance ? 0.05 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, imperialDistance]);
  const hasPrecip = data.some((d) => d.qpfMm > 0.01 || d.snowMm > 0.01);

  const show = (k: SeriesKey) => !hidden.has(k) && !(k === "cloud" && !grid);
  const toggle = (k: SeriesKey) =>
    setHidden((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const sd = scrub != null ? data[scrub] : null;

  return (
    <View style={s.cardWrap}>
      <View style={s.legend}>
        {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
          <Pressable key={k} style={[s.chip, !show(k) && s.chipOff]} onPress={() => toggle(k)}>
            <View style={[s.chipDot, { backgroundColor: SERIES[k].color }]} />
            <Text style={s.chipText}>{SERIES[k].label}</Text>
          </Pressable>
        ))}
      </View>

      <View>
        {/* Pinned y-axis */}
        <View style={s.axisPin} pointerEvents="none">
          {tempTicks.map((t) => (
            <Text key={t} style={[s.axisLabel, { top: yTemp(t) - 8 }]}>
              {displayTempF(t, temp)}°
            </Text>
          ))}
          <Text style={[s.axisLabel, { top: SVG_H + 2 }]}>
            {precipMax.toFixed(imperialDistance ? 2 : 1)} {precipUnit}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            onPress={(e) => {
              const x = e.nativeEvent.locationX - PAD_L;
              const idx = Math.max(0, Math.min(hours.length - 1, Math.round((x - PX / 2) / PX)));
              setScrub((cur) => (cur === idx ? null : idx));
            }}
          >
            <Svg width={width} height={SVG_H}>
              {nights.map((n, i) => (
                <Rect key={i} x={n.x0} y={PLOT_TOP - 6} width={n.x1 - n.x0} height={PLOT_H + 12} fill="rgba(2,6,18,0.35)" rx={6} />
              ))}
              {tempTicks.map((t) => (
                <Line key={t} x1={PAD_L} x2={width - PAD_R} y1={yTemp(t)} y2={yTemp(t)} stroke="rgba(255,255,255,0.08)" />
              ))}
              {dayMarks.map((m) => (
                <G key={m.x}>
                  <Line x1={m.x} x2={m.x} y1={PLOT_TOP - 20} y2={PLOT_TOP + PLOT_H} stroke="rgba(255,255,255,0.14)" strokeDasharray="3 4" />
                  <SvgText x={m.x + 5} y={PLOT_TOP - 8} fill="rgba(243,246,252,0.85)" fontSize={11} fontWeight="bold">
                    {m.label}
                  </SvgText>
                </G>
              ))}
              {show("wind") &&
                data.map((d, i) => {
                  if (i % 3 !== 0) return null;
                  const from = compassToDeg(d.windDir ?? "");
                  if (from == null) return null;
                  return (
                    <G key={`a${i}`} transform={`translate(${d.x} ${ARROW_Y}) rotate(${from + 180})`}>
                      <Path d="M0 5 L0 -3 M0 -5 L-3.5 0 M0 -5 L3.5 0" stroke={SERIES.wind.color} strokeWidth={1.8} strokeLinecap="round" fill="none" />
                    </G>
                  );
                })}
              {show("cloud") &&
                segments(data.map((d) => ({ x: d.x, v: d.cloud })), yPct).map((p, i) => (
                  <Path key={`c${i}`} d={p} fill="none" stroke={SERIES.cloud.color} strokeWidth={1.6} opacity={0.75} />
                ))}
              {show("pop") &&
                segments(data.map((d) => ({ x: d.x, v: d.pop })), yPct).map((p, i) => (
                  <Path key={`p${i}`} d={p} fill="none" stroke={SERIES.pop.color} strokeWidth={2} />
                ))}
              {show("humidity") &&
                segments(data.map((d) => ({ x: d.x, v: d.humidity })), yPct).map((p, i) => (
                  <Path key={`h${i}`} d={p} fill="none" stroke={SERIES.humidity.color} strokeWidth={2} />
                ))}
              {show("wind") &&
                segments(data.map((d) => ({ x: d.x, v: d.windMph })), yWind).map((p, i) => (
                  <Path key={`w${i}`} d={p} fill="none" stroke={SERIES.wind.color} strokeWidth={2} />
                ))}
              {show("gust") &&
                segments(data.map((d) => ({ x: d.x, v: d.gustMph })), yWind).map((p, i) => (
                  <Path key={`g${i}`} d={p} fill="none" stroke={SERIES.gust.color} strokeWidth={1.8} strokeDasharray="4 3" />
                ))}
              {show("dew") &&
                segments(data.map((d) => ({ x: d.x, v: d.dewF })), yTemp).map((p, i) => (
                  <Path key={`d${i}`} d={p} fill="none" stroke={SERIES.dew.color} strokeWidth={2} />
                ))}
              {show("feels") &&
                segments(data.map((d) => ({ x: d.x, v: d.feelsF })), yTemp).map((p, i) => (
                  <Path key={`f${i}`} d={p} fill="none" stroke={SERIES.feels.color} strokeWidth={2} strokeDasharray="6 4" />
                ))}
              {show("temp") &&
                segments(data.map((d) => ({ x: d.x, v: d.tempF })), yTemp).map((p, i) => (
                  <Path key={`t${i}`} d={p} fill="none" stroke={SERIES.temp.color} strokeWidth={2.6} />
                ))}
              {show("temp") &&
                data.map((d, i) =>
                  i % 3 === 0 ? (
                    <SvgText key={`tl${i}`} x={d.x} y={yTemp(d.tempF) - 8} fill={SERIES.temp.color} fontSize={10.5} fontWeight="bold" textAnchor="middle">
                      {displayTempF(d.tempF, temp)}°
                    </SvgText>
                  ) : null,
                )}
              {data.map((d, i) =>
                i % 3 === 0 ? (
                  <SvgText key={`x${i}`} x={d.x} y={HOUR_Y} fill="rgba(243,246,252,0.45)" fontSize={10} textAnchor="middle">
                    {hourLabel(d.time, clock24h, timeZone)}
                  </SvgText>
                ) : null,
              )}
              {sd && <Line x1={sd.x} x2={sd.x} y1={PLOT_TOP - 22} y2={PLOT_TOP + PLOT_H} stroke="#fff" strokeWidth={1.2} opacity={0.85} />}
            </Svg>

            {/* Precip chart */}
            <Svg width={width} height={PRECIP_H + 8}>
              {nights.map((n, i) => (
                <Rect key={i} x={n.x0} y={0} width={n.x1 - n.x0} height={PRECIP_H} fill="rgba(2,6,18,0.35)" rx={6} />
              ))}
              <Line x1={PAD_L} x2={width - PAD_R} y1={PRECIP_H} y2={PRECIP_H} stroke="rgba(255,255,255,0.14)" />
              {!hasPrecip && (
                <SvgText x={PAD_L + 4} y={PRECIP_H - 10} fill="rgba(243,246,252,0.35)" fontSize={11}>
                  No precipitation expected
                </SvgText>
              )}
              {data.map((d, i) => {
                const qh = (mmToDisplay(d.qpfMm) / precipMax) * (PRECIP_H - 14);
                const sh = (mmToDisplay(d.snowMm) / precipMax) * (PRECIP_H - 14);
                return (
                  <G key={`pb${i}`}>
                    {qh > 0.5 && <Rect x={d.x - 6} y={PRECIP_H - qh} width={sh > 0.5 ? 6 : 12} height={qh} rx={2} fill="#5db8ff" opacity={0.85} />}
                    {sh > 0.5 && <Rect x={d.x + 0.5} y={PRECIP_H - sh} width={6} height={sh} rx={2} fill="#eef3fb" opacity={0.9} />}
                  </G>
                );
              })}
              {sd && <Line x1={sd.x} x2={sd.x} y1={0} y2={PRECIP_H} stroke="#fff" strokeWidth={1.2} opacity={0.85} />}
            </Svg>
          </Pressable>
        </ScrollView>
      </View>

      {/* Inspect readout */}
      {sd ? (
        <View style={s.tip}>
          <Text style={s.tipTime}>
            {dayShort(sd.time, timeZone)} · {hourLabel(sd.time, clock24h, timeZone)}
          </Text>
          <View style={s.tipRow}>
            {show("temp") && <TipItem color={SERIES.temp.color} text={`${displayTempF(sd.tempF, temp)}°`} />}
            {sd.feelsF != null && show("feels") && <TipItem color={SERIES.feels.color} text={`feels ${displayTempF(sd.feelsF, temp)}°`} />}
            {sd.dewF != null && show("dew") && <TipItem color={SERIES.dew.color} text={`dew ${displayTempF(sd.dewF, temp)}°`} />}
            {sd.humidity != null && show("humidity") && <TipItem color={SERIES.humidity.color} text={`${Math.round(sd.humidity)}% hum`} />}
            {sd.windMph != null && show("wind") && (
              <TipItem color={SERIES.wind.color} text={`${displayWind(sd.windMph * 1.609, wind)} ${windUnitLabel(wind)} ${sd.windDir}`} />
            )}
            {sd.gustMph != null && show("gust") && <TipItem color={SERIES.gust.color} text={`gusts ${displayWind(sd.gustMph * 1.609, wind)}`} />}
            {sd.cloud != null && show("cloud") && <TipItem color={SERIES.cloud.color} text={`${Math.round(sd.cloud)}% clouds`} />}
            {sd.pop != null && show("pop") && <TipItem color={SERIES.pop.color} text={`${Math.round(sd.pop)}% precip`} />}
          </View>
        </View>
      ) : (
        <Text style={s.hint}>Tap the chart to read exact values · scroll for 3 days</Text>
      )}
    </View>
  );
}

function TipItem({ color, text }: { color: string; text: string }) {
  return (
    <View style={s.tipItem}>
      <View style={[s.chipDot, { backgroundColor: color }]} />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  cardWrap: { ...card, backgroundColor: "rgba(8,13,26,0.55)", paddingVertical: 12, overflow: "hidden" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOff: { opacity: 0.38 },
  chipDot: { width: 9, height: 9, borderRadius: 3 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.fgDim },
  axisPin: { position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 4 },
  axisLabel: {
    position: "absolute",
    left: 4,
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: "rgba(243,246,252,0.55)",
    backgroundColor: "rgba(8,13,26,0.72)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: "hidden",
  },
  tip: { paddingHorizontal: 14, paddingTop: 10 },
  tipTime: { fontFamily: fonts.bodyExtra, fontSize: 13, color: colors.fg, marginBottom: 6 },
  tipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tipItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  tipText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.fgDim },
  hint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.fgFaint, textAlign: "center", marginTop: 8 },
});
