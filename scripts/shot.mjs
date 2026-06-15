import { chromium } from "playwright-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.URL || "https://skyfield.atsumilabs.com/";
const W = Number(process.env.W || 1440);
const H = Number(process.env.H || 900);
const OUT = process.env.OUT || "/tmp/sky-shot.png";

const loc = {
  id: "chi",
  label: "Chicago, Illinois",
  lat: 41.8781,
  lon: -87.6298,
};
const persisted = JSON.stringify({
  state: { locations: [loc], activeId: "chi", gps: null },
  version: 0,
});

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

// First load to establish origin, seed a saved location, then reload.
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.evaluate((val) => localStorage.setItem("skyfield.locations", val), persisted);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(4000);

const diag = await page.evaluate(() => {
  const app = document.querySelector(".app");
  return {
    innerWidth: window.innerWidth,
    matchesWide: window.matchMedia("(min-width: 1024px)").matches,
    appClass: app?.className,
    appMaxWidth: app ? getComputedStyle(app).maxWidth : null,
    appWidth: app ? Math.round(app.getBoundingClientRect().width) : null,
    hasDashboard: !!document.querySelector(".dashboard"),
    swControlled: !!navigator.serviceWorker?.controller,
  };
});
console.log(JSON.stringify(diag, null, 2));

await page.screenshot({ path: OUT });
console.log("screenshot:", OUT);
await browser.close();
