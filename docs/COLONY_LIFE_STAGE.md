# Colony life: crates, working machines and moving decorations

4 November 2026. The author's brief, in their words: add animations such as the
shuttle taking off and coming back; let materials arrive as cardboard boxes
placed nearby that the player collects, with a machine designed to collect
them; make sprinklers, conveyors and machines look different when working
than when idle; and give decorations animation or visual effects, such as light
strings. This record holds the stage as built. It follows the ground stage
(`docs/COLONY_GROUND_STAGE.md`) and keeps its rule that the colony has no
ending: everything here is a reason to watch the garden, never a win state.

## What already moved, and what was missing

The renderer already lifted the shuttle for a shipment, swept the sprinkler
with a droplet arc while irrigating, turned the processor rotor, rose bubbles in
the generator, swung the outlet arm and ran belt treads while cargo travelled.
The author did not notice, which is the finding: motion that only changes a
small part reads as idle. The missing pieces were cues that change the whole
silhouette (steam, exhaust, blinking lamps, bright treads), any decoration that
moved at all, and the material loop the author described, where the reward is a
thing in the world rather than a number.

## Rules (server-authoritative, shared with the client)

Crates live in `public/colony-crates.js`; the collector is an industry kind in
`public/colony-industry.js`. Values are provisional until the author playtests.

| Rule | Value |
| --- | --- |
| Unloading | When a shipment completes, its reward lands as crates of 4 materials (the last crate takes the remainder). Materials rise only when a crate is collected |
| Landing tiles | Rings 2 to 6 tiles around the pad, nearest ring first, clockwise from the pad's south side; a tile must be firm, unbuilt, not the arrival tile and not already holding a crate |
| Never lost | Any reward that cannot land, because the area is full or 24 crates already wait, is credited to materials at once |
| Hand collection | `collect-crate` by any crew member whose worker stands within 1.6 tiles of the crate centre, in the home district; the toast reads "Collected 4 materials." |
| Crate collector | Industry kind, 2 x 2, 10 materials, two per expedition, no ports. Gathers the nearest unclaimed crate within 7 tiles of its centre, one every 2.5 s, spending 1 power per crate from the shared reserve. Status: Collecting, Waiting for crates, Needs power |
| Sharing | Two collectors never claim the same crate; a worker may take a claimed crate by hand, which ends the collector's task (its power stays spent) |
| Construction | Every construction kind refuses a tile holding a crate: "Collect the crate first." Crates never block walking |
| Saves | `crates` is an additive array with `placedAt` in simulation time; absent means none, so no migration or backup is needed. Remote district views carry no crates |

## Presentation (browser-only; reduced motion settles every effect)

- Shuttle: a dust ring expands under it while it lifts off and while it settles;
  each new crate drops in an arc from the pad to its tile during its first
  second; a crate a collector is taking slides to the machine on the second
  half of the task while the collector's crane arm turns, extends and retracts.
- Worker: the nearest crate within reach gets a gold ground ring and a Collect
  label; E collects it (keyboard) and a "Collect crate" button appears above the
  field for phones. The E key falls through to the bed and garden panel when no
  crate is near.
- Machines (`public/colony-industry-art.js`): a working processor vents steam
  puffs, a working generator shows exhaust wisps and a pulsing energy post,
  belt treads turn near-white with a travelling sheen while cargo moves, and the
  status lamp blinks at 2 Hz while any machine works. Idle machines keep their
  still art. The collector's base is a white body with a turntable and a folded
  gold crane arm.
- Furnishings (`public/colony-settlement-art.js`, `drawSettlementMotion`): the
  pennant cloth waves, the wind sculpture's leaves turn around the mast, hanging
  lights chase along the string (stronger at night), path and petal lamps pulse,
  and the pond ripples. The cloth and leaves moved out of the cached base so
  the sprite cache keys did not change; the placement ghost draws them at a
  fixed pose.
- Under reduced motion the shuttle, crates, arm, steam, blink, sheen and
  decorations hold a fixed pose; smooth movement is unaffected.

## Author correction the same day: the processor beside the outlet

The author placed a food processor directly east of a harvest outlet so the
processor IN port sat on the outlet, and was refused with "Leave the arrival
tile clear." Two rules were in the way, and neither served the player:

- The arrival tile. Machines refused the exact spawn tile although the runtime
  already seats an arriving or returning worker on the nearest open tile within
  eight tiles. The refusal is gone. The walking-route check, which starts its
  flood fill at the arrival tile, now starts at that same nearest open tile
  when construction covers it, so building over the spawn no longer reads as
  cutting the settlement off. Camp items and solid furnishings keep their
  1.5-tile arrival clearance for now.
- Direct hand-off. Cargo only ever moved along belts, so an outlet pointing
  straight into a processor filled up and showed Output full. Now, when no
  belt sits on a machine output cell, a machine standing on that cell whose
  own IN port lies on the source takes the item directly, if it accepts it and
  is not paused. A paused or full receiver leaves the cargo waiting in the
  source; nothing is discarded. Belts keep priority where they exist.

`spec/colony-industry.test.ts` covers both: a preview on the arrival tile is
accepted, and an outlet feeds a processor placed against it, including the
paused case. Vitest after the change: six colony files, 85 passed.

## Validation

Local checks on 4 November 2026 with disposable accounts, servers and data
directories; no author save was opened. This is not a deployment claim.

- `pnpm typecheck` passes (it covers the TypeScript specs and scripts, not the
  `public/` modules, which are exercised by the tests below).
- Vitest, seven colony files against a disposable server: 92 passed, 0 failed.
  `spec/colony-crates.test.ts` holds six rule tests: a reward lands as crates in
  a fixed order without crediting materials; a full landing area or the crate
  limit credits materials directly; collection needs reach and the home
  district and happens once; crates block every construction kind until
  collected; collectors need power, spend one unit per crate, take 2.5 s, share
  crates and yield to hand collection, and dismantle with a refund; remote
  views carry no crates and a mid-task JSON round trip continues identically.
  Five existing expectations that read materials straight after a shipment now
  read materials plus the waiting crates (two industry tests, one starter-kit
  test and two runtime restart tests).
- Playwright `tests/browser/colony-crates.spec.js`, pinned to the E-cores:
  2 passed (desktop and 390 px phone). A seeded garden shows the Collect prompt
  for the crate beside the worker; E (desktop) or the button (phone) collects
  it with the toast, and the powered collector gathers the far crate within
  15 s, spending one unit of power.
- Playwright `tests/browser/colony-life.spec.js`: a seeded garden with the
  shuttle lifting off, a working chain, an irrigating sprinkler, two crates and
  six animated furnishings; two frames 600 ms apart differ in full motion, and
  the reduced-motion run renders without console errors: 2 passed, pinned.
- The whole colony browser set (22 specs, 44 tests) pinned to the E-cores:
  42 passed and 2 failed on the first run, both specs reading materials straight
  after a shipment (the industry chain export and the Morrow cargo return).
  They now count the waiting crates; rerun together with the life spec:
  5 passed, no retries.

Evidence: [crates, desktop](testing/evidence/2026-11-04/colony-crates-desktop.png),
[crates, phone](testing/evidence/2026-11-04/colony-crates-phone.png),
[life, desktop](testing/evidence/2026-11-04/colony-life-desktop.png),
[life, reduced](testing/evidence/2026-11-04/colony-life-reduced.png).

Known limits: a static screenshot cannot show motion, so the working cues and
decoration effects were judged by eye from the live page and by the two-frame
difference check, not measured; steam and exhaust stop the moment a machine
stops rather than fading; the crate drop-in animation uses the saved placement
time, so crates seeded at time zero in a brand-new world drop in once on first
open; the collector's extended arm can reach beyond its cached sprite bounds,
which only matters if motion drawing is ever clipped to them (it is not).
