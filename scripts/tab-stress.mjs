import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 },
  geolocation: { latitude: 40.015, longitude: -105.2705 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const tabs = ["Hourly", "Now", "7-Day", "Hourly", "Radar", "Hourly", "More", "Now"];
const marker = {
  Now: ".hero",
  Hourly: ".hourly-head",
  "7-Day": ".page-title",
  Radar: ".radar-screen",
  More: ".page-title",
};

let failures = 0;
// 3 rounds: slow, fast (mid-animation), very fast
for (const delay of [400, 120, 40]) {
  for (const t of tabs) {
    await page.click(`.tab[aria-label="${t}"]`);
    await page.waitForTimeout(delay);
  }
  // After the burst, land on each tab and confirm it actually rendered.
  for (const t of ["Now", "Hourly", "7-Day", "More"]) {
    await page.click(`.tab[aria-label="${t}"]`);
    await page.waitForTimeout(450);
    const ok = await page.$(marker[t]);
    const txt = await page.$eval(".screen-wrap", (e) => e.textContent?.trim().length ?? 0);
    if (!ok || txt < 10) {
      failures++;
      console.log(`BLANK after burst(${delay}ms): ${t} (content len ${txt})`);
      await page.screenshot({ path: `/tmp/blank-${delay}-${t}.png` });
    }
  }
}
console.log(failures === 0 ? "ALL TAB SWITCHES RENDERED" : `${failures} blank screens`);
console.log("PAGE ERRORS:", errors.length ? errors : "none");
await browser.close();
