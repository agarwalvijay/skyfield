import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WeatherGlyph } from "./WeatherGlyph";
import type { GeoStatus } from "@/hooks/useGeolocation";
import { colors, fonts } from "@/theme";

export function Welcome({
  status,
  onUseLocation,
  onSearch,
}: {
  status: GeoStatus;
  onUseLocation: () => void;
  onSearch: () => void;
}) {
  return (
    <View style={s.wrap}>
      <WeatherGlyph code="partly" isDay size={110} accent={colors.accent} />
      <Text style={s.title}>Skyfield</Text>
      <Text style={s.sub}>
        Hyperlocal weather, radar, and alerts — straight from the U.S. National Weather Service.
      </Text>
      <View style={s.actions}>
        <Pressable style={s.primary} onPress={onUseLocation}>
          <Text style={s.primaryText}>{status === "locating" ? "Locating…" : "Use my location"}</Text>
        </Pressable>
        <Pressable style={s.ghost} onPress={onSearch}>
          <Text style={s.ghostText}>Search for a place</Text>
        </Pressable>
        {status === "denied" && (
          <Text style={s.note}>Location access was denied. You can still search for any U.S. city.</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  title: { fontFamily: fonts.display, fontSize: 52, color: colors.fg, marginTop: 16 },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.fgDim,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 320,
  },
  actions: { marginTop: 32, gap: 12, width: "100%", maxWidth: 320 },
  primary: { backgroundColor: colors.fg, borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: "#0a0e1a" },
  ghost: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  ghostText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.fgFaint, textAlign: "center" },
});
