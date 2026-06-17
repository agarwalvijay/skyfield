import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { WeatherAlert } from "@/lib/nws";
import { alertColor } from "@/lib/weather/alertColor";
import { fullTime } from "@/lib/format/time";
import { useSettings } from "@/store/settings";
import { colors, fonts } from "@/theme";

export function AlertBanner({ alerts }: { alerts: WeatherAlert[] }) {
  const [open, setOpen] = useState<WeatherAlert | null>(null);
  const toggleMutedAlert = useSettings((st) => st.toggleMutedAlert);
  const top = alerts[0];
  if (!top) return null;
  const color = alertColor(top.severity);

  return (
    <>
      <Pressable style={[s.banner, { backgroundColor: color }]} onPress={() => setOpen(top)}>
        <View style={s.pulse} />
        <Text style={s.bannerText} numberOfLines={1}>
          {top.event}
        </Text>
        {alerts.length > 1 && (
          <View style={s.count}>
            <Text style={s.countText}>+{alerts.length - 1}</Text>
          </View>
        )}
        <Pressable
          style={s.bannerBell}
          hitSlop={8}
          onPress={() => toggleMutedAlert(top.event)}
          accessibilityLabel={`Mute ${top.event}`}
        >
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
            <Path d="M13.73 21a2 2 0 0 1-3.46 0M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-1-1.4-2-4" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M3 3l18 18" strokeLinecap="round" />
          </Svg>
        </Pressable>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4}>
          <Path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <Modal visible={!!open} animationType="slide" transparent onRequestClose={() => setOpen(null)}>
        <View style={s.scrim}>
          <View style={s.panel}>
            <View style={s.head}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                {alerts.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => setOpen(a)}
                    style={[s.chip, { borderColor: alertColor(a.severity) }, a.id === open?.id && s.chipActive]}
                  >
                    <Text style={[s.chipText, a.id === open?.id && { color: colors.fg }]}>{a.event}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={s.close} onPress={() => setOpen(null)}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
                  <Path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
            {open && (
              <ScrollView contentContainerStyle={s.body}>
                <Text style={[s.title, { color: alertColor(open.severity) }]}>{open.event}</Text>
                <View style={s.tags}>
                  {[open.severity, open.urgency, open.certainty].map((t) => (
                    <View key={t} style={s.tag}>
                      <Text style={s.tagText}>{t.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  style={s.mute}
                  onPress={() => {
                    toggleMutedAlert(open.event);
                    setOpen(null);
                  }}
                >
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.fgDim} strokeWidth={2}>
                    <Path d="M13.73 21a2 2 0 0 1-3.46 0M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-1-1.4-2-4" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M3 3l18 18" strokeLinecap="round" />
                  </Svg>
                  <Text style={s.muteText}>Mute “{open.event}” — hide &amp; stop alerts</Text>
                </Pressable>
                {open.headline && <Text style={s.headline}>{open.headline}</Text>}
                <Text style={s.meta}>{open.areaDesc}</Text>
                {open.effective && (
                  <Text style={s.meta}>
                    In effect {fullTime(open.effective, false)}
                    {open.expires ? ` → ${fullTime(open.expires, false)}` : ""}
                  </Text>
                )}
                <Text style={s.mono}>{open.description}</Text>
                {open.instruction && (
                  <>
                    <Text style={s.precaution}>PRECAUTIONARY / PREPAREDNESS ACTIONS</Text>
                    <Text style={s.mono}>{open.instruction}</Text>
                  </>
                )}
                <Text style={[s.meta, { marginTop: 16 }]}>Issued by {open.sender}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  mute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  muteText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.fgDim },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    zIndex: 18,
  },
  pulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" },
  bannerText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: "#fff" },
  bannerBell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  count: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  countText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#fff" },
  scrim: { flex: 1, backgroundColor: "rgba(4,6,12,0.55)", justifyContent: "flex-end" },
  panel: {
    maxHeight: "88%",
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.glassBorder,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  chips: { gap: 8, flexDirection: "row" },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chipActive: { backgroundColor: colors.glass },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.fgDim },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  body: { padding: 20, paddingBottom: 48 },
  title: { fontFamily: fonts.display, fontSize: 26 },
  tags: { flexDirection: "row", gap: 8, marginVertical: 10, flexWrap: "wrap" },
  tag: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, color: colors.fg },
  headline: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22, color: colors.fg, marginBottom: 6 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.fgFaint, marginVertical: 3 },
  mono: {
    fontFamily: "monospace" as never,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.fgDim,
    marginTop: 10,
  },
  precaution: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.accent,
    marginTop: 18,
  },
});
