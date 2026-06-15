/**
 * Rain start/stop notifications, driven by the same radar-first nowcast the
 * app shows in-card. Runs inside the periodic background task (see alertTask).
 * Fires at most one notification per onset/cessation transition, with a
 * cooldown, so it stays useful rather than spammy.
 */
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNowcast, type PrecipType } from "@/lib/nowcast/openmeteo";
import type { SavedLocation } from "@/store/locations";

const STATE_KEY = "skyfield.rainNotifyState";
const SETTINGS_KEY = "skyfield.settings";
const COOLDOWN_MS = 30 * 60 * 1000;
/** Only warn about precip arriving within this horizon. */
const INCOMING_HORIZON_MIN = 60;
/** Only announce cessation when it clears within this horizon. */
const ENDING_HORIZON_MIN = 90;

type Phase = "incoming" | "ending" | "none";
interface RainState {
  key: string;
  phase: Phase;
  notifiedAt: number;
}

async function rainNotificationsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    return JSON.parse(raw)?.state?.rainNotifications !== false;
  } catch {
    return true;
  }
}

function typeWord(t: PrecipType): string {
  switch (t) {
    case "snow":
      return "Snow";
    case "mix":
      return "Wintry mix";
    default:
      return "Rain";
  }
}

const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

/** Decide the current actionable phase from a nowcast. */
function phaseFor(nc: Awaited<ReturnType<typeof getNowcast>>): { phase: Phase; etaMin: number } {
  const future = nc.intervals.filter((iv) => iv.minutesFromNow > 2);

  if (!nc.precipitatingNow) {
    const firstWet = future.find((iv) => iv.wet);
    if (firstWet && firstWet.minutesFromNow <= INCOMING_HORIZON_MIN) {
      return { phase: "incoming", etaMin: firstWet.minutesFromNow };
    }
    return { phase: "none", etaMin: 0 };
  }

  // Raining now — is a dry stretch coming soon?
  const dry = future.find((iv) => !iv.wet);
  if (dry && dry.minutesFromNow <= ENDING_HORIZON_MIN) {
    return { phase: "ending", etaMin: dry.minutesFromNow };
  }
  return { phase: "none", etaMin: 0 };
}

export async function checkRainNotification(loc: SavedLocation): Promise<void> {
  if (!(await rainNotificationsEnabled())) return;

  let nc: Awaited<ReturnType<typeof getNowcast>>;
  try {
    nc = await getNowcast({ lat: loc.lat, lon: loc.lon });
  } catch {
    return;
  }

  const { phase, etaMin } = phaseFor(nc);
  const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
  const now = Date.now();

  let prev: RainState | null = null;
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    prev = raw ? (JSON.parse(raw) as RainState) : null;
  } catch {
    /* ignore */
  }
  const prevPhase: Phase = prev && prev.key === key ? prev.phase : "none";

  const shouldNotify =
    phase !== "none" && phase !== prevPhase && now - (prev?.notifiedAt ?? 0) > COOLDOWN_MS;

  if (shouldNotify) {
    const word = typeWord(nc.type);
    const title =
      phase === "incoming" ? `${word} reaching ${loc.label}` : `${word} easing at ${loc.label}`;
    const body =
      phase === "incoming"
        ? `${word} starting in ~${round5(etaMin)} min.`
        : `Clearing in ~${round5(etaMin)} min.`;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: undefined },
      trigger: null,
    });
  }

  await AsyncStorage.setItem(
    STATE_KEY,
    JSON.stringify({
      key,
      phase,
      notifiedAt: shouldNotify ? now : (prev?.notifiedAt ?? 0),
    } satisfies RainState),
  );
}
