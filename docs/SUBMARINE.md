# Missile submarine

Surface missile stage implemented 2026-10-04; dive controls added 2026-10-05.
The submarine carries six vertical-launch missiles and can temporarily evade
surface swimmers underwater. Torpedoes, hostile sonar, aircraft and carriers
remain later work.

## Playing

Deploy your core, then choose **Navy / Missile submarine**. Select coastal water
for the orbital cradle, wait for arrival, approach the marked shore point and
press **E / Board ship**. Existing gunships remain available. Each scout may own
one gunship and one submarine; the shared world still permits four vessels.

Use **W/S** to sail forward/reverse and **A/D** to steer. The submarine shares
the gunship's 2-by-4 collision hull, 300 health, 2.5-tile/s forward speed,
1.5-tile/s reverse speed and 36-degree/s steering for this first balance pass.
Its separate canvas hull shows a sail, periscope and six deck hatches. The HUD
shows its depth and remaining dive battery. Swimmers can damage and destroy it
while surfaced or transitioning.

- Mouse movement or a map tap selects a **6-by-8-tile** strike rectangle.
  **R / Rotate area** swaps it to 8-by-6. The whole rectangle must be inside
  the map and between **12 and 80 tiles** from the submarine.
- **LMB / Launch 6** commits six missiles at quarter-second intervals.
  These are a single strike, not the gunship's click/double-click turret modes.
- **1/2/3** selects HE, incendiary or gas. Changing ammunition cannot modify
  an accepted strike or bypass reload.
- The hull braces for **1.25 seconds**, until the final missile launches.
  It can then sail while missiles climb, cruise and dive toward their committed
  impact points. Reload takes **18 seconds after the final launch** (19.25
  seconds from the command). Keep moving after launching to avoid swimmers.
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

- **Left Ctrl / Dive** and **Space / Surface** are press commands; touch buttons
  expose both. Space does not launch submarine missiles. Gunship controls remain.
- Dive and surface transitions each take **two seconds** and remain vulnerable.
  Only a fully submerged submarine disappears from surface swimmers' target list.
  Pending strikes and pursuit paths are cancelled on loss of detection. Swimmers
  seek another surfaced vessel or stop searching until a visible target returns.
  They can reacquire as soon as surfacing starts.
- The battery supplies **30 seconds underwater**, then forces surfacing. It
  recharges at **two battery seconds per second** while fully surfaced; diving
  needs at least **10 seconds** of charge. Surfacing can interrupt a dive.
- Missiles, boarding, disembarking and ramps require a fully surfaced hull.
  Finish the launch sequence and retract the ramp before diving. Reload continues
  underwater. WASD sailing and the existing conservative water/hull collision
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

Submarine strikes and ground batteries share the existing maximum of **two
missile volleys in flight**. Each incoming/active submarine hazard reserves
48 square tiles against the existing 512-total/256-per-type area limits and
field count limits. For example, a 216-tile ground fire strike plus a 48-tile
submarine fire strike exceeds the per-type limit and is rejected. Admission is
atomic: invalid targets, cooldown, capacity or ammunition spend no reload and
create no partial strike. No additional global combat budget is introduced.

## Saving and compatibility

The existing ships table stores `kind: submarine`; missing kinds remain
gunships. Placement, exclusive seats, movement checkpoints, ramp state, hull
damage, destruction/recovery and replacement use the existing server rules.
Accepted firing saves the complete shared missile reload before acknowledgement.
Neither a forged firing mode nor the gunship cannon endpoint bypasses it.

Missiles and hazards are transient across restart, as with ground batteries.
Reload persists. The brief launch brace is transient and clears on restart;
there is no hidden launch queue that resumes later. While running, accepted
strikes retain their origins, aim and warheads even if the operator leaves or
the vessel is destroyed. New empty worlds need no schema migration, and existing
worlds are not regenerated. No new bitmap assets or server particle simulation
are required.

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
