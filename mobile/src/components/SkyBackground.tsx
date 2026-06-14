import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, RadialGradient as SvgRadial, Defs, Rect, Stop } from "react-native-svg";
import type { ConditionCode } from "@/lib/weather/condition";
import type { SkyTheme } from "@/lib/weather/sky";

interface Props {
  theme: SkyTheme;
  code: ConditionCode;
  isDay: boolean;
}

/** Full-bleed sky gradient + sun/moon glow + stars at night. */
export function SkyBackground({ theme, code, isDay }: Props) {
  const stars = useMemo(
    () =>
      Array.from({ length: 42 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 55,
        r: Math.random() * 1.2 + 0.3,
        o: Math.random() * 0.5 + 0.25,
      })),
    [],
  );

  const showStars = !isDay && (code === "clear" || code === "partly" || code === "cold");

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={theme.gradient}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <SvgRadial id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.glow} stopOpacity={isDay ? 0.5 : 0.35} />
            <Stop offset="1" stopColor={theme.glow} stopOpacity={0} />
          </SvgRadial>
        </Defs>
        <Rect
          x={isDay ? 40 : -25}
          y={-18}
          width={70}
          height={55}
          fill="url(#glow)"
        />
        {showStars &&
          stars.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
          ))}
      </Svg>
    </View>
  );
}
