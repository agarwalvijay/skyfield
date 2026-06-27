import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { colors, fonts } from "@/theme";
import type { SavedLocation } from "@/store/locations";

export type TabId = "now" | "hourly" | "daily" | "radar" | "more";

/* ---------- Tab bar ---------- */
const ICONS: Record<TabId, React.ReactNode> = {
  now: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" strokeLinecap="round" />
    </>
  ),
  hourly: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  daily: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      <Path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </>
  ),
  radar: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={4.5} />
      <Path d="M12 12L19 7" strokeLinecap="round" />
    </>
  ),
  more: <Path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />,
};

const LABELS: Record<TabId, string> = {
  now: "Now",
  hourly: "Hourly",
  daily: "7-Day",
  radar: "Radar",
  more: "More",
};

export function TabBar({
  active,
  onChange,
  alertCount,
  bottomInset,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  alertCount: number;
  bottomInset: number;
}) {
  return (
    <View style={[tb.wrap, { bottom: 14 + bottomInset }]}>
      {(Object.keys(LABELS) as TabId[]).map((t) => {
        const isActive = active === t;
        return (
          <Pressable key={t} style={[tb.tab, isActive && tb.tabActive]} onPress={() => onChange(t)}>
            <View>
              <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={isActive ? colors.fg : colors.fgFaint} strokeWidth={2}>
                {ICONS[t]}
              </Svg>
              {t === "radar" && alertCount > 0 && <View style={tb.dot} />}
            </View>
            <Text style={[tb.label, isActive && tb.labelActive]}>{LABELS[t]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    gap: 2,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(14,18,28,0.88)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    zIndex: 30,
  },
  tab: { alignItems: "center", gap: 2, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  tabActive: { backgroundColor: "rgba(255,255,255,0.13)" },
  label: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.fgFaint },
  labelActive: { color: colors.fg },
  dot: {
    position: "absolute",
    top: -3,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: "#0e121c",
  },
});

/* ---------- Top bar ---------- */
export function TopBar({
  location,
  nearby,
  onOpenLocations,
  onOpenMore,
  topInset,
}: {
  location: SavedLocation | null;
  /** Nearest named place from NWS, shown under "Current Location". */
  nearby?: string;
  onOpenLocations: () => void;
  /** When set (tablet dashboard), shows a settings button — the dashboard has
   *  no bottom tab bar, so this is how you reach More/settings. */
  onOpenMore?: () => void;
  topInset: number;
}) {
  return (
    <View style={[top.wrap, { paddingTop: topInset + 10 }]}>
      <Pressable style={top.loc} onPress={onOpenLocations}>
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
          {location?.isCurrent ? (
            <>
              <Circle cx={12} cy={12} r={3} />
              <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </>
          ) : (
            <>
              <Path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={2.4} />
            </>
          )}
        </Svg>
        <View style={{ flexShrink: 1 }}>
          <Text style={top.label} numberOfLines={1}>
            {location?.label ?? "Choose location"}
          </Text>
          {location?.isCurrent && nearby ? (
            <Text style={top.sub} numberOfLines={1}>
              near {nearby}
            </Text>
          ) : null}
        </View>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.fgDim} strokeWidth={2.2}>
          <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable style={top.iconBtn} onPress={onOpenLocations}>
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
            <Line x1={4} y1={7} x2={20} y2={7} strokeLinecap="round" />
            <Line x1={4} y1={12} x2={20} y2={12} strokeLinecap="round" />
            <Line x1={4} y1={17} x2={14} y2={17} strokeLinecap="round" />
          </Svg>
        </Pressable>
        {onOpenMore ? (
          <Pressable style={top.iconBtn} onPress={onOpenMore}>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
              <Circle cx={12} cy={12} r={3} />
              <Path
                d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.65 1.65 0 0 0-2.81 1.17V21a2 2 0 0 1-4 0v-.18a1.65 1.65 0 0 0-2.81-1.17l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.65 1.65 0 0 0 4.6 13a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 6.4l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.65 1.65 0 0 0 10.24 3H10a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.81 1.17l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.65 1.65 0 0 0 21 10.24V10a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const top = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },
  loc: { flexDirection: "row", alignItems: "center", gap: 7, maxWidth: "74%", padding: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
  sub: { fontFamily: fonts.body, fontSize: 11, color: colors.fgFaint, marginTop: -1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
});
