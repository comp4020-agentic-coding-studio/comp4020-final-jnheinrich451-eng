# Helicopter and submarine refinement

Agreed 23 October 2026. Build playable stages in this order. This record separates
the current appearance pass from later gameplay work; no automatic whole-roadmap release.

## Combat purpose

The submarine becomes a concealed mobile missile platform. The helicopter moves
ground equipment across disconnected terrain while retaining close fire support.
Players trade underwater endurance or loaded flight speed for positioning freedom.
Successful transport preserves the exact vehicle and its cargo; destruction remains
permanent and must not duplicate a vehicle or its salvage.

## 1. Appearance first — implemented locally

- Heavy-lift helicopter inspired by the CH-53 family: broad cabin, split cockpit
  glazing, three engine housings, sponsons, wheels, tail rotor and seven main blades.
  Retain the existing bank/pitch response, cannon and rocket pods.
- Ohio SSGN-inspired submarine: longer, slimmer tapered casing, forward sail,
  planes, stern propulsor and two rows of eight missile hatches. Hatch count is
  decorative; only six positions show the existing salvo activity.
- Pure overhead canvas art. Fixed-size drawing work; no new physics entities,
  network fields, assets, particles or save migration. Reduced effects retain
  static rotor presentation and suppress launch flicker/transition bubbles.
- Collision footprints, berth placement, hitboxes, speed, weapons, six-missile
  salvo, costs and existing 30-second dive endurance remain unchanged. The
  submarine's tapered nose/tail have small cosmetic overhangs beyond its hull.

## 2. Submarine operation ? implemented locally

- Preserve W/S throttle, A/D rudder, Space surface and Ctrl dive. Throttle steps:
  Reverse, Stop, 1/4, 1/2, 3/4, Full. Display tiles/s across the fleet until a
  metres-per-tile scale is agreed; throttle fractions are not knots.
- Five minutes of active-play dive endurance, surfaced recharge and automatic
  surfacing when exhausted. Name it dive endurance, not real nuclear propulsion.
  Surface recharge is two seconds per second (150 seconds from empty to full).
  Existing 30-second saves upgrade proportionally once; exhausted boats stay empty.
- Allow submerged missile launch, with bubbles, splash and airborne exhaust.
  A brief cosmetic surface disturbance reveals each launch position; enemy
  tracking rules remain unchanged, with no new sonar or automatic targeting.
  Keep automatic defensive guns absent. Tune missile count separately from art.
- Diving, surfacing and firing preserve throttle and steering. Visible compact
  helm buttons show Space / Surface and Ctrl / Dive without opening Systems.
- Each tube fixes its launch origin when it fires; all impact targets and warheads
  stay committed at acceptance. Launched trails do not follow the moving ship.
- Save depth, endurance, accepted launch and cooldown state; reconnecting must
  not refill endurance, duplicate missiles or lose an accepted strike.

Stage 2 validation: 28 focused submarine/depth/ship tests and 25 shared missile,
checkpoint, ship-motion and catalogue regressions pass. Desktop and phone browser
checks passed boarding, moving depth changes, underwater fire, visible shortcuts
and resize; screenshots inspected. TypeScript and diff checks pass. Local only.

## 3. Helicopter field landing ? implemented locally

- Explicit land/takeoff command on clear land; a failed attempt briefly flashes
  its landing area red, while ordinary flight keeps the grid hidden;
  stopping to aim must not trigger an unintended landing. Reject water, occupied
  footprints and obstacles on the server as well as in the preview.
- Helipads remain deployment, repair and rearming centres. Field landings do not
  refill ammunition or health. E retains boarding/disembarking.
- Separate a helicopter's survival and field parking from its original helipad;
  losing the pad must not destroy a surviving helicopter. Retain fleet accounting.

Field landing controls: release WASD to hover, then press E / Land. The nine-tile
area flashes red for about one second only when landing fails. Reduced effects
uses a steady brief red outline instead of pulsing. Touchdown takes two seconds and checks the site
again. E disembarks beside the aircraft; E boards it there without taking off.
Use Take off to lift from that position. Manual hover no longer auto-lands;
automatic recalled flights still land at their reserved helipad.

The saved fieldLanding position reserves space during descent, parking and
liftoff, excluding other helicopters, ground vehicles and construction. Field
parking releases the runway but still counts toward the living helicopter fleet.
It never repairs or rearms. Losing the home helipad preserves the aircraft;
parked helicopters at the former pad become field parked. Delivery crates still
share facility loss. An unattended return with no usable pad searches a bounded
nearby area for an emergency landing; if no clear site exists it holds position
and retries, without inventing a wreck. Existing airborne damage still applies.

Stage 3 validation: 108 focused simulation, HTTP/persistence and shared gameplay
checks pass, alongside TypeScript and diff checks. Desktop 1920x1080 and phone
390x844 browser checks passed explicit landing, local exit, refresh, reboarding,
field takeoff, keyboard movement and resize; screenshots inspected. Tests used
disposable worlds. No commit, push or deployment in this stage.

Field landing, manual sling transport and Remote transport are implemented locally.

## 4. Sling transport - implemented locally

- One unoccupied tank, recycler or bridge builder at a time. Our game vehicles
  are a fictional lifting allowance, not a claim about real CH-53 tank capacity.
- Hover, attach sling, lift, travel, lower and release. Show cables and restrained
  cargo sway; reduced effects suppress sway. Loaded acceleration/speed decrease.
- Preserve vehicle identity, health, ammunition and collected cargo. Disable
  carried-vehicle weapons, guarding, collection and independent driving.
- Set down only on a clear server-validated land footprint; failed placement
  keeps cargo attached. Resolve simultaneous crew pickup requests atomically.
- Persist carrier/cargo linkage. Test destruction over land/water, recoverable
  salvage, disconnect and restart without duplication. The loss policy is below.

Controls: stop over a parked, unoccupied vehicle within 1.8 tiles and press
V / Lift. The nearest ground vehicle is selected and checked. Press V / Set down
while hovering over clear land to lower it. Both transfers take two seconds;
movement and weapons pause during the transfer. A visible button supports touch.
Loaded maximum speed is 2.5 tiles/s (normally 4) with acceleration 2 (normally 4).
Set down the load before landing. No new cost or ammunition refill is introduced.

The exact cargo record is saved inside the helicopter and removed from ground
vehicle lists in the same transaction. It remains included in fleet accounting.
Vehicle identity, hull, weapons, paid purchase receipt and recycler contents are
retained; ground guard/collection/drive orders are suspended. A lowering site is
reserved against other drops, movement and construction, then checked again at
completion. Late blockage keeps the cargo attached. Saved command receipts and
revisions make retries harmless across restart and reject stale orders.

Unattended recovery lowers cargo at a clear nearby site before landing. Over
open water it continues toward an intact helipad until a safe site is available.
If no pad or nearby clear land exists, it holds and retries. Intentional remote
fire-support orders are rejected while carrying cargo; remote transport is later.

If shot down, the load is permanently destroyed. Tanks retain a wreck record
at the crash and their original paid replacement site. Utility vehicles leave
a ruin; their stored salvage becomes one recoverable crate on land and is lost
at sea. No intact vehicle or supplies reappear at the original pickup location.
Cargo loss, aircraft loss and pilot loss share the existing checkpoint.

Stage 4 validation: 94 focused simulation, HTTP/restart, fleet, transport,
input narration and observability checks pass. Coverage includes all three
cargo types, exclusive pickup, ownership rejection, replayed commands, restart
while lifting/lowering, late obstruction, cargo loss and loaded recovery from
water. TypeScript, JavaScript syntax and diff checks pass. Four desktop/phone
browser flows passed red failure flashes, pickup, loaded speed, reload, set-down,
field boarding/landing and resize; screenshots inspected. Disposable saves only.
The direct browser runner avoids the previously observed Windows worker issue.
Local implementation only; no commit, push or Fly release in this stage.

## 5. Remote transport — implemented locally

- Move, Land, Pick up vehicle, Set down vehicle and Return to helipad.
- Use the existing robot-controlled Remote workflow with visible order status,
  cancellation and safe handoff when a player boards. Revalidate pickup/drop
  sites on arrival. Orders survive reconnect without replaying completed actions.
- Select an unoccupied helicopter with F / Remote. Move flies to the clicked
  point and hovers; Land uses a clear 3 x 3 field footprint. Pick up selects a
  ground tank, recycler or builder, then flies to it and attaches the sling.
  Set down flies to the clicked land point and lowers the existing load.
- Return reserves the nearest completed free helipad and lands for service.
  Set down cargo first. Losing or blocking the pad makes the helicopter hover
  with an explanation; Stop also holds position. Transfer and touchdown phases
  finish before a new command can replace them. Existing fire support remains.
- Routes use the bounded known-flak planner. Dangerous destinations remain
  dangerous; the transport gains no damage immunity. Moved, occupied or stolen
  pickup targets are rejected on arrival. Blocked drops retain the load.
- Accepted commands have saved revisions and receipts. Pickup removal and sling
  ownership share a checkpoint. Lowering restores one ground record. Reconnect
  resumes progress; stale commands and reused IDs with different payloads reject.

## 6. Submarine Remote — implemented locally

- Submarines now appear as gold Remote markers. Move and Return to dock reuse
  full-hull naval routing; arrival holds position. Returning surfaces for docking.
- Ctrl / Dive and Space / Surface work in the selected submarine's Remote panel.
  Missile strike uses the existing six-missile area and ammunition choices; R
  rotates the area, then a map click commits it. Depth changes and firing preserve
  an accepted navigation order. There is no automatic defensive battery.
- Respect the existing range, ammunition effect capacity, tube reload and dive
  endurance. Independent saved control revisions prevent concurrent depth/strike
  commands from silently overwriting one another. Replayed strikes do not fire
  again; named campaigns checkpoint the salvo and receipt together.

Verification uses disposable worlds: simulation and HTTP tests cover transport,
arrival revalidation, blocked drops, field boarding, runway reservation, shared
pickup, restarts and command replay. A named-campaign test verifies underwater
missile persistence and launch attribution. Desktop and phone browser flows cover
Remote selection, robot movement, pickup/drop, depth keys and rotated missile
targeting. Screenshots inspected. Local only; no commit or deployment in this stage.

Next: [vehicle polish and world variety](VEHICLE_POLISH_ROADMAP.md), starting with
tank appearance and movement dust.

## Helicopter cockpit UI refinement

The bottom action stripe shares Land / E (or Disembark / E) with a solid gold
Lift vehicle / V button on the right. Carrying cargo changes it to Set down / V;
active transfer shows its countdown. The existing keyboard and server rules apply.

A compact floating dashboard at the lower right shows ground speed in tiles/s, heading, nose pitch
and left/right bank in degrees, with an artificial horizon. Attitude uses the
same cosmetic velocity-based tilt as the helicopter model, not a new flight
simulation. Hover, loaded speed limit and transfer state remain visible without
changing the panel width as values update. On narrow screens it sits above the
bottom controls; in landscape it sits beside them, keeping both actions available.

Local UI verification: four desktop/phone browser flows passed, covering aligned
action buttons, live speed/bank readouts, hover, pickup, set-down, reload, field
landing/reboarding and viewport resize. Desktop and phone screenshots inspected;
TypeScript and syntax checks pass. Local only, no deployment in this UI stage.

## Verification and references

For appearance: inspect parked/moving helicopter, surfaced/diving/submerged and
launching submarine at normal and survey zoom, desktop 1920x1080 and phone
390x844, reduced effects, keyboard flight and resize. No Fly capacity claim.
Later gameplay stages require authority, collision, loss and persistence tests.

Local verification, 23 October: TypeScript and diff whitespace checks pass;
16 focused submarine, depth and helicopter-motion tests pass. Inspected the
appearance gallery at desktop/phone sizes, including reduced effects and survey
zoom. A direct Playwright browser check passed keyboard takeoff, acceleration to
4 tiles/s, braking to hover and 1920x1080 to 390x844 resize, with no page errors;
both gameplay screenshots were inspected. The standard Playwright worker crashed
intermittently with Windows exit 3221225477; one run also timed out on takeoff.
The successful direct check used a disposable world and no test worker. These
are local visual/handling checks, not a full multiplayer or deployed-site test.

- [US Navy Ohio SSGN](https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/Article/2169613/guided-missile-submarines-ssgn/)
- [NAVAIR submerged Tomahawk launch](https://www.navair.navy.mil/node/4336)
- [NAVAIR CH-53K](https://www.navair.navy.mil/product/CH-53K-King-Stallion)
