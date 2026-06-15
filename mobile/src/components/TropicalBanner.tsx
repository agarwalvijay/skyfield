import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TropicalStorm } from "@/lib/weather/tropical";
import { colors, fonts, radius } from "@/theme";

export function TropicalBanner({ storms }: { storms: TropicalStorm[] }) {
  if (!storms.length) return null;
  const st = storms[0];
  const title = st.category
    ? `${st.classification} ${st.name} · Cat ${st.category}`
    : `${st.classification} ${st.name}`;

  return (
    <View style={s.wrap}>
      <Text style={s.icon}>🌀</Text>
      <View style={s.body}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.meta}>
          {st.distanceMi} mi {st.bearing} · {st.windMph} mph · moving {st.movement}
        </Text>
        {storms.length > 1 && <Text style={s.more}>+{storms.length - 1} more active nearby</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    marginTop: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,159,64,0.4)",
    backgroundColor: "rgba(255,159,64,0.14)",
  },
  icon: { fontSize: 26 },
  body: { flex: 1 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.fg },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.fgDim, marginTop: 2 },
  more: { fontFamily: fonts.body, fontSize: 11, color: colors.fgFaint, marginTop: 2 },
});
