// Render a 1200x630 Open Graph / social preview image to public/og-image.png
// using headless Chrome (real text rendering), matching the app aesthetic.
import { chromium } from "playwright-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Hanken+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"/>
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1200px;height:630px}
  .card{width:1200px;height:630px;position:relative;overflow:hidden;
    background:linear-gradient(160deg,#1f6fd6 0%,#2a86e8 42%,#0e1a36 100%);
    font-family:'Hanken Grotesk',sans-serif;color:#f3f6fc;display:flex;
    flex-direction:column;justify-content:center;padding:0 92px}
  .glow{position:absolute;top:-160px;right:-120px;width:620px;height:620px;border-radius:50%;
    background:radial-gradient(closest-side,rgba(255,206,92,.55),transparent);filter:blur(8px)}
  .sun{position:absolute;top:70px;right:120px;width:150px;height:150px;border-radius:50%;
    background:radial-gradient(circle at 40% 35%,#ffe08a,#ffd166);box-shadow:0 0 70px rgba(255,209,102,.6)}
  h1{font-family:'Fraunces',serif;font-weight:400;font-size:150px;letter-spacing:-3px;line-height:.9}
  .deg{color:#ffd166}
  p{font-size:40px;font-weight:600;color:rgba(243,246,252,.92);margin-top:26px;max-width:840px;line-height:1.25}
  .foot{position:absolute;bottom:54px;left:92px;font-size:27px;font-weight:700;color:rgba(243,246,252,.7);letter-spacing:.5px}
  .pill{position:absolute;bottom:50px;right:92px;font-size:24px;font-weight:700;color:#0a0e1a;
    background:#ffd166;padding:12px 22px;border-radius:999px}
</style></head>
<body><div class="card">
  <div class="glow"></div><div class="sun"></div>
  <h1>Skyfield<span class="deg">°</span></h1>
  <p>Hyperlocal weather, radar &amp; alerts — straight from the U.S. National Weather Service.</p>
  <div class="foot">skyfield.atsumilabs.com</div>
  <div class="pill">An Atsumi Labs app</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(600); // let fonts settle
await page.screenshot({ path: new URL("../public/og-image.png", import.meta.url).pathname });
await browser.close();
console.log("og-image.png written");
