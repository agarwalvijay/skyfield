# Skyfield Mobile (Expo / React Native)

Native iOS + Android port of the Skyfield PWA — same NWS data layer
(`src/lib/` is copied verbatim from the web app), same Skyfield design, plus
the native-only features:

- **Android home-screen widgets** (small 2×2 and large 4×2 via
  `react-native-android-widget`): location, condition, temp, hi/lo, wind,
  humidity, updated time; refresh every 30 min.
- **Background severe-weather notifications**: `expo-background-task` polls
  NWS active alerts for the last active location (~15 min minimum interval,
  OS-scheduled) and fires local notifications for unseen alert ids. Toggle in
  More → Notifications.

## Stack

Expo SDK 56 · React Native 0.85 · TypeScript · TanStack Query · Zustand
(AsyncStorage persistence) · react-native-svg (glyphs + hourly graph) ·
@maplibre/maplibre-react-native v11 (radar) · expo-location ·
expo-notifications.

## Develop

```bash
cd mobile
npm install
npx expo prebuild --platform android   # generates android/ (config plugins)
npx expo run:android                   # dev build on emulator/device
npx expo run:ios                       # iOS simulator
```

JDK 17 required for Android builds (`brew install openjdk@17`), with
`JAVA_HOME=$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home`.

## Release APK (sideload)

```bash
cd android
JAVA_HOME=... ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

The release build uses the debug signing key by default (fine for sideload;
generate a real keystore before any Play Store upload).

## Notes

- `src/lib/` must stay in sync with the web app's `src/lib/` (they are copies;
  see the repo root). `src/hooks/useWeather.ts` and
  `src/components/WeatherContext.tsx` are also shared copies.
- Widgets read the last active location from AsyncStorage
  (`skyfield.widgetLocation`), written whenever the active location changes.
- iOS widgets (WidgetKit) are not in v1 — they need a native widget extension
  target, planned as a follow-up.
