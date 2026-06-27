import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { WidgetPreview } from "react-native-android-widget";
import Svg, { Path } from "react-native-svg";
import { fetchWidgetWeatherQuick, type WidgetWeather } from "@/widgets/widgetData";
import { refreshAllWidgets } from "@/widgets/refreshWidgets";
import { LargeWidget, SmallWidget } from "@/widgets/SkyfieldWidgets";
import { useWeatherCtx } from "@/components/WeatherContext";
import { useDiscussion } from "@/hooks/useWeather";
import { useSettings } from "@/store/settings";
import { relativeTime } from "@/lib/format/time";
import { SectionTitle, Segmented } from "@/components/ui";
import { card, colors, fonts } from "@/theme";

export function MoreScreen({ accent }: { accent: string }) {
  const { meta } = useWeatherCtx();
  const settings = useSettings();
  const [readerOpen, setReaderOpen] = useState(false);
  const discussion = useDiscussion(meta, readerOpen);
  const [widgetData, setWidgetData] = useState<WidgetWeather | null>(null);

  // Re-fetch (pre-formatted) preview data when location OR units change, and
  // push the new formatting to any placed home-screen widgets.
  useEffect(() => {
    if (Platform.OS === "android") {
      fetchWidgetWeatherQuick(0).then(setWidgetData).catch(() => {});
      refreshAllWidgets();
    }
  }, [meta?.gridId, settings.temp, settings.wind]);

  return (
    <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>More</Text>

      <SectionTitle>Forecaster Discussion</SectionTitle>
      <Pressable style={s.row} onPress={() => setReaderOpen(true)}>
        <View style={[s.rowIcon, { borderColor: accent }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={1.8}>
            <Path d="M4 5h16v11H7l-3 3z" strokeLinejoin="round" />
            <Path d="M8 9h8M8 12h5" strokeLinecap="round" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Area Forecast Discussion</Text>
          <Text style={s.rowSub}>The meteorologist's full reasoning{meta ? ` · ${meta.gridId}` : ""}</Text>
        </View>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.fgFaint} strokeWidth={2}>
          <Path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <SectionTitle>Notifications</SectionTitle>
      <View style={s.settings}>
        <SettingRow label="Severe weather alerts">
          <Switch
            value={settings.alertNotifications}
            onValueChange={settings.setAlertNotifications}
            trackColor={{ true: accent, false: "rgba(255,255,255,0.2)" }}
            thumbColor="#fff"
          />
        </SettingRow>
        <View style={s.divider} />
        <SettingRow label="Rain starting / stopping">
          <Switch
            value={settings.rainNotifications}
            onValueChange={settings.setRainNotifications}
            trackColor={{ true: accent, false: "rgba(255,255,255,0.2)" }}
            thumbColor="#fff"
          />
        </SettingRow>
      </View>

      <SectionTitle>Muted Alerts</SectionTitle>
      <View style={s.settings}>
        {settings.mutedAlerts.length === 0 ? (
          <Text style={s.mutedEmpty}>
            No muted alerts. To stop seeing a hazard type (e.g. a Beach Hazards Statement), open its
            banner and tap “Mute”.
          </Text>
        ) : (
          settings.mutedAlerts.map((event, i) => (
            <View key={event}>
              {i > 0 && <View style={s.divider} />}
              <View style={s.mutedRow}>
                <Text style={s.mutedName}>{event}</Text>
                <Pressable onPress={() => settings.toggleMutedAlert(event)} hitSlop={8}>
                  <Text style={[s.mutedUnmute, { color: accent }]}>Unmute</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <SectionTitle>Units</SectionTitle>
      <View style={s.settings}>
        <SettingRow label="Temperature">
          <Segmented
            value={settings.temp}
            onChange={settings.setTemp}
            options={[
              { value: "F", label: "°F" },
              { value: "C", label: "°C" },
            ]}
          />
        </SettingRow>
        <View style={s.divider} />
        <SettingRow label="Wind speed">
          <Segmented
            value={settings.wind}
            onChange={settings.setWind}
            options={[
              { value: "mph", label: "mph" },
              { value: "kmh", label: "km/h" },
              { value: "ms", label: "m/s" },
              { value: "kn", label: "kn" },
            ]}
          />
        </SettingRow>
        <View style={s.divider} />
        <SettingRow label="Pressure">
          <Segmented
            value={settings.pressure}
            onChange={settings.setPressure}
            options={[
              { value: "inHg", label: "inHg" },
              { value: "hPa", label: "hPa" },
            ]}
          />
        </SettingRow>
        <View style={s.divider} />
        <SettingRow label="Distance">
          <Segmented
            value={settings.imperialDistance ? "mi" : "km"}
            onChange={(v) => settings.setImperialDistance(v === "mi")}
            options={[
              { value: "mi", label: "miles" },
              { value: "km", label: "km" },
            ]}
          />
        </SettingRow>
        <View style={s.divider} />
        <SettingRow label="Clock">
          <Segmented
            value={settings.clock24h ? "24" : "12"}
            onChange={(v) => settings.setClock24h(v === "24")}
            options={[
              { value: "12", label: "12h" },
              { value: "24", label: "24h" },
            ]}
          />
        </SettingRow>
      </View>

      {Platform.OS === "android" && (
        <>
          <SectionTitle>Home-Screen Widgets</SectionTitle>
          <View style={[s.settings, { padding: 14, alignItems: "center", gap: 12 }]}>
            {/* The widget bitmap is square (the OS rounds it on the home
               screen); round the preview here so it looks the same. */}
            <View style={s.previewClip}>
              <WidgetPreview
                renderWidget={() => <LargeWidget data={widgetData} />}
                width={340}
                height={70}
              />
            </View>
            <View style={s.previewClip}>
              <WidgetPreview
                renderWidget={() => <SmallWidget data={widgetData} />}
                width={250}
                height={170}
              />
            </View>
            <Text style={s.rowSub}>
              Banner and square. Add from your launcher's widget picker; long-press a widget →
              Reconfigure to pin it to a location. Widgets follow the app's units and refresh in
              the background (tap ⟳ for an instant refresh).
            </Text>
          </View>
        </>
      )}

      <SectionTitle>About</SectionTitle>
      <View style={[s.settings, { padding: 17 }]}>
        <Text style={s.about}>
          <Text style={{ fontFamily: fonts.bodyBold }}>Skyfield</Text> delivers hyperlocal forecasts
          straight from the U.S. National Weather Service point-forecast API.
        </Text>
        <Text style={[s.about, { color: colors.fgFaint, marginTop: 8 }]}>
          Weather data © NOAA / NWS (public domain). Radar © RainViewer. Maps © OpenStreetMap, ©
          CARTO. Not affiliated with NOAA or the NWS.
        </Text>
        <Text style={[s.about, { color: colors.fgFaint, marginTop: 8 }]}>
          An Atsumi Labs app · atsumilabs.com
        </Text>
      </View>

      <Modal visible={readerOpen} animationType="slide" transparent onRequestClose={() => setReaderOpen(false)}>
        <View style={s.scrim}>
          <View style={s.panel}>
            <View style={s.panelHead}>
              <View>
                <Text style={s.panelTitle}>Area Forecast Discussion</Text>
                {discussion.data && (
                  <Text style={s.rowSub}>
                    {discussion.data.wfo} · issued {relativeTime(discussion.data.issuanceTime)}
                  </Text>
                )}
              </View>
              <Pressable style={s.close} onPress={() => setReaderOpen(false)}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
                  <Path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
              {discussion.isLoading && <Text style={s.rowSub}>Loading discussion…</Text>}
              {discussion.error ? <Text style={s.rowSub}>Couldn't load the discussion.</Text> : null}
              {discussion.data && <Text style={s.mono}>{discussion.data.text}</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.settingRow}>
      <Text style={s.settingLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  previewClip: { borderRadius: 26, overflow: "hidden" },
  page: { paddingHorizontal: 18, paddingBottom: 120, paddingTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.fg, marginBottom: 4 },
  row: { ...card, flexDirection: "row", alignItems: "center", gap: 14, padding: 15 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
  },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.fg },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.fgFaint, marginTop: 2 },
  settings: { ...card, paddingHorizontal: 16, paddingVertical: 4 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  settingLabel: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.fg },
  divider: { height: 1, backgroundColor: colors.line },
  mutedEmpty: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.fgFaint, paddingVertical: 10 },
  mutedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  mutedName: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.fg, flexShrink: 1 },
  mutedUnmute: { fontFamily: fonts.bodyBold, fontSize: 14 },
  about: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.fg },
  scrim: { flex: 1, backgroundColor: "rgba(4,6,12,0.55)", justifyContent: "flex-end" },
  panel: {
    maxHeight: "88%",
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.glassBorder,
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  panelTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.fg },
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
  mono: { fontFamily: "monospace" as never, fontSize: 12.5, lineHeight: 19, color: colors.fgDim },
});
