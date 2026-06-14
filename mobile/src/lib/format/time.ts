/**
 * Time formatting helpers honoring the 12/24h preference.
 * Pass `tz` (IANA zone from PointMeta.timeZone) to render times in the
 * forecast location's zone instead of the device's.
 */

export function hourLabel(iso: string, clock24h: boolean, tz?: string): string {
  const d = new Date(iso);
  const h = parseInt(
    d.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, timeZone: tz }),
    10,
  );
  if (clock24h) return `${h.toString().padStart(2, "0")}`;
  const ampm = h >= 12 ? "p" : "a";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

export function dayShort(iso: string, tz?: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", timeZone: tz });
}

export function fullTime(iso: string, clock24h: boolean): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: clock24h ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: !clock24h,
  });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function dayName(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short" });
}

export function isNowHour(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getHours() === now.getHours() && d.toDateString() === now.toDateString();
}
