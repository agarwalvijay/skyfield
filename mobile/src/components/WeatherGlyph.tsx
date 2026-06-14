import React from "react";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import type { ConditionCode } from "@/lib/weather/condition";

interface Props {
  code: ConditionCode;
  isDay: boolean;
  size?: number;
  accent?: string;
}

/** Hand-built SVG weather glyphs — RN port of the web set (static). */
export function WeatherGlyph({ code, isDay, size = 64, accent = "#ffd166" }: Props) {
  const cloud = "#eef3fb";
  const cloudDim = "#cdd8e8";

  const Sun = (
    <G>
      <Circle cx={32} cy={26} r={11} fill={accent} />
      {Array.from({ length: 8 }).map((_, i) => (
        <Rect
          key={i}
          x={31}
          y={6}
          width={2}
          height={6}
          rx={1}
          fill={accent}
          transform={`rotate(${i * 45} 32 26)`}
        />
      ))}
    </G>
  );

  const Moon = (
    <Path d="M40 16 a14 14 0 1 0 6 18 a11 11 0 0 1 -6 -18 z" fill={accent} opacity={0.95} />
  );

  const CloudShape = (x = 0, y = 0, fill = cloud, scale = 1) => (
    <Path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M20 44 q-9 0 -9 -9 q0 -8 8 -9 q1.5 -9 11 -9 q10 0 11 10 q8 0 8 8 q0 9 -9 9 z"
      fill={fill}
    />
  );

  let content: React.ReactNode;
  switch (code) {
    case "clear":
    case "hot":
    case "cold":
      content = isDay ? Sun : Moon;
      break;
    case "partly":
      content = (
        <>
          <G transform="translate(8 -4) scale(0.8)">{isDay ? Sun : Moon}</G>
          {CloudShape(6, 8, cloud, 0.95)}
        </>
      );
      break;
    case "cloudy":
      content = (
        <>
          {CloudShape(-2, -2, cloudDim, 0.75)}
          {CloudShape(4, 6, cloud, 1)}
        </>
      );
      break;
    case "overcast":
    case "fog":
      content = (
        <>
          {CloudShape(2, 2, cloud, 1)}
          {code === "fog" && (
            <G stroke={cloudDim} strokeWidth={2.4} strokeLinecap="round" opacity={0.85}>
              <Line x1={14} y1={50} x2={44} y2={50} />
              <Line x1={18} y1={56} x2={50} y2={56} />
            </G>
          )}
        </>
      );
      break;
    case "drizzle":
    case "rain":
    case "showers":
      content = (
        <>
          {CloudShape(2, -2, cloud, 1)}
          {[18, 28, 38].map((x) => (
            <Line
              key={x}
              x1={x}
              y1={46}
              x2={x - 3}
              y2={code === "showers" ? 58 : 54}
              stroke="#8fd4f5"
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          ))}
        </>
      );
      break;
    case "tstorm":
      content = (
        <>
          {CloudShape(2, -2, cloudDim, 1)}
          <Path d="M30 44 l8 0 l-5 7 l7 0 l-12 13 l3 -10 l-6 0 z" fill={accent} />
        </>
      );
      break;
    case "snow":
      content = (
        <>
          {CloudShape(2, -2, cloud, 1)}
          {[18, 28, 38].map((x) => (
            <Circle key={x} cx={x} cy={52} r={2.4} fill="#eaf4ff" />
          ))}
        </>
      );
      break;
    case "sleet":
      content = (
        <>
          {CloudShape(2, -2, cloud, 1)}
          <Line x1={20} y1={46} x2={17} y2={54} stroke="#8fd4f5" strokeWidth={2.6} strokeLinecap="round" />
          <Line x1={38} y1={46} x2={35} y2={54} stroke="#8fd4f5" strokeWidth={2.6} strokeLinecap="round" />
          <Circle cx={29} cy={54} r={2.2} fill="#eaf4ff" />
        </>
      );
      break;
    case "wind":
      content = (
        <G stroke={cloud} strokeWidth={3} strokeLinecap="round" fill="none">
          <Path d="M10 24 h24 a5 5 0 1 0 -5 -5" />
          <Path d="M10 34 h32 a5 5 0 1 1 -5 5" />
          <Path d="M10 44 h18 a4 4 0 1 1 -4 4" />
        </G>
      );
      break;
    default:
      content = isDay ? Sun : Moon;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {content}
    </Svg>
  );
}
