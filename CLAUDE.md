# Frontier working agreement

## Agreed direction

- Follow the published final-project contract and unchanged Fly machine and
  volume settings. Keep the two supplied spec invariants.
- Pure overhead 2D projection with square tiles; no isometric battlefield assets.
- Build and review playable stages. Preserve GAME_IDEAS.md as the larger vision;
  do not treat every brainstormed feature as required for the current stage.
- Update README.md at agreed stage checkpoints, not after each gameplay change.
  Keep incremental implementation details in the relevant design docs and checks.
- README.md is the argument for a solo-playable cooperative campaign: defend,
  build and expand territory, operate facilities and vehicles, and eventually
  secure the planet. Keep current implementation separate from this roadmap.
- One to four players is the intended range, not an enforced or validated limit.
  Measure representative sustained battles on the course machine before claiming
  capacity. If the maximum must shrink, retain at least two simultaneous players.
- Current stage: shared saved construction, robot combat and recovery, ground
  weapons and tanks, rail artillery and missiles, gunships and submarines, and
  the first airbase/HE bomber loop. Combat and cosmetic traces remain transient.
  Territorial conquest, economy, host-owned campaigns and balance remain future
  work. The individual stages and limitations are recorded below and in docs/.
- The player ultimately operates robots and multiple forces. The rover sprite
  is a clearly labelled temporary representation, not a settled character design.

## Implementation standards derived from this stage

- Save accepted building changes before reporting success. Checkpoint movement
  and explain its durability window. Existing worlds must not regenerate on reload.
- Keep terrain, territory, objects, and rendering separate. Collision comes from
  world data, not sprite dimensions or what happens to be inside the camera view.
- Enforce placement and ownership rules on the server. Browser drawings do not
  determine shared outcomes.
- Guest identity is browser-bound at this stage; do not claim account recovery,
  private rooms or host ownership. Friendly entities never receive weapon damage.
- Optional email/password registration is planned, not implemented. Preserve
  immediate guest entry. SMTP would deliver real verification/recovery emails;
  a dummy email flow must be visibly labelled as simulated and cannot establish
  verified ownership of an address. Do not claim portable accounts or recovery
  until implemented and checked. Define guest-save linking before account work;
  do not silently replace existing identities or their saved progress.
- Keep the battlefield visible on phones. Deployment uses a card tray and site
  confirmation overlay; page scrolling must not be required to play.
- Desktop: WASD/arrows move, mouse aims, LMB fires HE, held RMB fires the machine
  gun. Middle-drag pans. Weapon readouts are passive and highlight accepted shots.
  The player turret traverses at 180 degrees/second in world space, independent
  of hull rotation. The server owns the actual firing bearing for both weapons.
  Gold crosshair = desired target; pale-blue diamond = current HE aim point.
  Reuse the shared configurable turn function for rotating mounts. APCR sentries
  turn at 270 degrees/second, retain valid targets and fire within 2 degrees of aim.
  Keep explicit phone and keyboard firing alternatives. Stop held fire on release,
  focus loss, menus and disconnection; reconnection must not restart it.
- Source assets/ stays local and ignored. Track selected runtime assets, licenses,
  and provenance so Docker builds need none of the local source library.

The first core deployment is implemented in docs/CORE_DEPLOYMENT.md: an opt-in
orbital survey, saved 57-tile cross footprint, staggered unfolding and robot exit.
Keep occupied footprints reserved until completion; flooring must affect server
collision as well as appearance. Preserve existing saves. The temporary limit
is one core per scout and eight per world, not an implemented resource economy.
The remaining robot/base proposals in docs/ROBOT_DEPLOYMENT_DESIGN.md are design
work. Implemented health/death and shared recovery are tracked in docs/SURVIVAL.md;
sound and resource costs remain later stages.

Robot combat is implemented in docs/ROBOT_COMBAT_DESIGN.md. A deployed robot
uses held LMB/Space fuel and held RMB/J laser, with labelled touch buttons.
Its aim-facing body turns at 540 degrees/s; world-direction movement animates
relative forward/backward/strafe steps. Shared weapon profiles drive HE preview
radius and server damage. Fuel packets travel on their original bearings;
laser pulses resolve the nearest hit immediately. Surviving laser targets burn
and flee, then reacquire the pad. These robot weapons stop at solid structures
as well as rocks; friendly entities take no damage. Robot-deposited ground fire
and repairs are subsequent stages. Personal health is persistent in the additive
robot_states table. Crawlers telegraph strikes against active robots; disabled
bodies cannot move/fire/build. Replacement uses a selected friendly core's clear
recovery area, with idempotent requests and landing revalidation. Preserve life
state on reload/restart and never grant a new core on death.

Railway artillery is implemented in docs/RAIL_ARTILLERY_DESIGN.md.
Preserve the additive rails/artillery tables, three-wide track corridor, complete
3×3/swept carriage collision, shared single-operator control and release on
death/disconnect. Artillery is manual only: slow independent 360-degree traverse,
stop/brace, one selected shell per accepted command. Its three-tile damage radius is
independent of the eight-tile cosmetic crater. Do not expose heavy HE through
personal weapon selection. Durable field saving remains a later stage. Tests must use isolated saves; runtime checks are small workloads,
not evidence for the full combined-forces game.

Manual artillery uses mouse/touch desired target, LMB/Space single fire and
WASD world-direction rail travel. Two markers separate requested aim from the
actual ballistic landing point. Slow bearing/elevation converge server-side using
the higher arc; never snap to the cursor on firing. 1/2/3 selects HE/Fire/Gas.
The orbital overview opens by default, with ordinary pan/zoom. The bottom
facility manual replaces body controls until exit. See docs/CANNON_CONTROLS.md.
Server commands expire after 350 ms; a started reserved rail segment completes,
but no new segment begins without fresh input. Reject off-map actual impacts.
The approved guarding, curve and map-expansion stage is implemented in
docs/GUARD_CURVES_EXPANSION.md. Robots hold position and use existing fuel/laser
weapons while their player operates a gun. Stop automatic fire on handoff, death,
recovery, disconnection or lease loss; no autonomous rover/vehicle/jet combat.
NE/SE/SW/NW curves use radius-three arcs with a reserved eight-tile-square apron,
straight endpoint supports, saved movement and independent turret bearing.
The versioned world is now 128 by 96 tiles. Preserve every original terrain
cell at its coordinate and the saved pre-expansion JSON; the old-region causeway
is an overlay. Never regenerate player construction or move existing records.
Keep terrain rendering cached and overview rendering cheap. The expanded map
and short resource checks do not establish large-army capacity.

Artillery incendiary/gas fields are implemented in docs/ARTILLERY_FIELDS.md.
Keep lethal contact, exact gas capacity, fire-first hazard priority, friendly
immunity and simulation-time expiry authoritative. Gas has no timer. Cap active
and incoming fields together; shell selection shares reload and cannot alter
in-flight ammunition. Retain fields across drills, reset them on server restart.
Robot/sentry weapon loadouts remain unchanged. Test all accounting and route
interactions before changing field size, caps or monster numbers.

Junction switches are implemented in docs/RAIL_SWITCHES.md. Only a curve owner
installs one, after both routes have support tracks and the full apron is clear.
Connected active teammates may set its explicit saved route. Any cannon body or
movement reservation in the apron locks route changes and track removal there.
Preserve additive rail_switches records; remove a curve and its switch atomically.
Ordinary curves keep their original routing until explicitly upgraded.

## Review

The user's compact-rail correction supersedes broad curves for new construction:
see docs/COMPACT_RAILS.md. Corners and junctions occupy one tile, EW/NS overlays
merge into J on owned clear track, and WASD chooses connected exits. No separate
route menu for compact rails. Preserve legacy broad curves and switches in saves.
Keep cannon footprint and temporary swept-turn collision separate from the
one-tile permanent rail reservation. Save merged rails before acknowledgement.
Never teleport through a missing or nonreciprocal connection.

Rail ground checks use coreBlocks rather than rejecting every coreCell. Completed
flooring and the H pad are traversable; machinery, active deployment reservations,
uncovered rocks, water and sentries remain blocked. Guest arrival/fallback must
find clear ground if a cannon occupies the original spawn.

For compact turns, unit collision follows the swept rotating 3-by-3 body rather
than the coarse static-obstacle reservation. Use the same sweep in canStand so
nearby scouts are not falsely displaced by session validation during a turn.
Preserve actual swept-corner collisions and identify the blocking unit.

The three-warhead missile battery is implemented in docs/MISSILE_LAUNCHER_DESIGN.md:
fixed 4-by-4 footprint, 12-by-18 target area, 12 staggered missiles, 15-second
reload after last launch, full-area 15-to-100-tile range. The artillery collection
includes kind=missile records; preserve old cannons, shared control and guarding.
Keep two committed volleys maximum, immutable impact assignments, independent
cannon limits and durable reload. Fire/gas use scattered round impact patches
with matching server contact/pathfinding, clipped to the target rectangle. Minor
landing blasts and craters are cosmetic. Fire patches last 18s each; gas shares 18 kills
with no timer. Reserve 216 square tiles per incoming/active barrage against a
512-total/256-per-type hazard area budget, alongside the existing count limits.
Exhausted gas retains its reservation until the last missile lands; late arrivals
cannot refill it. Apply simultaneous fire before gas and preserve friendly immunity. Friendly
damage and terrain modification are forbidden; particles remain browser-only.

HTML and snapshots share a build fingerprint computed at server startup from
the server and runtime JS/CSS/HTML. Reload an outdated client before consuming
new state formats; do not silently pair an old field renderer with new geometry.
Hazard visual checks must include aged fields, not only impact flashes or labels.

- Run relevant HTTP/domain tests and inspect the browser at 1920x1080 and 390x844,
  including keyboard use and resize. Inspect screenshots as well as test results.
- Keep test saves separate from user saves. Do not reset the user's world for tests.
- In live-tick HTTP tests, wait for observable simulation state before asserting
  arrival or docking. Fixed-duration movement sleeps depend on runner scheduling;
  preserve explicit time bounds and assertions on the resulting action.
- Treat memory/CPU feasibility as unproven until measured under representative
  sustained load. A world preview is not a validated combat-server benchmark.
- Record implementation evidence without inventing the author's reflection,
  commit history, playtesting conclusions, or deployment success.

Ground weapon choices are implemented in docs/GROUND_WEAPONS.md. Preserve the
additive equipment table and owner-only sentry choices. Default HE/APCR remains;
tank primary HE/Magnetic and secondary APCR/Heavy fuel are separate selections.
These weapons now also apply to deployable, boardable tanks; see the orbital
tank section of docs/GROUND_WEAPONS.md. Shared pod geometry/timing/rendering must
preserve the original 57-cell core and the new 17-cell tank cross. Keep tanks
and seat ownership in the additive tanks table, save seat transitions before
acknowledgement, and checkpoint movement atomically with the driver. An embarked
robot has no separate outside body or autonomous guarding. Offline drivers retain
their seat and resume in place; an empty tank can be boarded by a teammate. Check
all adjacent exit candidates without teleporting through blocked cells. Vehicle
damage and destruction now follow docs/VEHICLE_COMBAT.md; resource costs remain
a future stage.
Robot loadouts remain unchanged. Magnetic charges reserve projectile capacity,
follow the current turret and cancel on focus loss, disconnect or body/control
changes. No magnetic blast/crater. Heavy fuel shares lethal liquid packet logic
with an eight-tile range and the existing packet caps.

The coastal gunship stage is implemented in docs/NAVY.md. Orbital water delivery
reserves a clear shore boarding point without flooring the ocean. Preserve the
additive ships table, exclusive saved seat, independent turrets and six-second
per-turret reloads shared across HE/Fire/Gas. W/S drives forward/reverse; A/D steers with full hull
clearance. Restart at sea must restore the seated robot inside its ship. Board
and exit through an aligned completed berth or a validated deployed shore ramp.
Vehicle damage/destruction and surface swimmers are implemented in
docs/VEHICLE_COMBAT.md. Keep shipyards as a subsequent stage. Preserve enemy-only
hull damage, atomic vehicle/pilot loss, offline seat handling, and owner-only
idempotent redelivery at a revalidated original site. Naval contacts share a
30-second timer and six-swimmer cap, coexist with ground drills, and pause with
no viewers. Keep water routing bounded and collision authoritative. Enemy waves
remain transient on restart; hull damage and loss never reset with them.

Gunship main salvos and side guns are implemented in docs/SHIP_ARMAMENT.md.
Preserve two twin main turrets, one-click turret volleys and double-click
salvos of all ready mounts. Admission is atomic for the selected two/four
rounds. Preserve independent six-second main reloads, saved next-turret order,
legacy cooldown migration, independent port/starboard secondary cooldowns and
hull-relative outward arcs. Main turrets remain world stabilized. Cursor input
cannot override actual mount angles. Keep shot requests individual and clear
held inputs on release, blur, menus and disconnection. Preserve additive mount
poses in old ship saves, existing projectile/field budgets and friendly immunity.

Remote shore landings are implemented in docs/SHORE_RAMP.md. G deploys/retracts
the built-in ramp; E boards/exits. Preserve bounded two-tile hull-edge reach,
complete crossing clearance, server-selected endpoints, saved anchor pose,
movement lock, temporary construction reservation and revalidation on handoff.
The ramp never floors water or creates a general walking bridge. Keep the
original berth and the current single-seat model; passengers/cargo remain later.

The missile submarine is implemented in docs/SUBMARINE.md. Preserve
legacy gunships with missing kind fields, one vessel of each type per owner and
four vessels total. Submarines share hull/seat/ramp/damage rules but launch six
missiles at a 6-by-8 area, with 1.25s bracing and 18s reload after last launch.
Keep full-area range checks, atomic admission and existing shared barrage/hazard
budgets. No gunship cannon/secondary access. Diving now follows the depth section
of docs/SUBMARINE.md: Left Ctrl dives, Space surfaces, LMB launches. Preserve
server-owned two-second vulnerable transitions, limited battery and forced
surfacing, saved depth and viewer-based pause. Only fully submerged hulls lose
swimmer targeting. Surface access is required for missiles, ramps and boarding.
Docks remain vulnerable; existing shore sentries provide optional defense.
Fleet finding/replacement must act on the selected owned vessel and retain type.
Restart preserves reload and clears transient launch brace and combat.

The first airbase/HE bomber loop is implemented in docs/AIR_FORCE.md. Preserve
the separate saved aircraft seat and additive airbases table. W/S adjusts only
positive forward speed; A/D turns with a speed-dependent radius. LMB releases
six HE bombs along server-owned predicted impacts, holding course for the short
release sequence. Two runs per load, automatic slow-approach landing and timed
base rearming form the first loop. Preserve friendly immunity, shared barrage
caps, existing world geometry, full airbase construction reservation and separate
walkable-runway/solid-hangar collision. Airborne pilots have no ground body or
ground weapons. Viewer-based pause, offline cruise and saved flight state apply.
Fuel, anti-air/base damage, other warheads and carriers remain future stages.
