import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { card, colors, fonts } from "@/theme";

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={seg.wrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[seg.btn, active && seg.btnActive]}
          >
            <Text style={[seg.label, active && seg.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    padding: 3,
  },
  btn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  btnActive: { backgroundColor: colors.fg },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.fgFaint },
  labelActive: { color: "#0a0e1a" },
});

/* ---------- Metric tile ---------- */
export function MetricTile({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <View style={mt.tile}>
      <Text style={mt.label}>{label.toUpperCase()}</Text>
      <View style={mt.valueRow}>
        <Text style={mt.value}>{value}</Text>
        {unit ? <Text style={mt.unit}>{unit}</Text> : null}
      </View>
      {sub ? <Text style={mt.sub}>{sub}</Text> : null}
    </View>
  );
}

const mt = StyleSheet.create({
  tile: { ...card, flexBasis: "48%", flexGrow: 1, padding: 15, minHeight: 92, justifyContent: "flex-end" },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.fgFaint,
    marginBottom: "auto" as never,
  },
  valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 8 },
  value: { fontFamily: fonts.bodyBold, fontSize: 28, color: colors.fg },
  unit: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fgFaint, marginLeft: 3 },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.fgFaint, marginTop: 3 },
});

/* ---------- States ---------- */
export function LoadingBlock() {
  return (
    <View style={st.box}>
      <ActivityIndicator color={colors.fgDim} />
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={st.box}>
      <Text style={st.msg}>{message ?? "Couldn't load weather data."}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={st.retry}>
          <Text style={st.retryText}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyBlock({ children }: { children: string }) {
  return (
    <View style={st.box}>
      <Text style={st.msg}>{children}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  box: { ...card, padding: 24, alignItems: "center", gap: 12 },
  msg: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.fgDim,
    textAlign: "center",
    lineHeight: 21,
  },
  retry: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  retryText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg },
});

/* ---------- Section title ---------- */
export function SectionTitle({ children }: { children: string }) {
  return <Text style={sec.title}>{children.toUpperCase()}</Text>;
}

const sec = StyleSheet.create({
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.fgDim,
    marginTop: 22,
    marginBottom: 10,
    marginHorizontal: 4,
  },
});
