import { useMemo } from "react";
import type { ConditionCode } from "@/lib/weather/condition";
import type { SkyTheme } from "@/lib/weather/sky";

interface Props {
  theme: SkyTheme;
  code: ConditionCode;
  isDay: boolean;
}

/**
 * Full-bleed atmospheric backdrop: a vertical sky gradient with a soft sun/moon
 * glow, plus subtle condition-aware particles (stars, rain, snow). Sits behind
 * all content; purely decorative.
 */
export function SkyBackground({ theme, code, isDay }: Props) {
  const [c0, c1, c2] = theme.gradient;

  const stars = useMemo(
    () =>
      Array.from({ length: 46 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 55,
        r: Math.random() * 1.3 + 0.3,
        d: Math.random() * 4,
        o: Math.random() * 0.5 + 0.25,
      })),
    [],
  );

  const showStars = !isDay && (code === "clear" || code === "partly" || code === "cold");
  const isWet = code === "rain" || code === "showers" || code === "drizzle" || code === "tstorm";
  const isSnow = code === "snow" || code === "sleet";

  return (
    <div className="sky" aria-hidden="true">
      <div
        className="sky-gradient"
        style={{ background: `linear-gradient(180deg, ${c0} 0%, ${c1} 48%, ${c2} 100%)` }}
      />

      {/* Sun / moon glow */}
      <div
        className="sky-glow"
        style={{
          background: `radial-gradient(closest-side, ${theme.glow}, transparent)`,
          opacity: isDay ? 0.55 : 0.4,
          top: isDay ? "-12%" : "-6%",
          right: isDay ? "-14%" : "auto",
          left: isDay ? "auto" : "-12%",
        }}
      />

      {/* Stars */}
      {showStars && (
        <svg className="sky-stars" viewBox="0 0 100 100" preserveAspectRatio="none">
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#fff"
              opacity={s.o}
              style={{ animation: `twinkle ${2.5 + s.d}s ease-in-out ${s.d}s infinite` }}
            />
          ))}
        </svg>
      )}

      {/* Drifting cloud band for cloudy/overcast/fog */}
      {(code === "cloudy" || code === "overcast" || code === "fog") && (
        <div className="sky-clouds" />
      )}

      {/* Precipitation veil */}
      {isWet && <div className="sky-rain" />}
      {isSnow && <div className="sky-snow" />}

      <div className="sky-vignette" />
    </div>
  );
}
