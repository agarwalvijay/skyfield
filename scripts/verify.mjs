import { chromium } from "playwright-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:5173/";

const tabs = [
  { id: "now", label: "Now" },
  { id: "hourly", label: "Hourly" },
  { id: "daily", label: "7-Day" },
  { id: "radar", label: "Radar" },
  { id: "more", label: "More" },
];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  geolocation: { latitude: 40.015, longitude: -105.2705 }, // Boulder, CO
  permissions: ["geolocation"],
  colorScheme: "dark",
});
const page = await context.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });

// Wait for the hero temperature to populate (real data fetch).
try {
  await page.waitForSelector(".hero-temp", { timeout: 20000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".hero-temp");
      return el && /\d/.test(el.textContent || "");
    },
    { timeout: 20000 },
  );
} catch {
  console.log("WARN: hero temp did not populate in time");
}
await page.waitForTimeout(1500);

for (const t of tabs) {
  await page.click(`.tab[aria-label="${t.label}"]`).catch(() => {});
  await page.waitForTimeout(t.id === "radar" ? 9000 : 1200);
  if (t.id === "radar") {
    const info = await page.evaluate(() => {
      const c = document.querySelector(".radar-map canvas");
      return {
        hasCanvas: !!c,
        w: c?.width,
        h: c?.height,
        timeLabel: document.querySelector(".radar-time-label")?.textContent,
      };
    });
    console.log("RADAR:", JSON.stringify(info));
  }
  await page.screenshot({ path: `/tmp/skyfield-${t.id}.png` });
  console.log(`shot: ${t.id}`);
}

// Sample the rendered temperature for sanity.
const temp = await page.evaluate(() => {
  document.querySelector('.tab[aria-label="Now"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return document.querySelector(".hero-temp")?.textContent?.trim();
});
console.log("HERO TEMP:", temp);
console.log("CONSOLE ERRORS:", errors.length ? errors : "none");

await browser.close();
