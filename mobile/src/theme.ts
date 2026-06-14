/** Skyfield design tokens for React Native. */

export const colors = {
  fg: "#f3f6fc",
  fgDim: "rgba(243,246,252,0.66)",
  fgFaint: "rgba(243,246,252,0.42)",
  line: "rgba(255,255,255,0.12)",
  lineStrong: "rgba(255,255,255,0.2)",
  // No backdrop blur in RN — cards are slightly darker to compensate.
  glass: "rgba(12,18,32,0.38)",
  glassStrong: "rgba(12,18,32,0.55)",
  glassBorder: "rgba(255,255,255,0.14)",
  accent: "#ffd166",
  danger: "#ff5a5f",
  warn: "#ffb84d",
  sheetBg: "#0c1120",
  appBg: "#0a0e1a",
};

export const fonts = {
  display: "Fraunces_400Regular",
  displayLight: "Fraunces_300Light",
  body: "HankenGrotesk_500Medium",
  bodySemi: "HankenGrotesk_600SemiBold",
  bodyBold: "HankenGrotesk_700Bold",
  bodyExtra: "HankenGrotesk_800ExtraBold",
};

export const radius = {
  md: 22,
  sm: 14,
  lg: 30,
};

export const card = {
  backgroundColor: colors.glass,
  borderWidth: 1,
  borderColor: colors.glassBorder,
  borderRadius: radius.md,
} as const;
