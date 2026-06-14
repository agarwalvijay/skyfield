import { chromium } from "playwright-core";
const [lat, lon] = (process.argv[2] || "27.95,-82.46").split(",").map(Number);
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 },
  geolocation: { latitude: lat, longitude: lon },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/storm-now.png" });
await page.click('.tab[aria-label="Radar"]');
await page.waitForTimeout(9000);
await page.screenshot({ path: "/tmp/storm-radar.png" });
await browser.close();
console.log("done");
