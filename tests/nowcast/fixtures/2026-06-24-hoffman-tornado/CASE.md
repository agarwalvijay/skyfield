# Incident: 2026-06-24 — Hoffman Estates, IL — tornado-warned storm read as "Light Rain"

## What happened
Around 6:28 PM CT a tornado-warned, torrential storm sat directly over the user's
location (Current Location, near Hoffman Estates, IL). The radar — including the
app's own radar display — showed the **intense (pink/white)** and **heavy
(red/orange)** core right on the location dot. Yet:

- Headline condition: **"Light Rain"** (`now-screen-light-rain.png`)
- Radar nowcast summary: **"Light rain now — building"**

Both are driven by the radar intensity sampled at the point. It was badly
under-reported.

## Screenshots
- `now-screen-light-rain.png` — the Now screen showing the wrong "Light Rain".
- `radar-6-20pm.png` … `radar-5-50pm.png` — the preceding radar frames; the dot
  (you) sits in pink/red/orange the whole time.

## Root cause
`mobile/src/lib/radar/intensity.ts#pixelLevel` only handled the ramp up to red.
RainViewer **scheme 4 puts the most extreme returns ABOVE red as
magenta/pink/white** (high red + high blue). Those colors:
- failed the red test (blue not low),
- failed orange/blue, and **fell through to `return 1` ("light")**; and
- pure-white cores were dropped by the desaturation gate as "no echo".

So the violent core over the point read as "light" (or nothing).

## Expected result (the regression this guards)
For the colors that were over the location, `pixelLevel` must read **heavy or
worse — never "light"**:
- pink / magenta / white core → **intense (4)**
- deep red → **intense (4)**
- orange → **heavy (3)**

Asserted in `tests/nowcast/intensity.test.ts`
(`describe("incident: 2026-06-24 …")`).

## Fix
Added an extreme-band check at the top of `pixelLevel` (white core; magenta/pink/
purple → 4), before the desaturation gate, plus a tight neighborhood-max sample
in `radar.ts` so a single dead pixel can't under-report.
