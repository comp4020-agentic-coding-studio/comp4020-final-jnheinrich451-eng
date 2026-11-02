# HUD and polish stage

1 November 2026. The author reviewed a picture-only HUD mock-up over the real game
and approved this plan. It changes presentation and input only: no server rule,
price, save format or collision changes. Build in the listed order on the
`hud-polish` branch, review each step with the author, then deploy.

## Direction

The author wants a HUD that can be read in one second and that feels advanced and
expensive, in the spirit of Dead Space: information lives on the unit and the
world, not in corner panels. Players learn by playing, because punishment is nearly
zero. Descriptive text moves out of the way; instructive text stays.

**Colour.** One graphite and gold interface on every planet. Near-black panels, thin
lines and a single restrained gold accent replace blue panels and bright blue filled
buttons. Gold comes from the concept art: the robot's armour and the hull lettering.
Panels do not change per planet, because blue, gold and red already mean things in
play (ORB and actual aim, desired aim, hostile). Each planet's colour lives in its
terrain instead.

**Caldera.** Blue grass and blue trees, following the author's concept art of the
robot on the landing pad. Colours only: terrain data, collision and saves are
unchanged.

## Steps

1. **Mission bar and clutter.** A folded bar replaces the Operations panel. It shows
   only the current guidance, is optional, and has no reward or penalty. A finished
   step gets a gold check and folds. Hover expands it; touch taps. The top bar
   becomes one menu. Drill controls leave named campaigns (the legacy world keeps
   them). Test frenzy's button is hidden and its function stays for local testing.
2. **Remote.** The global picker stays. Cannons and the missile battery open near the
   gun, framed on the nearest enemy in range; M flips to the planet and back; one key
   jumps to the next target; the wheel zooms at the cursor and faster. Ships and jets
   keep the planet view.
3. **Deploy and control panels.** A small shelf with one tile per item, showing name
   and price. No ORB or GND choice before placing: left-click drops now with ORB and
   right-click builds with GND where a site supports it. Phones tap the site, then
   choose. Full specs move to the F1 reference. Control panels become one row with no
   title and no instruction sentence.
4. **HUD on the unit.** A health ring around your unit with spine lights on the robot
   as an art detail, a reload arc on the crosshair, and a key that projects gold
   chevrons toward the next target. Coordinates, supplies and hints appear only when
   needed. Danger warnings always stay visible.
5. **Caldera ground.** Blue terrain with broad colour variation, fine detail and less
   regular trees.

Steps 4 and 5 are optional if time runs short before the 9 November deadline.

## Remote command strip

After using step 3, the author found the ship, jet and helicopter panels ugly and
redundant, and proposed one rule for all of them: left click attacks, right click
moves, and everything else is one word with one key, like Combat, Remote and Deploy.

| Unit | LMB | RMB | Keys |
| --- | --- | --- | --- |
| Gunship, transport | Fire three salvos at the cursor | Move | R return, G ramp, 1 2 3 shells |
| Carrier | Move | Move | R return, G ramp, L launch |
| Submarine | Missile strike | Move | R return, T turn area, Ctrl dive, Space surface, 1 2 3 warheads |
| Helicopter | Fire support | Move | R return, G land, V lift or drop |
| Bomber | Strike run | None | R turn approach, 1 2 3 4 payload |
| Jet | Strafing pass | None | R turn approach |

Decisions taken with that proposal:

- The ramp is G, not the proposed S. WASD still walks the robot during Remote, and
  G is already the ramp key aboard a ship. It uses the shore under the cursor when
  that is in reach, otherwise the nearest shore within 14 tiles.
- Stop and the close button are gone. A new order replaces the old one, and the
  server's stop order still exists for saved and replayed orders.
- Map clicks give orders, so they cannot also close the panel. Panels stay open for
  the next order, and Esc, F or the Remote button leaves.
- A salvo now aims every turret at one point instead of one click per turret.
- Phones have no right button, so touch starts on Move and uses the strip's buttons
  as modes. Key hints are hidden there.
- Below 30% zoom, salvage, remains, ruin, parked-vehicle and per-site labels hide,
  because they overlapped into noise. Compounds, your unit and Remote markers stay.

## Checks

Local only, on isolated saves. No author playtest of the final build, no Fly run.

- `pnpm exec vitest run`: 146 files, 1142 tests passed. `pnpm typecheck` passed.
- Browser specs touching this stage ran on this branch and on a copy of `main`:
  83 tests pass on both, 15 fail on both, none are newly failing, and one helicopter
  test that fails on `main` passes here. Five new tests in `hud.spec.js` pass.
- After that comparison the helicopter panel stopped closing after an order. The
  remote, helicopter and multiplayer specs were rerun: 16 of 16 passed.
- Keyboard coverage: 1 to 3, L and R on ships, and RMB and R on helicopters.
  G, V and T have no automated test yet.
- Reviewed screenshots at 1920x1080 and 390x844 of combat, mission bar, menu, Deploy,
  placement, gun view, ship strip and bomber strip. Helicopter, submarine and carrier
  strips were not reviewed by eye.

That comparison covered only the specs this stage touched, so its count of 15 was too
low; see "Full browser suite" below. CI does not run browser tests, so they went
unseen. Because cannon-controls and rail fail on both, the near gun view rests on
`hud.spec.js`.

Not yet done: the ship helm and flight panels used while aboard keep their old layout.

## Rocket display bugs

The author reported two bugs at the launch station: the battlefield redrawn tilted
over stale frames after sending a rocket to orbit, and, filmed on video, two bars
blinking to the right of an idle station. Both had one cause.

A frame's clock is taken before that frame's messages run, so a snapshot can be
newer than `now` and its age slightly negative. Subtracting that age raised every
countdown a little:

- **Blinking bars.** An idle station's zero launch timer became a tiny positive one,
  so the rocket was drawn for one frame at the end of its path. The body had faded
  to nothing, but the stage band and stripe ignored the fade. Measured from 37 video
  frames, the bars' size, spacing, distance from the pad and 7 degree tilt all match
  those stripes.
- **Tilted map.** On the launch frame the timer passed 5 seconds, so flight progress
  went negative and `Math.pow` returned NaN. The gradient then threw after the canvas
  was already rotated, and the frame never restored it. Real Chrome reproduces this
  and is left tilted 48 degrees. The author's screenshots show about 45.

Earlier stress tests missed it because they never passed a timer above `launchTime`
or a negative age. Every reader of the age now goes through `snapshotAge`, floored at
zero, and the rocket's stripes follow its fade. `spec/uplink-flight.test.ts` failed
on all three cases before the fix.

The frame also now checks its transform and repairs it, showing the error once, so
any other failed effect costs one frame rather than the whole view.

## Map edge and recycler

The author found the map's boundary weird and asked whether the map could be a
sphere. A real sphere was declined: wrapping east to west only makes a cylinder, and
it would touch about 400 distance and 87 angle calculations, saved positions and shots
in flight. It would also change little, because the rim is water on every planet: the
nearest land is 5 tiles away on Caldera, 18 on Vesper and 22 on Sirocco. The author
approved fog instead, after seeing it on the real renderer.

- **Surface.** Terrain chunks now paint up to 80 tiles past the rim with each planet's
  own painter, so Sirocco's dunes and Vesper's ripples carry straight on. Past the
  chunks the background is the same colour. `tileAt`, `mountainAt` and `inlandWaterAt`
  already read off-map tiles as open water.
- **Weather.** One image, built once per page in about 17 ms, is stretched over the map
  and 72 tiles around it, with a solid fill beyond: night fog on Caldera, slate mist on
  Vesper and pale dust on Sirocco. Dark haze looked like burnt paper on sand, so
  Sirocco's is paler. It is drawn just after the terrain, so units and warnings stay on
  top. It reaches at most 8 tiles inside the rim, no land tile gets more than 20%, and
  it is skipped entirely when the view is inland.
- **Grid.** The tile grid hides below six pixels a tile, where it was only moire and
  outlined the rim. Above that it still stops at the rim, because you cannot build
  past it.

Nothing here changes collision or saves, so existing campaigns get it unchanged, and
ships stop where they always did. A new planet must keep an open rim, and a test says so.

The recycler box is gone, at the author's request. They pointed out that `YOU / 0`
already showed the load. The ring around the driver is now the cargo gauge, and the
label reads FULL at capacity. Reclaiming and blocked-route text were already on the
label. The how-to sentence moved to F1, and a hidden status line keeps the load for
screen readers. Only actions stay on screen:

- `Exit / E` replaces the longer exit labels.
- Beside a station, `L` presses the send button. It is a no-op while that button is
  disabled, so a double press cannot open the logistics overview.
- The bridge builder's plan button becomes `Bridge`, with G as its first keyboard key.
  It counts down while the bridge unfolds.

The phone's landing button sticks over the panel's rows. Gold is translucent, which
let them show through; that was a regression from this stage, and it now has a solid
base.

Checks for this work, local only and on isolated saves: `pnpm exec vitest run` passed
149 files and 1159 tests, and `pnpm typecheck` passed. Screenshots of the real build
were reviewed at 1920x1080 on all three planets, overview and corner, and the recycler
and landing panel at 390x844. With the CPU slowed 4x on Sirocco, frames averaged
64 to 65 ms with the weather on and 66 ms off in the overview, and 40 ms either way at
the corner, so its cost is too small to measure. No author playtest yet, no Fly run,
and no ship has been checked by eye at the rim.

## Deploy shelf fit

The author found that Ground and Air needed a scrollbar, Orbital needed much more
scrolling, and the mouse wheel did nothing to it. The shelf holds 700 px of tiles: six
needed 702 and Orbital's seven needed 820. A sideways row also ignores a plain wheel
turn unless the page handles it.

- Above 760 px wide, tiles narrow as needed, to about 95 px on Orbital, so every tab
  fits one row and the shelf stays 720 wide. Phones keep 112 px tiles and swipe.
- The wheel scrolls the row wherever it still overflows. A sideways trackpad gesture
  is left to the browser.
- Names sit at the top of each tile. Centred, a two-line name ran into its icon.
- Tiles now read 1, 2, 3 from the left. The keys always followed the catalogue, but
  Air showed them as 4, 5, 1, 2, 6, 3. No key changed.
- Tiles left over from the ORB and GND split lost their extra padding and blue icons.
- Ship tiles show the price alone. The `/ 60s` ran into the icon.

Checks, local only and on isolated saves: `pnpm exec vitest run` passed 150 files and
1163 tests, and `pnpm typecheck` passed. A new `hud.spec.js` test covers fit, name
clipping, key order, name alignment and the wheel at 600 px wide. Ground, Orbital, Air
and Naval were reviewed by eye at 1920x1080, with Orbital also at 600x800. Six Deploy
specs ran before the last two changes: 20 passed and 18 failed. Of those, 17 fail on
`main` as well, and the other was a Node crash at 0 ms that passes alone. No author
playtest and no Fly run.

## Full browser suite

The whole suite of 299 tests, without the colonization specs, ran for the first time
on 1 November, on a private copy of the branch: 202 passed and 97 failed. The failing
files then ran on a clean copy of `main`. Of the 97, 85 fail there too and 12 were new
to this branch:

- **Real, now fixed (4 tests).** The field guide reused the id `field-equipment`. The
  drill panel, always open in the legacy world, covered the map and the arrows on a
  phone and is now folded there, like campaigns. The workshop covered `Shipyard / E`
  on a phone by two pixels, and now sits above the stacked E buttons.
- **Out-of-date tests, updated to the approved behaviour (7).** Panels now stay open
  after an order, Lift replaces pick up and drop, T turns the strike area, and the
  building count and alert locator now sit in folded UI.
- **Load (1).** A helicopter test that passes alone.

A second full run gave 211 passed and 88 failed: the same 85, plus three. Two phone
tests needed to open the newly folded panel, and the third was a helicopter test lost
to a native Node crash on this machine (exit 3221225477). All three pass alone. So 214
pass and none are new compared with `main`, though those three were not repeated
inside a full run.

The 85, in 35 spec files, were diagnosed and repaired on 2 November. This record first
said the builder in `bridge-building` never crosses a finished bridge. That was wrong:
the test steered the builder into water.

- **Real bugs, now fixed (3).** One finished core or tank made `paintTerrain` repaint
  the whole map, freezing every client for about 1.5 s. That was the latency failure.
  Only changed tiles repaint now (`public/terrain-repaint.js`). Enter on a button
  focused with Tab opened chat instead of pressing it. And `close()` could wait
  forever on a browser's spare socket, measured at over 20 s and now about 1 s
  (`spec/server-shutdown.test.ts`). Saves run before that stall, so no progress was at
  risk; the shutdown log, world lock release and database close were what stuck.
- **World reads.** Returning `/api/world` as an object through `page.evaluate` made
  Playwright walk all 196,608 tiles, 390 ms a read, and crashed the worker on Node 24
  and 26. About 40 spec and helper files now read text and parse it in Node, at 18 ms.
- **Out-of-date or timing-sensitive tests (the rest).** They assumed older rules or
  fixed waits. An audit found no skipped tests or added sleeps, and each of the four
  files that lost assertions was reviewed. The raised navy limits match the 60 s local
  build. The latency assertion is unchanged.

Full runs on the pinned Node 24.21.0, without the colonization specs:

| Run | Passed first time | Result |
| --- | --- | --- |
| 4 | 294 | 6 failed, none game bugs |
| 5 | 297 | 3 failed: one shutdown stall, one fixed-time test, one Chrome load failure |
| 6, with one retry allowed | 297 | The other 3 passed on retry |
| 7, E-cores only, no retries | 300 of 301 | 1 failed: a slow world read, below |

Run 7's failure, `multiplayer-identity`, ran out its 40 s limit. It was the last spec
returning the whole world as an object; the sweep missed it because the spec builds
its URL. It now reads text, and passed 5 of 5 on the E-cores at about 20 s, against
about 30 s before on all cores. A scan of every `page.evaluate` that fetches JSON found
no other, and only `GET /api/world` sends the terrain. The whole suite was not repeated
for that one line. The 35 colony browser tests, left out of these runs, passed on the
E-cores with retries off.

`pnpm check` (1,210 tests) and `pnpm check:evidence` pass on Node 24, and the latest
CI run on `main` passed. CI does not run this suite.

Latency in run 6, on local loopback in headless Chrome: two players had a median of
121 ms and a worst case of 502 ms (13 samples); four had a median of 167 ms and a
worst case of 554 ms (39 samples). About 450 ms of that worst case is deliberate shell
flight. Run 5 agreed within 12 ms. Run 7, on the slower E-cores, gave medians of 177 ms
and 199 ms and worst cases of 519 ms and 517 ms. None of this is evidence about Fly.

### Crashes on the test machine

Run 6's three retries were two Chrome tab crashes and one Node worker crash. In
`anti-air` the owner's tab died silently at 18.9 s, and the room correctly froze as
`reconnecting`, which left the replacement timer at 7.86 s. `mortar` reported
`Page crashed`. Repeating `mortar` at 1440x1000 reproduced it often, including as
"tank never hit", because a dead owner tab freezes the mortar too. Five failures in 14
gave exactly five Chrome dumps.

The dumps rule out a fault in one place: access violations and a breakpoint at many
addresses in `chrome.dll`, always on the renderer's main thread, none of them
out-of-memory. Those are also the two exit codes of the Node worker crashes
(3221225477 and 2147483651), which saved logs show from at least 24 October.
Turning the GPU off changed nothing (2 failures in 12 with it, 2 in 12 without).

The machine is an i9-14900K, a part with Intel's documented Vmin shift instability,
on a September 2024 BIOS with microcode 0x12B. Alternating rounds of `mortar` by
processor affinity gave:

| Cores | Crashes |
| --- | --- |
| E-cores only | 0 of 14 |
| P-cores only | 6 of 14 |

So the crashes follow the P-cores. That fits the hardware fault but does not prove it:
E-cores are also slower, so a timing bug in Chrome could look the same. A web page
cannot corrupt browser memory by itself, so a game bug would have to be a Chrome bug
that the game triggers. Nothing here shows any of this on other machines.

Run 7 then put all 301 tests on the E-cores for 1.4 hours with retries off, and no tab
or Node worker crashed. Five of the six full runs before it lost tests to worker
crashes, across many different specs, so no single test explains them. One clean run
supports the P-core finding but does not settle it.

`ERR_NO_BUFFER_SPACE`, about 2 in 1,900 test runs, is still unexplained: Chrome failed
the second page's `/app.js` without reaching the server, leaving that page on
"Connecting" until it reloads. Ports and memory were ruled out. It did not appear in
run 7, which at that rate shows nothing.

### GPU reset

This is the fourth real bug the diagnosis found, and unlike the crashes it can reach
any player. Chrome's GPU process was crashed under a live page
(`Browser.crashGpuProcess`) to see what a player would get. The map, floors and minimap went blank and stayed blank, with
the game still running, because `paintedTiles` still said they were drawn. Smoke, fire,
hazard and map-edge sprites live in cached canvases too, so the page now reloads on
`contextrestored`, and `tests/browser/gpu-reset.spec.js` covers it. Firefox and Safari
may not fire that event, so they keep the old behaviour.

The Naval tab reruns the dock site search on every snapshot: median 1.2 to 7.6 ms by
planet and up to 32 ms on this machine. Phones will be slower. It is left as it is.

Run the whole suite before a deploy: comparing only the specs a stage touched missed
all 12 of the failures above.

## Recorded for later

After playing, the author wants the shipyard process simplified and the airbase
reviewed. The ship helm and flight panels used while aboard are still to do.
Codex is building the colonization mode in parallel in the same working tree.

The author wants the alert station's logic redesigned, together with Bulwarks taking
damage only from HE, which makes other shell types useless against them. This is a
later stage and is not part of this work. The armor-model conflict stays open.

Known issue, not new: a long full-size carrier route takes about 0.7 seconds of
server time on the author's desktop. It runs on the server's main thread and freezes
every room while it does. It is bounded by `NAVAL_ORDER.searchLimit`.
