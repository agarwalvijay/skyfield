import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import type { SavedLocation } from "@/store/locations";
import {
  GPS_LOCATION_ID,
  readSavedLocations,
  readWidgetConfig,
  writeWidgetConfig,
} from "./widgetConfigStore";
import { fetchWidgetWeatherQuick } from "./widgetData";
import { LargeWidget, SmallWidget } from "./SkyfieldWidgets";
import { colors } from "@/theme";

/**
 * Native widget configuration activity: pick which location this widget
 * follows. Shown when the widget is added and via long-press → Reconfigure.
 */
export function WidgetConfigScreen({
  widgetInfo,
  renderWidget,
  setResult,
}: WidgetConfigurationScreenProps) {
  const [saved, setSaved] = useState<SavedLocation[]>([]);
  const [choice, setChoice] = useState<string>("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setSaved(await readSavedLocations());
      setChoice((await readWidgetConfig(widgetInfo.widgetId)).locationId);
    })();
  }, [widgetInfo.widgetId]);

  const done = async () => {
    if (saving) return;
    setSaving(true);
    // Whatever happens, the widget must render and the activity must close —
    // otherwise Android leaves an invisible widget on the home screen.
    let data = null;
    try {
      await writeWidgetConfig(widgetInfo.widgetId, { locationId: choice });
      data = await fetchWidgetWeatherQuick(widgetInfo.widgetId);
    } catch {
      /* render placeholder below */
    }
    try {
      renderWidget(
        widgetInfo.widgetName === "SkyfieldLarge" ? (
          <LargeWidget data={data} />
        ) : (
          <SmallWidget data={data} />
        ),
      );
    } finally {
      setResult("ok");
    }
  };

  const Option = ({ id, label, sub }: { id: string; label: string; sub?: string }) => (
    <Pressable
      style={[s.option, choice === id && s.optionActive]}
      onPress={() => setChoice(id)}
    >
      <View style={[s.radio, choice === id && s.radioActive]} />
      <View style={{ flex: 1 }}>
        <Text style={s.optionLabel}>{label}</Text>
        {sub ? <Text style={s.optionSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Widget Location</Text>
      <Text style={s.sub}>Choose which location this widget shows.</Text>
      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        <Option
          id={GPS_LOCATION_ID}
          label="Current Location"
          sub="Always tracks your device's GPS"
        />
        <Option id="active" label="Follow the app" sub="Mirrors the app's selected location" />
        {saved.map((l) => (
          <Option key={l.id} id={l.id} label={l.label} sub={l.sublabel} />
        ))}
        {saved.length === 0 && (
          <Text style={s.hint}>No saved locations yet — add some in the app to pin one here.</Text>
        )}
      </ScrollView>
      <View style={s.actions}>
        <Pressable style={s.ghost} onPress={() => setResult("cancel")} disabled={saving}>
          <Text style={s.ghostText}>Cancel</Text>
        </Pressable>
        <Pressable style={s.primary} onPress={done} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#0a0e1a" />
          ) : (
            <Text style={s.primaryText}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.sheetBg, padding: 22, paddingTop: 54 },
  title: { fontWeight: "600" as const, fontSize: 28, color: colors.fg },
  sub: {  fontSize: 14, color: colors.fgDim, marginTop: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionActive: { backgroundColor: colors.glass, borderColor: colors.glassBorder },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.fgFaint,
  },
  radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionLabel: { fontWeight: "600" as const, fontSize: 15, color: colors.fg },
  optionSub: {  fontSize: 12, color: colors.fgFaint, marginTop: 1 },
  hint: {  fontSize: 13, color: colors.fgFaint, padding: 14 },
  actions: { flexDirection: "row", gap: 12 },
  primary: {
    flex: 1,
    backgroundColor: colors.fg,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700" as const, fontSize: 15, color: "#0a0e1a" },
  ghost: {
    flex: 1,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ghostText: { fontWeight: "600" as const, fontSize: 15, color: colors.fg },
});
