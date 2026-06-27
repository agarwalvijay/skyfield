import React from "react";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import { glyphSvg } from "./glyphSvg";
import type { WidgetWeather } from "./widgetData";

// Solid background (NOT a gradient): react-native-android-widget can't express
// a gradient in RemoteViews, so it rasterizes gradient/rounded roots to a bitmap
// sized from the OS-reported widget dimensions — which are intermittently stale
// or report the min height on boot/periodic-update, producing the "half
// rendered" widget (a manual refresh re-reads the real size and fixes it). A
// flat backgroundColor is a native RemoteViews fill that always matches the
// laid-out size, so it can't clip. (borderRadius stays 0 — the launcher rounds.)
const BG = "#2a5db0" as const;
const FG = "#f3f6fc" as const;
const DIM = "#9ef3f6fc" as const; // AARRGGBB: 62%-alpha near-white
const ACCENT = "#ffd166" as const;
const BLUE = "#9fc8f0" as const;
const STAT = "#d6e4f5" as const; // humidity/wind line

/** Tap target that re-fetches data without opening the app. */
function RefreshButton({
  updated,
  updating,
  big,
}: {
  updated?: string;
  updating?: boolean;
  big?: boolean;
}) {
  return (
    <FlexWidget
      clickAction="REFRESH"
      style={{ flexDirection: "row", alignItems: "center", flexGap: 4, padding: 6 }}
    >
      {updated ? <TextWidget text={updated} style={{ fontSize: 10, color: DIM }} /> : null}
      <TextWidget
        text={updating ? "…" : "⟳"}
        style={{ fontSize: big ? 20 : 15, fontWeight: "700", color: updating ? ACCENT : DIM }}
      />
    </FlexWidget>
  );
}

function AlertStrip({ data }: { data: WidgetWeather }) {
  if (!data.alertEvent) return null;
  return (
    <FlexWidget
      style={{
        backgroundColor: data.alertColor,
        borderRadius: 7,
        paddingVertical: 2,
        paddingHorizontal: 7,
      }}
    >
      <TextWidget
        text={`⚠ ${data.alertEvent}`}
        maxLines={1}
        style={{ fontSize: 11, fontWeight: "700", color: "#ffffff" }}
      />
    </FlexWidget>
  );
}

/** 3×2 square widget (mirrors widget_skyfield_square.xml). */
export function SmallWidget({ data, updating }: { data: WidgetWeather | null; updating?: boolean }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: BG,
        borderRadius: 0,
        padding: 12,
        flexDirection: "column",
        justifyContent: "flex-start",
      }}
    >
      {/* place + refresh */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <TextWidget
          text={data?.place ?? "Skyfield"}
          maxLines={1}
          style={{ fontSize: 14, fontWeight: "700", color: FG }}
        />
        <RefreshButton updating={updating} big />
      </FlexWidget>
      {/* No React fragments anywhere in widget trees: the RemoteViews tree
         builder calls each element type as a function, and Fragment is a
         Symbol — it throws and blanks the whole widget. */}
      {data ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          {data.alertEvent ? <AlertStrip data={data} /> : null}
          {/* icon ........ temp (temp pushed to the right) */}
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <SvgWidget svg={glyphSvg(data.code, data.isDay)} style={{ height: 38, width: 38 }} />
            <TextWidget text={data.temp} style={{ fontSize: 40, fontWeight: "300", color: ACCENT }} />
          </FlexWidget>
          {/* condition on its own line */}
          <TextWidget
            text={data.nowcast ?? data.condition}
            maxLines={1}
            style={{
              fontSize: 13,
              fontWeight: data.nowcast ? "700" : "400",
              color: data.nowcast ? "#7fd4ff" : STAT,
              marginTop: 6,
            }}
          />
          {/* hi/lo */}
          <FlexWidget style={{ flexDirection: "row", flexGap: 10, marginTop: 6 }}>
            <TextWidget text={`H ${data.hi}`} style={{ fontSize: 14, fontWeight: "700", color: FG }} />
            <TextWidget text={`L ${data.lo}`} style={{ fontSize: 14, fontWeight: "700", color: BLUE }} />
          </FlexWidget>
          {/* humidity · wind */}
          <TextWidget
            text={`💧 ${data.humidity}    ${data.wind}`}
            maxLines={1}
            style={{ fontSize: 12, color: STAT, marginTop: 3 }}
          />
          <TextWidget text={data.updated} style={{ fontSize: 10, color: DIM, marginTop: 5 }} />
        </FlexWidget>
      ) : (
        <TextWidget text="Tap ⟳ to retry, or open the app" style={{ fontSize: 12, color: DIM, marginTop: 8 }} />
      )}
    </FlexWidget>
  );
}

/** 4×1 banner widget — one dense row. */
export function LargeWidget({ data, updating }: { data: WidgetWeather | null; updating?: boolean }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: BG,
        borderRadius: 0,
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {data ? (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
            <SvgWidget svg={glyphSvg(data.code, data.isDay)} style={{ height: 44, width: 44 }} />
            <TextWidget text={data.temp} style={{ fontSize: 34, fontWeight: "300", color: ACCENT }} />
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "column", flexGap: 2, marginLeft: 10 }}>
            <TextWidget
              text={data.place}
              maxLines={1}
              style={{ fontSize: 13, fontWeight: "700", color: FG }}
            />
            {data.alertEvent ? (
              <AlertStrip data={data} />
            ) : data.nowcast ? (
              <TextWidget text={data.nowcast} maxLines={1} style={{ fontSize: 12, fontWeight: "700", color: "#7fd4ff" }} />
            ) : (
              <TextWidget text={data.condition} maxLines={1} style={{ fontSize: 12, color: DIM }} />
            )}
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "column", flexGap: 2, alignItems: "flex-end" }}>
            <FlexWidget style={{ flexDirection: "row", flexGap: 6 }}>
              <TextWidget text={`H ${data.hi}`} style={{ fontSize: 13, fontWeight: "700", color: FG }} />
              <TextWidget text={`L ${data.lo}`} style={{ fontSize: 13, fontWeight: "700", color: BLUE }} />
            </FlexWidget>
            <TextWidget text={`${data.wind} · ${data.humidity}`} style={{ fontSize: 11, color: FG }} />
            <RefreshButton updated={data.updated} updating={updating} />
          </FlexWidget>
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TextWidget text="Skyfield — tap ⟳ to load" style={{ fontSize: 13, color: DIM }} />
          <RefreshButton />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
