# Vehicle handling

## Hull-relative ground controls - 24 October 2026

Current manual controls for tanks, recyclers and bridge builders:
W/up drives forward along the saved hull heading; S/down brakes then reverses.
A/left and D/right turn the nose left/right, including assisted pivoting at rest.
Steering alone does not translate a stopped vehicle. Release the controls to brake.
Forward and reverse limits, acceleration, speed-dependent turn rate, collision,
construction locks and safety stops retain their existing values. The tank turret
still follows mouse aim independently; foot movement remains world-relative.

Remote/path commands still supply world-space route directions through an explicit
path-driving adapter. This preserves recycler routes, narrow bridge approaches,
collection and delivery. No save conversion is needed: vehicles already save their
hull heading. HUD/key help and action logs describe forward/reverse and steering.
A gold chevron marks the controlled vehicle nose. Mobile tank chat buttons sit
above the steering pad; touch button labels describe the current vehicle controls.

Validation: 96 focused movement, action-log, tank, logistics and bridge tests passed,
including peer movement snapshots, collision, braking, input expiry, saved heading,
remote recycler routes and construction locks. All three vehicles passed desktop
keyboard and phone touch checks for pivoting, forward/reverse, braking and reload.

This supersedes the older world-direction and automatic-reverse descriptions below.


## Utility vehicles - 23 October 2026

Originally recycler and bridge-builder WASD chose a world direction (superseded
by the 24 October controls above). Both use
the tank's bounded ground movement integrator with separate tuning. Turning
slows at speed; low-speed assisted turning keeps small bridge approaches usable.
Releasing input brakes naturally; an opposite direction brakes through zero
before reversing. Their appearances, collision radii, prices and cargo stay the same.

| Vehicle | Forward / reverse (tiles/s) | Acceleration / braking (tiles/s squared) |
| --- | --- | --- |
| Recycler | 3.5 / 1.7 | 3.6 / 7 |
| Bridge builder | 3.5 / 1.4 | 2.5 / 6 |

The builder turns more slowly. Remote recycler routes retain a 2.5 tiles/s cap,
skip straight intermediate nodes, brake at corners and align before proceeding.
They use the same hull collision checks as manual driving. An obstructed route
stops with its existing blocked notice. Cargo work starts after arrival; manual
collection waits until the vehicle is stationary for half a second.

Missing/expired input and disconnect stop occupied vehicles immediately. Boarding,
exit, pause and construction locks clear momentum; startup clears saved motion
fields, including old records without them. Remote paths and tasks can resume
from rest. Ship and helicopter cargo transfers clear velocity as well.

Client-only dust is stronger on sand than grass, absent on flooring and water,
and disabled with reduced effects. At most ten analytic puffs are drawn per
vehicle, without persistent particles or network events.

Validation: 99 focused tests passed across utility/tank movement, logistics,
bridges, ship transport and helicopter sling behavior. This includes remote
collection/delivery through a server restart and a one-tile right-angle corridor.
Desktop (1920 x 1080) and phone (390 x 844) browser checks passed for driving,
parking, salvage/unloading, rocket shipment, bridge construction and crossing.
Typecheck and JavaScript syntax checks passed; screenshots were inspected.

The 23 October [air-power refinement](AIR_POWER_REFINEMENT.md) supersedes finite
fixed-wing ammunition, refill waits, the old bomb pattern and the U systems HUD.
Helicopter ammunition is unchanged. Earlier stage evidence below is historical.

Agreed 19 October 2026. One reference for the vehicle-handling polish sequence:
ships first, aircraft second, then tank tuning. Ship and fixed-wing handling are
implemented locally; the tank tuning follow-up is recorded below.

## Purpose and boundaries

Give vehicles readable weight, braking distance and turning commitments while
keeping combat and narrow docking approaches usable. Use the existing 2D world,
server-owned movement, collision footprints and bounded simulation substeps.
No rigid-body engine, terrain height, collision damage, fuel economy or new
weapon balancing is introduced. Position and heading persist. Ship propulsion and steering clear on restart or
loss of control. Aircraft retain forward flight/recovery state and clear manual bank.

The HUD uses tiles/second. Reverse, Stop, quarter, half, three-quarter and Full
are engine orders, not knots. A physical tile scale has not been established.

## Ship stage

- Tap W/Up to raise the engine order; S/Down lowers it through
  `Reverse / Stop / 1/4 / 1/2 / 3/4 / Full`. Holding the key does not repeat steps.
  Releasing W/S retains the order while the connected player controls the helm.
- Hold A/D or Left/Right to steer. The rudder takes time to move and centre.
  The six visible engine buttons also support mouse/touch; touch-pad Up/Down
  selects one step per press. Other vehicle controls remain unchanged.
- Show the selected order and actual speed separately. Stop reduces speed
  gradually; reverse brakes through zero before accelerating astern.
- Faster travel produces wider turning circles. A small assisted pivot at low
  speed keeps existing harbours navigable; this is an intentional game concession.
- Carriers accelerate, brake and move their rudders more slowly. Existing maximum
  forward/reverse speeds remain 2.5/1.5 tiles/s for other ships, 1.8/1 for carriers.
- Initial acceleration/braking rates: 0.65/1.1 tiles/s², carrier 0.3/0.6.
  Rudder travel: 1.5/s, carrier 0.8/s. These are provisional playtest values.
- Each movement step checks the existing hull against shore, docks, bridges and
  other vessels. Collision stops translation without adding damage or pushing.
  Turret bearings remain independent of hull steering.

## Sailing instruments

The engine telegraph floats near the lower-right edge, separate from the systems
panel. Gold marks the requested engine order; the blue needle moves with actual
signed speed. Stop and reverse still use the same braking simulation. The meter
uses tiles/second and respects reduced-motion preferences.

Ship systems start closed on boarding or reload. Click **Systems / U** or press
U to open flight-deck, weapons, ramp and cargo controls; U, Escape or Close shuts
them again. Live speed updates never reopen the panel. On narrow screens the
meter gives way while systems are open. WASD and desktop firing remain available;
phone weapon buttons remain in Systems. H opens air support from a carrier for
recall; strike dispatch keeps the existing robot-only rule.

## Interactions and safety

Dockside boarding, unloading, repairs, shore-ramp deployment and carrier flight
operations require actual rest: speed at most 0.05 tiles/s, angular speed at most
0.015 rad/s, and engine order Stop. Selecting Stop while still coasting does not
make these operations immediately available.

Ramps, submarine launch bracing and reserved carrier decks hold the ship in
place and clear propulsion. Retracting a ramp does not restore an old order.
The server validates engine orders and the currently controlled ship identity.
Input heartbeats continue with keys released. Expired input, disconnect, pause,
seat loss or restart clears throttle, speed and rudder; this safety stop takes
precedence over simulated momentum. Old saves load stopped without migration.

The server still persists normal hull position and heading. Throttle, signed
drive speed, displayed speed, rudder and angular speed are transient, included
in shared snapshots but excluded from ship save records. Action logs name the
engine setting instead of interpreting W/S as a compass movement direction.

## Fixed-wing stage

Manual jets and bombers retain W/S held speed control and forward-only flight
between 6 and 12 tiles/s. Holding A/D rolls into a turn; releasing levels the
wings gradually, then holds the resulting heading. Faster flight still widens
the turn. This is a 2D handling approximation, without altitude or stall physics.

Initial manual profiles (tiles/s squared, radians/s at minimum speed):

| Aircraft | Acceleration / braking | Full turn rate | Bank change per second |
| --- | --- | --- | --- |
| Bomber | 2 / 2.5 | 1.5 | 1.5 |
| Attack jet | 3.6 / 4 | 1.9 | 3.5 |

Automatic missions and boundary protection retain their existing steering and
speed controller. Accepted bomb releases hold heading and speed. Landing levels
the wings; helicopters retain their separate hover controller. Bank is transient,
shared in snapshots, excluded from runway/carrier saves and cleared on control
expiry. Airspeed and heading keep existing flight persistence and recovery rules.

The lower-right flight meter shows speed, bank, hull/ammunition and flight or
flak status. U/Systems opens the larger controls, Escape closes them. Parked
planes show ground controls; helicopters keep their existing panel. Speed updates
do not reopen a closed panel. Browser-only wing foreshortening shows bank;
reduced motion removes that added visual while retaining handling and readouts.

## Remaining vehicle stages

| Vehicle | Existing behaviour | Proposed next refinement |
| --- | --- | --- |
| Tank | Acceleration, braking, slower automatic reverse, bounded hull turning; hull-relative driving and independent turret | Revised acceleration, stopping distance and speed-dependent turns; player feedback next |
| Jets/bombers | Distinct manual acceleration and bank response; compact flight instruments | Playtest tuning; automatic mission/landing controllers retained |
| Helicopter | Bounded directional acceleration, braking drift, capped speed and cosmetic tilt | Playtest responsiveness and helipad approach |
| Recycler/builder | Existing vehicle controls | Consider weight and braking after the main combat vehicles |

Fixed-wing aircraft must never inherit ship Stop/Reverse controls in flight.
Automatic bombing, return paths, boundary turns and runway/carrier approaches
need regression checks before altering aircraft steering.

## Tank tuning follow-up

The 20 October pass retained 3 tiles/s forward, 1.6 reverse and world-direction
WASD; the 24 October controls above supersede that input mapping. Acceleration is now 3 tiles/s squared (one second to full speed), braking
6 tiles/s squared (about half a second and 0.71 tiles to stop at full speed).
The hull turns at up to 144 degrees/s near rest, falling to about 67 degrees/s
at full forward speed. The existing alignment rule slows sharp corners; the
vehicle continues along its hull heading instead of sliding sideways.

Turret rotation, HE/Magnetic recoil, weapon damage and collision geometry are
unchanged. Release brakes normally, with neutral heartbeats while coasting.
Tank input leases allow 700 ms for delayed phone heartbeats (other units retain
400 ms); expiry, disconnect and seat changes clear momentum. Focus loss stops
renewing the lease. These are provisional local tuning values,
superseding the initial rates in GROUND_WEAPONS.md.

## Verification

### Helicopter refinement, 22 October

Hold a world-direction WASD key to accelerate at 4 tiles/s squared to the existing
4 tiles/s maximum (one second from hover). Continued input holds that speed;
diagonal input shares the same cap. Release brakes at 6 tiles/s squared, stopping
from full speed in about 0.67 seconds and 1.33 tiles. Reversing first brakes the
existing velocity, then accelerates in the new direction. Turns retain sideways
momentum while approaching the new direction. These are provisional game values.

The existing server tick integrates velocity in steps of at most 25 ms. Map edges
remove outward velocity while permitting movement along the edge. No input brakes
to hover; an expired manual command cannot continue accelerating. Mouse aim and
turret tracking remain independent. Existing rocket windows, landing conditions,
automatic support/cruise/return and save/recovery rules remain in use.

The browser leans the body and rotor disc up to 26 degrees in the travel direction,
using a layered hull, cockpit, skids and raised rotor hub. A modest perspective
effect distinguishes lowered and raised ends: forward flight lowers the nose,
backward flight raises it, and sideways flight banks left/right. WASD remains
world-relative, so attitude follows travel relative to the mouse-facing hull.
It levels as speed
falls. This is a cosmetic overhead approximation, with no altitude simulation or
change to hitboxes, weapon origin or aim. Reduced effects removes the added tilt.

Domain checks cover acceleration, steady speed, diagonal normalization, braking,
reversal, turns, tick-size consistency, map edges and cosmetic attitude. Existing
helicopter mission, landing, ammunition and persistence tests remain required;
browser checks exercise keyboard flight and the existing desktop/phone controls.

Local validation: TypeScript and all 17 targeted helicopter tests passed. Seven
browser scenarios passed: acceleration/hover, desktop and phone held fire, helipad
deployment, remote support, intact-pad landing and destroyed-pad feedback. The
handling scenario also checks desktop-to-phone resizing. Not deployed to Fly.
Directional-tilt follow-up: TypeScript, the five handling checks and the browser
flight/resize scenario passed again. Inspected hover, forward/backward and both
sideways attitudes together at enlarged and normal game scales.

Ship checks cover acceleration, braking through zero, rudder centring, turn
radius, carrier response, bounded steps, collisions, actual-rest interaction
gates, HTTP authorization, control expiry, restart and shared snapshots.
Browser checks cover keyboard repeat, persistent throttle, touch controls and
desktop/phone layout. Use `scripts/check-naval-runtime.mjs` for a disposable
four-viewer workload; local measurements are not proof of Fly capacity.

Validated locally on 19 October: `pnpm check` passed all 562 tests in 85 files
and TypeScript checking. The desktop and phone Playwright helm scenarios both
passed, including key-repeat suppression, released-key cruising, reverse,
coasting and focus-loss stopping. No campaign saves were modified for testing.

The disposable four-viewer naval check ran for 31.29 seconds with four initial
ships and up to three swimmers (one stationary ship may be destroyed by design).
It measured 166.6 MiB peak process RSS, 5.4% of one CPU core and 82.79 ms request
p95 on local Windows Node. Server and test clients share that process; this is
a short smoke test, not a measured Fly resource guarantee. Raw local output is
in `.local/run/naval-runtime.json`. This stage has not been deployed.

Floating-meter follow-up: TypeScript and the three air-support UI checks passed.
Desktop and phone browser scenarios passed for helm controls/panel closure,
carrier delivery/cruise/recall/boarding, and side guns/volley/salvo. The phone
weapon scenario passed on retry after a native Windows runner crash. Screenshots
also cover phone landscape and the meter clear of the map toolbar. Results are
in `.local/floating-helm-final.log` and `.local/floating-helm-touch-retry.log`.
These UI changes are local and have not been deployed.

Fixed-wing validation (19 October): `pnpm check` passed TypeScript and all
568 tests in 86 files. Eight desktop/phone browser scenarios passed across the
handling instruments, carrier operations, jet delivery/held fire/saved flight,
and bomber bombing/manual return/landing/rearm checks. The manual-return test
pilot now anticipates bank deceleration before levelling; it still uses normal
movement keys and the actual runway capture rules, without teleportation.
Evidence: `.local/aircraft-handling-check.log`,
`.local/aircraft-handling-browser-final.log`, `.local/flight-meter-final.log`,
the attack-jet cases in `.local/flight-regression.log`, and
`.local/manual-flight-return.log` / `.local/manual-flight-return-phone.log`.
The earlier manual-return failures in the combined log used the old instant-turn
test pilot and are superseded by those passing runs. Local only; not deployed.

Tank follow-up validation (20 October): TypeScript and 37 targeted motion,
vehicle lifecycle, guard and transport tests passed. Desktop and phone browser
checks passed acceleration, release/coasting, slower reverse, turning and reload.
The lifecycle test was rerun after extending the tank input lease to 700 ms;
peer visibility, stale-input stop, disconnect and restart passed. Browser travel
includes input/network latency; the domain test verifies the 0.71-tile braking
distance. Local changes only; no Fly load claim or deployment.
