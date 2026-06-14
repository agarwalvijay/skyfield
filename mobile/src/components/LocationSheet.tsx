import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { placeLabel, searchPlaces, type GeoResult } from "@/lib/geocode/geocode";
import { useLocationStore } from "@/store/locations";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { colors, fonts } from "@/theme";

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locations, activeId, gps, setActive, addLocation, removeLocation } = useLocationStore();
  const { locate, status } = useGeolocation(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  // The sheet lives in its own Modal window that doesn't resize for the
  // keyboard, so lift it above the keyboard (shared primitive).
  const kbHeight = useKeyboardHeight();
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(q, ctrl.signal));
      } catch {
        /* aborted */
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const choose = (id: string) => {
    setActive(id);
    onClose();
  };

  const addPlace = (r: GeoResult) => {
    addLocation({ label: placeLabel(r), sublabel: r.country, lat: r.lat, lon: r.lon });
    onClose();
  };

  const searchMode = query.trim().length >= 2;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.panel, { marginBottom: kbHeight }]}>
          <View style={s.handle} />
          <View style={s.head}>
            <Text style={s.title}>Locations</Text>
            <Pressable style={s.close} onPress={onClose}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
                <Path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          <View style={s.search}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={colors.fgFaint} strokeWidth={2}>
              <Circle cx={11} cy={11} r={7} />
              <Path d="M20 20l-3.2-3.2" strokeLinecap="round" />
            </Svg>
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search city, ZIP, or place"
              placeholderTextColor={colors.fgFaint}
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
          >
            {searchMode ? (
              <>
                {searching && <ActivityIndicator color={colors.fgDim} style={{ marginVertical: 18 }} />}
                {!searching && results.length === 0 && <Text style={s.hint}>No matches.</Text>}
                {results.map((r) => (
                  <Pressable key={r.id} style={s.result} onPress={() => addPlace(r)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName}>{r.name}</Text>
                      <Text style={s.resultSub}>
                        {[r.admin1, r.admin2, r.country].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2}>
                      <Path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </Svg>
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <Pressable
                  style={[s.item, gps && activeId === gps.id && s.itemActive]}
                  onPress={() => (gps ? choose(gps.id) : locate())}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
                    <Circle cx={12} cy={12} r={3} />
                    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                  </Svg>
                  <Text style={s.itemLabel}>
                    {gps ? gps.label : status === "locating" ? "Locating…" : "Use my location"}
                  </Text>
                  {gps && activeId === gps.id && <View style={s.activeDot} />}
                </Pressable>

                {locations.map((l) => (
                  <View key={l.id} style={s.itemRow}>
                    <Pressable
                      style={[s.item, { flex: 1 }, activeId === l.id && s.itemActive]}
                      onPress={() => choose(l.id)}
                    >
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.fg} strokeWidth={2}>
                        <Path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" strokeLinejoin="round" />
                        <Circle cx={12} cy={10} r={2.4} />
                      </Svg>
                      <Text style={s.itemLabel}>{l.label}</Text>
                      {activeId === l.id && <View style={s.activeDot} />}
                    </Pressable>
                    <Pressable style={s.remove} onPress={() => removeLocation(l.id)}>
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.fgFaint} strokeWidth={2}>
                        <Path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </Pressable>
                  </View>
                ))}

                {locations.length === 0 && !gps && (
                  <Text style={s.hint}>Search above to add your first location.</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(4,6,12,0.5)" },
  panel: {
    maxHeight: "86%",
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.glassBorder,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    alignSelf: "center",
    marginTop: 10,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.fg },
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
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.fg, paddingVertical: 10 },
  body: { padding: 18, paddingBottom: 42 },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.fgFaint, textAlign: "center", padding: 20 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  resultName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  resultSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.fgFaint, marginTop: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  itemActive: { backgroundColor: colors.glass, borderColor: colors.glassBorder },
  itemLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  remove: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
