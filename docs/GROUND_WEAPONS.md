# Sentry and tank weapons

Implemented stages: sentry modes, rover weapons, and orbital tank deployment.
Deploying the orbital core changes the player into a robot; the robot can then
call a tank, board it, drive and fire, and exit beside the saved parked vehicle.
Tank armor, destruction, repair and resource costs remain later stages.

## Controls

- Inspect your sentry through Site controls and choose Machine gun or Flamethrower.
  The choice also works for your core's sentry. Only its owner can change it.
- In the rover, the Cannon selector chooses HE or Magnetic. Click LMB / press
  Space once to fire or begin charging; holding is unnecessary.
- Press 1 to toggle the tank's LMB weapon between HE and Magnetic; press 2
  to toggle its RMB weapon between Machine gun and Fuel jet. Each press changes
  only that slot; holding a number key does not repeatedly switch weapons.
- The RMB selector chooses Machine gun or Fuel jet. Hold RMB / J to fire.
  The default remains HE plus machine gun. Phones have labelled action buttons.
- Both weapons follow the actual stabilized turret, including during charge-up.
  The gold marker shows desired aim; the blue diamond shows the current bearing's
  endpoint. Only HE has a blast-radius ring.
- Since 11 October, aiming beyond a tank weapon's range fires toward that point
  at maximum range instead of rejecting it. HE still supports shorter aimed
  bursts; all rounds follow the real turret and can hit an intervening obstacle.
  Naval and artillery firing envelopes are unchanged.

## Initial tuning

| Weapon | Range | Behavior |
| --- | --- | --- |
| Robot fuel | 5 tiles | Existing liquid stream, unchanged |
| Sentry/tank heavy fuel | 8 tiles | Liquid packets at 14 tiles/s, lethal contact |
| Magnetic cannon | 24 tiles | 1 s charge, 120 tiles/s, 180 direct damage, 2.5 s reload after firing |

Magnetic shots use a cyan-white streak and a growing charge glow. They stop at
the first enemy or solid obstacle, with no blast, penetration or crater. Heavy
fuel shares robot fuel collision, charred remains and friendly immunity. It
leaves no ground fire. Sentries retain automatic targeting and turret traversal;
their fuel exits just beyond their own footprint so it cannot hit its own mount.

Equipment choices are saved before acknowledgement in an additive SQLite
`equipment` table. Dismantling a sentry removes its saved choice atomically.
Existing saves default to HE/APCR and APCR sentries. In-flight attacks, charge
and personal reloads are transient. Charge is cancelled by focus loss, menus,
disconnection, weapon/body changes and taking facility control. Cancellation
does not refund the already-started reload.

Charges reserve projectile capacity: at most 16 charges and 64 charges plus
ordinary projectiles. Fuel retains the shared 96-packet and 12-per-source caps.
These bounds do not establish large-army performance on the hosting machine.

## Evidence

Domain checks cover default/selected loadouts, delayed release on the current
bearing, obstacle interception, cancellation, longer fuel travel and sentry
self-clearance. Desktop and 390-by-844 browser checks use two guests and an
isolated save: selectors, ownership rejection, shared charge/projectile/fuel,
restart persistence and phone controls. Screenshots are in `docs/previews/`.

## Orbital tank deployment

Ground forces now includes Tank drop pod. It requires a deployed robot. The
19 October fleet stage removes the prototype's per-player and world caps; every
tank still needs paid deployment and clear space. Select the central
1-by-1 pod tile in orbital survey. Four 1-by-4 panels form a 17-tile cross within
a 9-by-9 boundary; the corners remain untouched. All 17 cells must be land and
clear of units, rails, other pods and facilities. Rocks become walkable flooring
under the completed panels; original terrain data stays intact.

The core and tank share pod geometry helpers, the 4.5-second deployment clock,
landing effect, four staggered hinges, panel strikes and reduced-effects behavior.
The tank rolls two tiles east from the center after the panels unfold. The
whole cross blocks movement/construction until deployment completes. The empty
pod and panels remain walkable after the tank leaves.

Approach within 1.8 tiles and press E or Board tank. Any active teammate robot
may board an unoccupied tank; one seat is enforced server-side. The robot is
inside, with no separate outside body or autonomous guarding. Existing robot
health is retained and crawlers do not attack the embarked robot. Vehicle damage
is not implemented in this stage. WASD drives; the existing independent turret
and HE/Magnetic plus APCR/Heavy fuel selectors apply. Exit tank / E places the
robot at a clear adjacent location; a blocked exit keeps it safely aboard.
Exit before building, recovering, or taking facility control.

The additive tanks table saves pod location/progress, tank position/bearing,
weapon selections and seat occupancy. Accepted deployment/boarding/exiting and
loadout changes save before acknowledgement. Movement checkpoints every half
second and on disconnect, sharing a transaction with the scout position. A
disconnected driver stays inside the stationary saved tank and resumes there;
exit before leaving if a teammate should use it. In-flight attacks stay transient.
Drops pause with no connected viewers and resume after restart. Saved pods never
replay or grant another tank. Find my deployed tank centers the camera without
teleporting the robot.

Tank collision uses a 0.42-tile half-width, independent of sprite artwork. Tanks
and incoming reservations participate in movement, spawn/path searches, sentry
placement, core placement, missile placement and carriage clearance. Tanks cannot
drive through solid terrain, other tanks, active deployment footprints or active
nearby scouts. Friendly weapon damage remains disabled.

Validation adds footprint/collision and isolated HTTP lifecycle tests (including
pause, interrupted landing, exclusive seating, restart while aboard, weapon
persistence and obstructed exits), plus two-viewer desktop and phone flows.


## 19 October follow-up: parked tank guard

See [Tank guard](TANK_GUARD.md). Empty tanks now guard with their selected HE or
Magnetic main gun, prioritising visible Bulwarks, while occupied tanks remain
manual. Reload belongs to the hull across boarding/exiting. Named campaigns save
automatic charges and accepted shells; the earlier transient-attack description
above refers to the original tank prototype.

## 19 October: tank weight and firing feedback

The first semi-realistic movement slice is implemented locally, with full
integration/browser validation still pending. Tanks retain world-direction
WASD/arrows and phone controls. The hull turns toward the requested direction;
requests more than 120 degrees behind the hull use slower reverse. Turret aiming
stays independent, so the driver can retreat while firing forward.

`public/tank-motion.js` supplies provisional tuning: 3 tiles/s forward,
1.6 tiles/s reverse, 4 tiles/s² acceleration, 8 tiles/s² braking and up to
153 degrees/s hull turning, reduced at speed. Release brakes to rest in about
0.375 seconds and roughly half a tile from full speed. Reversing brakes through
zero. Poor alignment reduces drive speed while the hull turns. Collision stops
translation; it does not slide the tank sideways along an obstacle.

The server retains its 100 ms tick. Movement uses at most six 25 ms substeps
per update with the existing 0.42-tile clearance, bridge/dock flooring, other
tanks and active walkers. Directional armor, traction, terrain height, damage,
projectile rules and ship/aircraft handling are unchanged. No new global physics
engine, persistent velocity fields or network particle records are introduced.

Drive speed is transient on the seated player. Expired input, disconnected or
inactive drivers, boarding/exiting, and lifecycle stop commands clear momentum;
saved hull position and heading retain the existing checkpoint policy. Reopening
a campaign starts stationary. Ordinary release gets braking, while loss of
control gets a safe stop. Transport transfers retain their existing atomic seat
and cargo changes and invalidate the previous input lease.

Accepted HE and Magnetic shots now animate barrel recovery and a small hull
kick opposite the actual shot bearing. These are browser-only offsets: they do
not move the hitbox, affect aim or damage, or add server simulation. Reduced
motion suppresses the added hull kick. The key reference explains reverse and
release-to-brake behavior.

Validation on 19 October: dependency-free Node assertions passed acceleration,
braking distance, reverse speed, 10 Hz/40 Hz trajectory agreement, completed
bridge crossing, water/obstacle stopping, bounded timesteps, shot-bearing recoil
and reduced-motion behavior. JavaScript syntax and `git diff --check` passed.
Added Vitest coverage includes these cases and a two-viewer HTTP/SSE scenario
for movement, release, input expiry, disconnect and restart. That suite, existing
transport/lifecycle regressions, TypeScript and desktop/phone browser inspection
could not run: dependencies are absent, sandbox npm access fails, and automatic
approval review failed at capacity on both authorized install attempts. This is
not Fly deployment or sustained-load evidence. Review driving feel and narrow
turns before extending the model to ships or jets.

Later 19 October validation: dependency installation succeeded during the
multiplayer-report review. TypeScript and all 51 targeted tests passed, including
the new tank motion and tank HTTP/SSE lifecycle cases. See
[Multiplayer test report](testing/multi-user-test-report.md) for the executed
scope. Tank-specific browser driving/recoil and transport regressions remain
separate from those multiplayer browser checks; no Fly capacity claim is added.
