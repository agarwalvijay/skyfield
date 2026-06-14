import type { ConditionCode } from "@/lib/weather/condition";

interface Props {
  code: ConditionCode;
  isDay: boolean;
  size?: number;
  /** primary accent color (sun/moon/bolt) */
  accent?: string;
  className?: string;
  animate?: boolean;
}

/**
 * Hand-built SVG weather glyphs with optional CSS micro-animation.
 * Line-and-fill style, tuned to read well at any size against the sky.
 */
export function WeatherGlyph({
  code,
  isDay,
  size = 64,
  accent = "#ffd166",
  className,
  animate = true,
}: Props) {
  const cloud = "#eef3fb";
  const cloudDim = "#cdd8e8";
  const a = animate;

  const Sun = (
    <g className={a ? "glyph-spin" : undefined} style={{ transformOrigin: "32px 26px" }}>
      <circle cx="32" cy="26" r="11" fill={accent} />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x="31"
          y="6"
          width="2"
          height="6"
          rx="1"
          fill={accent}
          transform={`rotate(${i * 45} 32 26)`}
        />
      ))}
    </g>
  );

  const Moon = (
    <path
      d="M40 16 a14 14 0 1 0 6 18 a11 11 0 0 1 -6 -18 z"
      fill={accent}
      opacity="0.95"
    />
  );

  const CloudShape = (x = 0, y = 0, fill = cloud, scale = 1) => (
    <path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M20 44 q-9 0 -9 -9 q0 -8 8 -9 q1.5 -9 11 -9 q10 0 11 10 q8 0 8 8 q0 9 -9 9 z"
      fill={fill}
    />
  );

  let content: React.ReactNode;
  switch (code) {
    case "clear":
    case "hot":
      content = isDay ? Sun : Moon;
      break;
    case "cold":
      content = isDay ? Sun : Moon;
      break;
    case "partly":
      content = (
        <>
          <g transform="translate(8 -4) scale(0.8)">{isDay ? Sun : Moon}</g>
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
            <g stroke={cloudDim} strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
              <line className={a ? "fog-line" : undefined} x1="14" y1="50" x2="44" y2="50" />
              <line className={a ? "fog-line fog-line-2" : undefined} x1="18" y1="56" x2="50" y2="56" />
            </g>
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
          <g className={a ? "rain" : undefined}>
            {[18, 28, 38].map((x, i) => (
              <line
                key={x}
                x1={x}
                y1="46"
                x2={x - 3}
                y2={code === "showers" ? "58" : "54"}
                stroke="#8fd4f5"
                strokeWidth="2.6"
                strokeLinecap="round"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </g>
        </>
      );
      break;
    case "tstorm":
      content = (
        <>
          {CloudShape(2, -2, cloudDim, 1)}
          <path
            className={a ? "bolt" : undefined}
            d="M30 44 l8 0 l-5 7 l7 0 l-12 13 l3 -10 l-6 0 z"
            fill={accent}
          />
        </>
      );
      break;
    case "snow":
      content = (
        <>
          {CloudShape(2, -2, cloud, 1)}
          <g className={a ? "snow" : undefined} fill="#eaf4ff">
            {[18, 28, 38].map((x, i) => (
              <circle key={x} cx={x} cy="52" r="2.4" style={{ animationDelay: `${i * 0.25}s` }} />
            ))}
          </g>
        </>
      );
      break;
    case "sleet":
      content = (
        <>
          {CloudShape(2, -2, cloud, 1)}
          <g className={a ? "rain" : undefined}>
            <line x1="20" y1="46" x2="17" y2="54" stroke="#8fd4f5" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="38" y1="46" x2="35" y2="54" stroke="#8fd4f5" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="29" cy="54" r="2.2" fill="#eaf4ff" />
          </g>
        </>
      );
      break;
    case "wind":
      content = (
        <g
          className={a ? "wind" : undefined}
          stroke={cloud}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M10 24 h24 a5 5 0 1 0 -5 -5" />
          <path d="M10 34 h32 a5 5 0 1 1 -5 5" />
          <path d="M10 44 h18 a4 4 0 1 1 -4 4" />
        </g>
      );
      break;
    default:
      content = isDay ? Sun : Moon;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {content}
    </svg>
  );
}
