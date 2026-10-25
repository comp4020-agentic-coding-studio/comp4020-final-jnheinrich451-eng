# Missile submarine

Surface missile stage implemented 2026-10-04; dive controls added 2026-10-05.
23 October: moving depth changes, submerged launches and five-minute endurance
are implemented locally. See HELICOPTER_AND_SUBMARINE_REFINEMENT.md for the staged plan.
25 October: four independent groups of six silos are implemented locally.
The submarine carries 24 vertical-launch missiles and can temporarily evade
surface swimmers underwater. Torpedoes and hostile sonar remain later work.

## Playing

Build or exchange a missile submarine at the dock workshop, then board it.
Current deployment, fleet and permanent-loss rules are in FACILITY_LIFECYCLE.md
and REMOTE_NAVAL_ORDERS.md; older prototype ownership caps no longer apply.

Use **W/S** to select engine throttle and **A/D** to steer. The submarine shares
the gunship's 2-by-4 collision hull, 300 health, 2.5-tile/s forward speed,
1.5-tile/s reverse speed and the shared speed-dependent rudder dynamics.
Its Ohio-inspired canvas hull shows a sail and two rows of twelve silo lids;
each strike releases six missiles from its own group. The compact helm shows
ready groups, each group's countdown, depth,
remaining dive endurance, Space / Surface and Ctrl / Dive buttons. Swimmers can damage and destroy it
while surfaced or transitioning.

- Mouse movement or a map tap selects a **6-by-8-tile** strike rectangle.
  **R / Rotate area** swaps it to 8-by-6. The whole rectangle must be inside
  the map and between **12 and 80 tiles** from the submarine.
- **LMB / Launch 6** commits six missiles at quarter-second intervals.
  These are a single strike, not the gunship's click/double-click turret modes.
  Four consecutive commands use silos **1–6, 7–12, 13–18 and 19–24**.
  Each group reloads independently. A fifth command can use the first ready
  group without waiting for the other three. Reload never waits for all 24 to fire.
  Yellow aiming means a group is ready; red means all four are reloading or
  the target is invalid. Remote strikes use the same saved groups.
- **1/2/3** selects HE, incendiary or gas. Changing ammunition cannot modify
  an accepted strike or bypass reload.
- The six launches span **1.25 seconds**, without stopping the hull.
  Sailing, diving and surfacing remain available during the sequence. Each
  tube fixes its world origin when it fires, while impact points stay committed. Reload takes **18 seconds after the final launch** (19.25
  seconds from that group's command). Other groups can fire during this sequence.
  Keep moving after launching to avoid swimmers.
- The submarine has no secondary gun in this stage. RMB/J do not fire a hidden
  gunship weapon. The manual and touch controls show its missile controls.
- **G** deploys/retracts the existing shore ramp; **E** boards/disembarks at a
  dock or clear deployed ramp. A ramp continues to anchor the hull.

Boarding opens a wider view, with further zoom out available for long-range
aiming. Pan and zoom remain ordinary camera controls. The six-sector HUD box
and dashed line indicate the intended area. Flight visuals share the existing
missile renderer, with per-missile world origins at the actual hatch positions.

In the Navy tray, **Selected vessel** chooses the owned ship used by Find my
ship, Find my shoreline dock and Replace destroyed ship. Replacement retains
the selected type and original delivery site, preserving the other vessel.

## Diving and dock defense

- **Ctrl / Dive** and **Space / Surface** are press commands; touch buttons
  expose both. Space does not launch submarine missiles. Gunship controls remain.
- Dive and surface transitions each take **two seconds** and remain vulnerable.
  Only a fully submerged submarine disappears from surface swimmers' target list.
  Pending strikes and pursuit paths are cancelled on loss of detection. Swimmers
  seek another surfaced vessel or stop searching until a visible target returns.
  They can reacquire as soon as surfacing starts.
- The battery supplies **300 seconds underwater**, then forces surfacing. It
  recharges at **two endurance seconds per second** while fully surfaced; diving
  needs at least **10 seconds** of charge. Surfacing can interrupt a dive.
- Missiles launch at all depths, including during transitions. Boarding,
  disembarking and ramps still require a fully surfaced hull. Retract the ramp
  before diving. Reload continues underwater. A brief cosmetic bubble/splash
  cue marks each submerged launch position; enemy tracking is unchanged. WASD sailing and the existing conservative water/hull collision
  remain active at every depth; this is not a layered underwater physics model.
- A berth grants **no damage immunity**. A surfaced empty ship can be destroyed.
  Build existing APCR or heavy-flame sentries on shore near the dock, keeping its
  boarding tile clear. They already target swimmers across water. No free sentry
  is created: the player chooses the defense. Two flank-mounted flame sentries
  defeated the three-swimmer encounter in the automated coastal fixture; this
  does not guarantee safety for every coastline or attack direction.
- Depth, transition time and battery persist in the existing ship record.
  Commands and completed transitions save before broadcast; battery checkpoints
  use the existing half-second movement interval. No viewers pauses depth time.
  A disconnected pilot's battery still drains if other viewers remain. Replacement
  starts surfaced with a full battery. Legacy ships default to surface state.
- A faded underwater hull, dashed depth outline and brief transition bubbles
  provide visual feedback to teammates; reduced effects disables the bubbles.

## Warheads and shared budgets

The pattern uses two columns and three rows, with deterministic offsets within
each sector. HE reuses the existing missile direct blast profile (two-tile
radius, 110 center damage and 15 edge damage). Cosmetic crater diameters are
4.05-4.95 tiles, smaller than the ground battery's carpet strike. Water impacts
use the existing splash treatment and do not place dry-land craters.

Incendiary impacts create six round heat patches clipped to the target box,
lasting 18 seconds from each impact. Gas creates the same compact patch layout
with **nine shared lethal contacts** and no expiry timer. It does not refill
as later missiles arrive. Impact flashes/craters for fire and gas remain
cosmetic; the existing hazard contact logic applies damage. Friendlies and
terrain remain unaffected.

Submarine strikes have a separate limit of **16 six-missile volleys in flight**
across the campaign (four groups for each of the maximum four ships). Batteries
and bombers retain their shared two-volley budget. Each incoming/active submarine hazard reserves
48 square tiles against the existing 512-total/256-per-type area limits and
field count limits. For example, a 216-tile ground fire strike plus a 48-tile
submarine fire strike exceeds the per-type limit and is rejected. Admission is
atomic: invalid targets, cooldown, capacity or ammunition spend no reload and
create no partial strike. The additional submarine budget is bounded at 96
missiles; this is not a claim of measured Fly capacity.

## Saving and compatibility

The existing ships table stores `kind: submarine`; missing kinds remain
gunships. Placement, exclusive seats, movement checkpoints, ramp state, hull
damage, destruction/recovery and replacement use the existing server rules.
Accepted firing saves all four silo reloads and the next-group cursor before acknowledgement.
Neither a forged firing mode nor the gunship cannon endpoint bypasses it.

Named campaigns persist accepted missiles, pending tube origins, hazards and
reload through combat checkpoints. Legacy drill combat remains transient. The
aggregate launch countdown is reconstructed from the saved group reloads;
it no longer locks movement. Old single-timer saves retain that cooldown on
group one and start groups two through four ready. A replacement hull starts fresh.
Accepted impacts survive loss of the vessel: pending tubes use their accepted
fallback origin if the source hull is destroyed. No new particle simulation.

Old endurance values upgrade proportionally once (30/30 becomes 300/300,
10/30 becomes 100/300, zero stays zero). The saved diveCapacity marker prevents
repeat scaling. Existing depth and transition progress are preserved.

## Validation

`spec/submarine.test.ts` covers two-type ownership, legacy gunships, fleet cap,
placement, full-area range and rotation, deterministic six-sector patterns,
launch origins, bracing, immutable strikes, forbidden gunship weapons, shared
volley/area limits, all three warheads, water impacts, gas capacity and friendly
hull immunity. The HTTP cases in `spec/ship.test.ts` cover deployment alongside
a gunship, duplicate requests, seat authorization, input validation, launch
bracing, post-launch movement, restart/reload and type-preserving replacement.

`tests/browser/submarine.spec.js` exercises deployment beside an owned gunship,
boarding, keyboard/touch warhead selection and rotation, six-missile launch,
bracing and movement, aged fire/gas fields, restart at sea, return to shore,
fleet selection and responsive layout at 1920x1080 and 390x844 with a second
viewer. Screenshots are in `docs/previews/submarine-*`. Gunship, ramp, original
navy deployment and ground missile field flows provide regression coverage.
These are bounded behavior checks, not final balance or proof of 256 MB capacity.

At this checkpoint, type checking and all 149 domain/HTTP tests passed. All
12 browser cases passed, and submarine hull, launch/flight and aged-field
screenshots were inspected at desktop and phone sizes.

Depth validation adds domain cases for battery exhaustion/recharge, transition
vulnerability, lost targeting and reacquisition, surface-only operations, and
shore sentry defense. The HTTP case verifies authorization, denied underwater
requests, saved depth, idle pause and battery drain with an offline pilot.
Desktop/phone browser cases cover keyboard/touch diving, a second viewer losing
target detection, submerged restart, surfacing without missile fire, and the
existing missile/fleet flow. See spec/submarine-depth.test.ts and the extended
spec/ship.test.ts and tests/browser/submarine.spec.js.

Dive-stage verification: type checking and all 154 domain/HTTP tests passed.
Six browser cases passed across submarine, gunship armament and shore ramps.
Desktop and phone submerged-state screenshots were inspected. These are local
checks, not deployment or sustained-load validation.

## 23 October operation checks

28 focused submarine, depth and ship domain/HTTP tests pass, covering endurance
migration, exhaustion/recharge, moving launches, committed targets, per-tube
origins, checkpoint recovery, swimmer escape and shared cooldowns. Desktop and
phone direct Playwright checks pass actual boarding, throttle, keyboard/touch
depth changes, underwater fire and responsive resize. Screenshots were inspected.
Local disposable worlds only; no live campaign reset or Fly deployment.

## Ohio-class art and silo animation, 24 October 2026

The author asked for an Ohio-class appearance from overhead photographs, with all
24 silos and animated lids. `public/submarine-art.js` now draws both hull sizes:
- a long black hull with a hemispherical bow, parallel body and long tapered stern;
- the sail and fairwater planes forward;
- a raised missile deck (turtleback);
- stern planes, rudder top and propulsor.

Large 2.5 x 12 hulls show 24 silos; legacy 2 x 4 hulls keep their 16 (24 do not
fit their tube spacing). Silo positions use `submarineTubeLocal`, so the six firing
tubes are exactly the missile launch origins. Weapons, salvo size, range, timing
and saves are unchanged.

Silo animation is presentation only. It derives from the saved `reload` countdown
(salvo age = 18 + 1.25 - reload):
- At peace, each lid is closed and marked by a shallow ring.
- On firing, the six lids swing open about their outboard hinges, showing the dark
  top and then the pale underside.
- A white missile cap remains in each tube until its 0.25 s staggered launch; the
  tube is then empty, with a brief vapour ring.
- The lids close from about 2.2 s.
- Reduced effects show the lids open or closed without tweening or rings.

Local validation:
- Art study (`.local/check-sub-art.mjs`): closed, opening, mid-launch, all away,
  closing, legacy hull and under way.
- Submarine and naval-scale domain tests: 26/26.
- Browser at desktop and phone sizes: submarine-operations (moving, depth,
  underwater launch) and remote-branches pass.
- `submarine.spec.js` fails at both sizes before any submarine is placed: it
  expects the Deploy ship card enabled "AT SHIPYARD". That is a stale
  deployment-flow expectation; this stage changed only drawing files.
- Not committed, deployed or playtested by the author.

### Reload targeting colour - 24 October 2026
The manual missile aiming box, sector grid, label and guide line turn red when no group is ready; a valid target with a ready group is yellow. Remote submarine strike previews and land missile battery previews use the same red reload indication. The original colour change was verified with a browser submarine launch, typecheck and the two readiness checks.

### Four-group validation - 25 October 2026

Local checks cover independent timers, exact silo origins, moving and submerged
launches, capacity, old saves, restart, repeat remote commands and transaction
rollback for both manual and remote launches. Browser checks cover four successive
commands, the empty-magazine indication, reload restoration, firing again when a
group becomes ready, and desktop/phone layout. A rendered art review shows all
four groups opening their own six lids. Validation uses disposable worlds and
does not reset the player's campaign.

Dive and surfacing water (24 October): vent spray, bubble boil and foam ring
effects are browser-only and bounded. They are driven by the saved depth
countdown; see [Ship visual scale](SHIP_VISUAL_SCALE.md).
