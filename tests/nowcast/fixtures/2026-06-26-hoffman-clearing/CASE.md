# 2026-06-26 ~9:19pm CDT — Hoffman Estates, IL — "continuing" miss (should be clearing)

**Symptom.** A broken W–E band of *light* rain lifted NE across the user's point
(near Hoffman Estates, between Elgin and Schaumburg). By the newest radar frame
the cell had moved off to the NE with **nothing behind it** to the SW — the point
was already in the clear. The app said **"Light rain now — continuing"** and
projected the next-2h chart wet. It should have said it was **ending/clearing**.

**Why the "now" looked wet.** RainViewer's newest past frame is ~10 min old. At
9:19 the newest frame was 21:10, when the cell was still on the point. So
`nowLevel` reads light rain (level 1) even though the user is currently clear —
inherent radar latency; the motion projection is supposed to cover the gap.

**Why "continuing" (the bug).** The future projection came out flat `[1,1,1]`
(level 1 at +10/+20/+30). On these faint/broken echoes the motion estimate is
unreliable, so the advection effectively held the current field steady instead
of carrying the cell off the point — and the future sample radius (~10 km) is
wide enough to pick up the Schaumburg cells regardless. Net: it couldn't see the
rain leaving.

## Ground truth (real `0_1` scheme-4 tiles, z7/32/47, px167 py125)

Level sampled at the point (tight r=1 neighborhood), per frame:

| time  | level |                              |
|-------|-------|------------------------------|
| 21:00 | 1     |                              |
| 21:10 | 1     | newest frame the app had @9:19 |
| 21:20 | 0     | **gone, +1 min later**       |
| 21:30 | 0     |                              |
| 21:40 | 0     |                              |
| 21:50 | 0     |                              |
| 22:00 | 0     |                              |
| 22:10 | 0     |                              |

So the correct nowcast at 9:19 is **"light rain ending / clearing"**, with the
future bars going dry — not "continuing."

## The fix (in `getRadarNowcast`)

Three changes, all confirmed against this fixture (the test asserts `future === [1,0,0]`):

1. **Motion-aligned future sampling (`trackMax`).** The old future sample maxed
   over a symmetric ~10 km disk around the upwind point, which kept catching the
   Elgin/Schaumburg cells lifting *north* (parallel, never reaching the point).
   Now we sample a region **oriented to the motion**: tight ±1px along-track
   (just timing slack — the three t-steps cover distance) and ±2px across-track
   (ignore parallel side-bands).
2. **Hardened `estimateMotion`.** Was a coarse (every-2px) block match with a
   `0.004` small-motion bias → it flattened the motion to `(3,0)`, pure east,
   advecting the western band *into* the point → "continuing". Now: **fine
   (every-pixel) sampling, mass-weighted, tiny `0.001` bias** → it recovers
   `(3,-1)` (the NE lift). Single 10-min step kept (light echoes decorrelate
   over a longer baseline, and dividing rounds the 1px north component away).

With motion `(3,-1)` + oriented tight sampling the projection drops to `[1,0,0]`
→ **"Light rain now — easing, clearing in ~20 min"**.

## Files
- `tiles/<rainviewer-id>.png` — the saved z7 tile per frame (20:10 → 22:10).
- `tiles.json` — `{z,x,y,px,py,point,frames}` the test replays.
- Test: `tests/nowcast/2026-06-26-hoffman-clearing.test.ts` (offline; mocks the
  frame list to ≤21:10 and `Date.now` to 9:19, serves these tiles to `fetch`).

Privacy: point is near Hoffman Estates, IL (same note as the tornado fixture).
