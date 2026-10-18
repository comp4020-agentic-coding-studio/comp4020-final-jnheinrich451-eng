# Frontier working agreement

## Agreed direction

- Follow the final-project contract and keep the two supplied spec invariants.
  The current Fly baseline is one shared CPU, 256 MB RAM and the existing volume.
  On 9 October the user reported that a justified RAM increase can be discussed
  with the teaching team. Treat 256 MB as the current configuration, not an
  absolute ceiling; document evidence and the agreed size before changing it.
- Pure overhead 2D projection with square tiles; no isometric battlefield assets.
- Use GAME_DESIGN.md as the central game-design guide before proposing a stage.
  Preserve its agreed boundaries; distinguish current behavior, proposals and
  open questions. It does not authorize the whole roadmap. Start stage briefs
  from the player combat loop, success/failure, affected states and saved results.
  Check later stage records when an older document describes superseded behavior.
- GAME_DESIGN_WORKSHEET.md is the author's fill-in companion. Accept informal
  answers and unknown numbers; examples are proposals. Turn the answers into a
  bounded stage brief rather than treating every filled card as an instruction
  to build it immediately.
- The agreed campaign is planetary conquest: a large explorable map, visible
  hostile sites and permanent objective completion. No site-regeneration timers
  or enemy recapture. The 12 October construction stage below refines large-infrastructure placement; conquest does not unlock build permission. Facility
  loss never reverses conquered sites. Exact map scale and objective rules remain open.
- Planned facility durability uses HP and numeric armor: enemy penetration below
  armor deals no damage; equality or greater permits attack damage. Values are
  untuned, and friendly immunity remains. Do not silently apply this new threshold
  to existing robot/vehicle damage or change lethal alien hazard behavior. Define
  occupied-facility and all-core-loss recovery before enabling their destruction.
- New enemies and facilities need a tactical role and bounded runtime cost.
  Keep spawn cadence separate from living-population caps; evaluate simultaneous
  fronts before claiming the large planet fits the configured Fly resource budget.
- Enemies should give up distant pursuit. Exact ranges and subsequent behavior
  remain open. Disengagement, sleeping simulation and despawning are separate;
  do not silently heal enemies, reset sites or drop accepted off-screen attacks.
- The 10 October scanner/noise proposal is in docs/DETECTION_AND_ALARMS.md.
  Confirmed: focused tracking stops circular search, marks fade after lost lock,
  and solid obstacles block the tracking beam. The first scanner/mark/defender
  stage is implemented locally; noise and neighbor sharing remain future work.
  Preserve submerged escape, bounded pursuit and permanent
  conquest. Detection is separate from a unit's ability to reach/attack a contact.
  Noise/neighbor reports convey last-known positions, not unlimited live tracking;
  propagation limits, sensor tuning and other medium rules remain proposals.
- The 12 October UI refinement is agreed in docs/UI_REFINEMENT.md (all five
  stages implemented locally): survey-instrument HUD/menus over the unchanged natural terrain,
  one deploy catalogue including logistics buildings, a single keymap table and
  client-only asset codes shown beside names. Presentation/input only; never
  alter server rules, prices or save formats. Add keys to keymap.js BINDINGS
  (precedence, labels, F1) and catalogue entries to catalogue.js; never reuse codes.
- Build and review playable stages. Preserve GAME_IDEAS.md as the larger vision;
  do not treat every brainstormed feature as required for the current stage.
- The author approved the sequence modifier → settlement → anti-air → attack jet
  on 11 October, with playable review between stages. docs/ENVIRONMENT_MODIFIER.md
  records the first implementation: bounded cosmetic ground conversion, initial
  guards only, HE conquest and saved permanent recovery. Never classify new
  non-alert site kinds as scanners/reinforcement callers by default. Preserve
  collision terrain and safe backed-up additions to existing campaigns.
- The small settlement is implemented in docs/ALIEN_SETTLEMENT.md: three required
  structures reuse crown/mortar/root behaviour and existing global enemy caps.
  Saved membership defines the checklist; missing members never imply completion.
  All three must be permanently destroyed; survivors remain. Add compounds
  atomically with a backup, preserving terrain and prior progress. The subsequent
  anti-air stage below adds aircraft damage; the attack jet remains future work.
- The author subsequently chose the air contaminator as the next separate stage.
  docs/AIR_CONTAMINATOR.md records fixed opaque fog, surveyed coordinates, HE
  destruction and saved eight-second clearance. Reduced effects must not bypass
  concealment. Ground units/aim and attack warnings stay below the fog; only
  approved artillery/naval/air aiming stays above it. Preserve physics, sensing,
  previous conquests and backed-up migration. Blight hatching remains a proposal.
- The separately authorized lance tower is in docs/LASER_TOWER.md: close acquisition,
  slow ground tracking, cover, charge, two-second beam and five-second cooldown.
  Preserve actual-ray damage, crew immunity, bounded logs and saved phase timers.
  The author's latest refinement restores a full 40-tile beam, clipped by hits
  and cover. Charge holds its bearing; firing pursues at four degrees/second.
  Only the angle tracks; discard obsolete variable-radius endpoint state while
  preserving phase timers. Sideways escape works; radial retreat can be hit.
  Three/nine-second lethality means cumulative robot/tank beam exposure. Keep the
  first encounter outside contaminator fog; facility armor remains later work.
  Distant battery/submarine aim clamps the whole rectangle along its bearing;
  preview and server must agree, retaining minimum range and other fire gates.
- The 11 October mortar stage is in docs/MORTAR_OUTPOST.md: one additive saved
  corrosive outpost, rotating launcher, fixed-point warnings and accepted airborne
  attacks. Two initial guards only; no reinforcement waves or scanner marks.
  Acid currently damages robots/tanks once per blast, with existing protection and
  recovery rules. Ships, aircraft, facility HP and armor changes remain deferred.
  Preserve completed sites and equipment during migration; back up before placement.
- docs/ORBITAL_CLEANUP.md records the author's orbitally delivered reclamation
  unit as future work only. Cleaning visual ruins must retain permanent conquest;
  costs, radius, salvage and converted-terrain restoration are unresolved.
- Update README.md at agreed stage checkpoints, not after each gameplay change.
  The 11 October defensive-sector stage is in docs/DEFENSIVE_SECTORS.md: red
  shading is overview territory, not detection or weapon range. Attack reports
  carry impact positions with one-hop/cadence/memory limits; only intact alert
  stations call warned, capped reinforcements. This implements bounded attack
  sharing, not the proposed general movement-noise network. Tank distant aim
  clamps travel to weapon range while retaining actual turret bearing.
  Keep incremental implementation details in the relevant design docs and checks.
- Crit 9/10 preparation is implemented locally in docs/OBSERVABILITY.md and
  docs/CRIT_9_10_EVIDENCE.md. Keep structured operational logs, sensitive-field
  allowlisting and original actor/projectile attribution through combat saves.
  Log committed named-world outcomes after checkpoint success; never serialize
  account rows, request bodies, invitation codes or cookies. Retain server-side
  permission checks and the exceptions in ADR-002. Local peer-display timing is
  not Fly capacity evidence. Use check:evidence --crit=9/10 for the specific cutoff;
  write reflections from real author/classroom findings, not anticipated success.
- Economy design was reopened on 10 October; see `docs/ECONOMY_DESIGN.md` for
  its combat purpose and pending ownership/source/spending choices. Keep current
  free deployment until a concrete economy stage is agreed; do not invent prices,
  balances, income or ownership. Height/physical-behavior proposals are recorded
  in `docs/ELEVATION_DESIGN.md`: overhead 2D and movement stay, while terrain height
  may affect trajectories and obstruction. No elevation mechanics are implemented.
- The first conquest stage is implemented locally in `docs/CONQUEST_STAGE.md`:
  named campaigns gain one safely placed alert station, with backup and additive
  checkpoint migration. All HE platforms damage it; destruction permanently
  removes its hostile overlay/calls while defenders survive. Calls require local
  presence/recent hits and are capped. Keep drills independent, preserve partial
  progress and bounded pursuit, and do not add currency rewards. Biological art
  should be mildly unpleasant, overhead and readable; final textures remain open.
- README.md is the argument for a solo-playable cooperative campaign: defend,
  build and expand territory, operate facilities and vehicles, and eventually
  secure the planet. Keep current implementation separate from this roadmap.
- One to four players is the intended range and named rooms enforce four distinct
  participants; this is not validated sustained-combat capacity on Fly.
  Measure representative sustained battles on the course machine before claiming
  capacity. If the maximum must shrink, retain at least two simultaneous players.
- Current stage: shared saved construction, robot combat and recovery, ground
  weapons and tanks, rail artillery and missiles, gunships and submarines, and
  the first airbase/HE bomber loop, and isolated host-owned campaigns locally.
  Named campaigns checkpoint combat; legacy combat and cosmetic traces stay transient.
  Alert, mortar, root, settlement, contaminator and lance objectives are deployed;
  anti-air is local. Economy and final balance remain future work. Stage
  limitations are recorded below and in docs/.
- The player operates robots and multiple forces. Guests without a core or an
  occupied vehicle begin in orbital core selection, with no ground body. Preserve
  existing identities and owned objects; returning deployments resume saved state.

## Implementation standards derived from this stage

- Save accepted building changes before reporting success. Checkpoint movement
  and explain its durability window. Existing worlds must not regenerate on reload.
- Keep terrain, territory, objects, and rendering separate. Collision comes from
  world data, not sprite dimensions or what happens to be inside the camera view.
- Enforce placement and ownership rules on the server. Browser drawings do not
  determine shared outcomes.
- Unlinked guest identity remains browser-bound. Optional accounts now link the
  same stable player ID after activation, preserving ownership and saved state.
  Campaign isolation and host ownership are now implemented locally. Friendly entities
  never receive weapon damage.
- The 9 October account implementation is in `docs/ACCOUNT_DESIGN.md`: real-email
  and Demo registration/login, private simulated inbox, verification/resend,
  recovery and logout. Preserve guest entry by invitation and visible Demo labels;
  Demo activation never establishes email ownership. SMTP is configured on Fly;
  connection, TLS and Brevo authentication passed on 11 October without sending
  mail. On 12 October the author reported receipt in ANU Junk and a Brevo account
  suspension; its cause is unconfirmed. Do not treat SMTP configuration as proof
  of current delivery availability or revised wording as a suspension fix.
- Current account defaults preserve guest progress and require explicit takeover
  before replacing another account session. Do not silently merge another guest
  during login. Rotate old guest credentials when attaching an account; expire
  sessions, stop held inputs and revoke live streams on logout/reset/takeover.
  Keep private account data out of game snapshots. Authentication changes need
  save-retention, token-replay, inbox-isolation and live-control checks.
- Accounts adapt Crit 7's real/Demo separation, not its ANU-only addresses or
  academic schema. Keep SMTP secrets server-only; local .env is ignored and loaded
  by pnpm dev/start. Never copy credentials from another repo automatically.
- `docs/ENEMY_DESIGN_DISCUSSION.md` records the filled worksheet's new site,
  behavior and art requests. Do not silently resolve the armor-model conflict
  or remove existing fire avoidance/burning panic. Only alert stations are
  requested to call reinforcements; guards and patrols are separate concepts.
- The agreed entry/campaign plan is in `docs/ENTRY_AND_CAMPAIGNS.md`: one planet
  template first, owned campaigns or join a friend, and no ground operator until
  initial core deployment. Returning players resume saved state. Accounts alone
  do not themselves create a campaign. `/` and `/campaigns/` provide the Caldera
  selector and explicit create/join/resume flow; retain the labelled legacy shared
  world at `/?legacy=1`. Optional video is deferred. A new planet needs a server
  generator/migration as well as catalogue metadata; never remap an existing save.
- `docs/CAMPAIGN_STAGE.md` records the implemented local campaign foundation:
  Email/Demo accounts may host, unregistered guests may only join, and
  owner exit saves/closes the room and returns members to the lobby. Invited
  accounts retain membership for future owner-opened sessions. Departing guests'
  contributions persist and the host can manage their buildings. Guest-session
  visits survive refresh/disconnection for 30 seconds, then expire; owner loss
  freezes the room for the agreed 30-second grace. Solo pause resumes with a warning
  on admission of a teammate. Preserve per-runtime authorization and recheck delayed
  commands against their original visit/runtime. Campaign combat checkpoints retain
  accepted attacks across closure/restart; legacy combat remains transient. Keep
  root and per-campaign maintenance locks, additive migration backups and the
  shared account store. Never silently erase legacy guests.
- Temporary reset tooling is local/operator-only in this stage, with a SQLite
  backup before clearing and the server stopped. It clears the entire current
  legacy test world, retaining named campaigns and their membership. Do not expose a public reset endpoint or
  apply it to Fly without an explicit request. Retain the maintenance lock when
  opening a world. Reset preserves accounts and linked/pending player IDs, clears
  their world progress, deletes unlinked guests and signs out account sessions.
  Unknown future schemas require a deliberate reset-retention update.
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

The first core deployment is implemented in docs/CORE_DEPLOYMENT.md, with the
9 October automatic orbital entry update in docs/ENTRY_AND_CAMPAIGNS.md. Guests
without a deployment automatically survey a core site. They cannot act as ground
units or block placement before landing; the server enforces this. The old helipad
artwork and placement reservation are removed. Keep the saved 57-tile cross
footprint, staggered unfolding and robot exit.
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

The first anti-air stage is in docs/ANTI_AIR.md: airborne-only predicted flak,
three fixed warned points, six-second reload and a global 12-round reservation
cap. Preserve permanent HE conquest and already launched attacks after tower
destruction. Aircraft damage, consumed impacts and pilot loss must checkpoint
atomically, including disconnected pilots. Bomber replacement takes 20 simulation
seconds at its original airbase; pilots use existing friendly-core recovery.
Keep free replacement until economy is agreed. Add encounters with backups and
safe placement; never reset a campaign for testing. Attack jets remain later work.

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
Anti-air and bomber damage/recovery now extend this loop in docs/ANTI_AIR.md.
Fuel, base damage, other warheads and carriers remain future stages.

The attack jet and unfolding naval dock stage is recorded in
`docs/ORBITAL_FORCE_DEPLOYMENT.md` (12 October). Preserve legacy bomber/dock
saves, one aircraft slot per base, ready/unoccupied exchange gates, saved arrival
timers and heading-owned HE strafing. New docks reserve the 3-by-1 shore, 3-by-5
water structure and adjacent berth before arrival. Do not relocate old docks.

The author approved completing the construction/economy pipeline on 12 October.
See docs/CONSTRUCTION_LOGISTICS.md and docs/ECONOMY_DESIGN.md. This supersedes older
free-deployment, global large-infrastructure and deferred-facility-HP statements.
Shared supplies start once per world, refill only during running simulation up to
a reserve threshold, and can exceed it through finite salvaged cargo shipments.
Keep cost/object insertion atomic; retain conquered IDs and depletion through
restart. No per-shot charge, offline income, duplicate join credit or friendly fire.
Large infrastructure needs one completed friendly core/factory's full-footprint
support. Existing unsupported equipment continues working. Independent entity caps
remain. Factory orders reserve space, cost less, take time and cannot be operated
until ready. Destroying a workshop cancels pending orders with a half refund.
Preserve emergency core/HE-tank recovery, living/offline identities after core loss,
completed flooring, cargo crates and once-only launch credit. Dock/base destruction
must not silently delete ships at sea or freeze airborne planes, including during
repair. Ground claws and acid can damage facilities through numeric armor; do not
claim every enemy weapon was extended. Rails and terrain have no HP in this stage.
Provisional prices/timers live in public/logistics.js; document balance changes.
Migration backs up populated saves and never retroactively charges owned equipment.
Local checks do not establish deployed behavior or four-player Fly capacity.

The 12 October recycler-driving refinement is in docs/CONSTRUCTION_LOGISTICS.md.
Preserve the refined UI/keymap/catalogue. E boards/exits one saved recycler seat;
WASD drives, parking collects/unloads, L opens shipment controls. Remote commands
require an empty seat. Never render or damage a second robot inside the recycler.
Loss disables its driver and drops only unshipped cargo. New ground corpses have
bounded saved salvage; depletion and enemy death share campaign checkpoints.

The subsequent 12 October bridge-builder stage is in docs/BRIDGE_BUILDER.md.
Preserve three-wide straight crossings: two cables between 3-by-1 bank anchors,
then saved 1-by-3 deck steps. Admit and charge atomically; retry without double
spending. Lock the builder and reserve the entire span until completion. New decks
are traffic-only and block ships; old causeways/rails remain unchanged. Derive
walkable floor from completed bridge records without rewriting terrain. Builder
loss cancels unfinished spans without refund, retaining completed bridges. Bridge
HP, dismantling and armored vehicle transport remain separate future stages.

The author then approved completing the transport stage and pushing the pipeline.
See docs/ARMORED_TRANSPORT.md, which supersedes the transport deferral above.
Keep one unoccupied ground vehicle in a saved ship cargo slot, removed from the
active world atomically. Retain ownership/caps, health, loadout and salvage. Check
nearby ground routes at both transfers, reject remote loading of occupied vehicles and lock working
builders. Loading requires management permission; unloading retains ownership.
Sink cargo with its ship, preserve normal tank replacement, and reject loaded
recall. The transport has one bow turret; never change gunship mount counts.

13 October local correction: ship replacement reuses its existing dock and checks
only the water berth, rather than revalidating initial dock placement against
people on the shore. Preserve repair/cooldown/cost gates and saved berth identity.
E selects the nearest enabled interaction. The author clarified that completed
3 x 5 offshore docks must be walkable and vehicles can drive aboard directly.
Driving toward the marked ramp transfers the driver to the helm atomically;
K drives cargo off directly into vehicle controls. Preserve a single seat and
vehicle record across restart, ownership, blocked exits and builder locks.
Retain completed deck flooring during hull replacement and dock damage; require
a clear offshore deck before recall. See docs/ARMORED_TRANSPORT.md.

The next 13 October stage is in docs/CONSTRUCTION_AND_SHIPYARDS.md. The author
confirmed cosmetic construction drones and reusable permanent shipyards separate
from retractable shore ramps. Stage 1 adds client-only capsule/assembly feedback
for logistics buildings and utility vehicles using existing saved countdowns.
Naval cards expose manage/rebuild actions instead of disabling owned vessels.
Preserve server admission, prices, caps and atomic replacement; never infer
readiness from animation time. The author then approved implementing and deploying the remaining batch. Independent
shipyards, bounded cosmetic wrecks and the ramp sentry are implemented in that
brief. Preserve legacy dock geometry and backups, one assigned hull per yard,
existing fleet caps, paid idempotent admission and interruption during dock loss.
Folding cannot restore sentry HP or reload; repair requires a paid dock service.
All pricing remains provisional. No individual worker simulation is authorized.

The subsequent 13 October dock-first refinement supersedes the per-type naval cap
and menu above: one assigned vessel per dock, four active ships per campaign, with
same-type ships allowed at different docks. E on an owned dock opens the unified
shipyard panel. Retiring with keepYard preserves occupied deck flooring; deleting
the yard still requires clear deck/berth access. Paid automatic dock hull repairs
and their supply charge checkpoint together; pause/offline cannot advance them.
See docs/CONSTRUCTION_AND_SHIPYARDS.md for provisional rates and admission gates.
The 14 October design record is docs/BOMBER_AND_SUPPORT_NETWORK.md. The requested
direction adds automatic bomber sorties, HP-based paid aircraft repair, global
orbital delivery, cheaper/slower local construction and core salvage receivers.
This is a design record, not authorization for the whole network implementation.
Confirmed: one free bomber to an existing airbase per campaign, and a 2-by-2
support outpost with receiver and robot respawn. The author requests cheaper local
recycling and reusable cargo rockets with a provisional two-minute cooldown and
return animation. The author confirmed separate campaign-shared ground supplies
(local processing; local construction/repair) and orbital supplies (rocket delivery;
orbital deployment). Current runtime still uses one SUP pool. Define initial balances,
passive income and migration without duplicating old supplies; preserve refund currency.
Define shipment credit, cooldown persistence and station
loss before implementation. Preserve actual flight/anti-air, shared spending,
emergency recovery and once-only salvage. Current runtime prices/gates still apply.

The author reported Brevo reactivation on 13 October; deployed SMTP/TLS/authentication
verification succeeded without sending mail. This does not establish inbox delivery.

The author subsequently authorized the economy/support implementation before bomber
automation. docs/SUPPORT_NETWORK_STAGE.md supersedes the design-only status above.
Both budgets are campaign-wide, shared by every core and teammate. Preserve the
old supplies field as orbital SUP; v1 migration backs up and adds groundSupplies=0
without duplicating money. Local processing earns ground SUP; rocket delivery earns
orbital SUP once, with a saved 120-second return cycle. Local construction takes
60 seconds at 25% cost in ground SUP; global orbital site rules still enforce
terrain, footprint and capacity. Completed 2-by-2 outposts add shared respawn and
construction support. Cosmetic drone stores stay inside reserved footprints.
Preserve existing native pod geometry, emergency recovery, refund currency and
shipment cargo conservation; no worker agents or electricity simulation.

Automatic HE bomber missions are implemented locally in docs/AUTOMATIC_BOMBER.md.
The author confirmed abort/return on home-base loss, then emergency landing and a
replacement wreck if the base is unavailable. Preserve the real flight/flak rules,
one shared mission per aircraft, fixed accepted target, caller body, no duplicate
release across named-campaign restart, and bounded failure recovery.
The 16 October payload stage in docs/AUTOMATIC_BOMBER.md adds heavy HE,
incendiary and gas carpets, plus an automatic pre-release dive. Preserve distinct
damage/crater sizes, a full-load cost for heavy HE, shared hazard reservations,
fixed accepted payloads and departed-pilot recovery. Bomber strafing is excluded;
the existing attack jet is unchanged. Aircraft/base separation remains future work.

The 16 October shared-airfield stage is in docs/AIR_TRAFFIC.md. Cruise is an
explicit persisted unmanned order; E boards parked aircraft. A bomber dispatched
from cruise resumes holding even with empty bays, until recalled. Aircraft may
land at any free friendly airbase. Preserve stable saved aircraft identities,
movable destination tags, exclusive runway reservations and shared fleet counts
including aircraft in flight/delivery. Empty airbases are permitted; one owner may
place multiple bases within the existing four-base campaign cap. Production stays
locked when base loss leaves surviving aircraft above operational capacity. This
supersedes fixed home-airbase parking; carriers remain a subsequent stage.

The 17 October carrier stage is implemented locally in docs/AIRCRAFT_CARRIER.md.
A carrier is one fleet slot and one physical runway with stationary operations;
parked aircraft move with it, and incoming recovery locks helm movement. Preserve
stable aircraft identities across land/carrier transfers and carrier rebuilds.
Sinking destroys deck aircraft but diverts airborne aircraft where possible.
The carrier has side guns only, including unmanned swimmer defence. Its bounded
onboard GND store transfers supplies from the shared pool at docks and pays for
stationary hull/deck-aircraft repairs. Rebuilding never restores free supplies.
Local checks do not establish deployed performance or large-fleet capacity.

The 17 October orbital roster and staged implementation are recorded in
docs/ORBITAL_STRIKES.md. Walking HE is the first local stage: V opens targeting,
120 ORB commits five rows of three impacts to one shared orbital weapon.
Preserve fixed previewed points, monotonic request sequences, single payment,
saved landed flags and pause/offline semantics. Target damage and strike progress
checkpoint together in named campaigns; friendly immunity stays intact. Fire
curtain, gas seeding and an optional cutting beam remain future stages. Orbital
ship delivery/resupply is separately recorded, not implemented by this stage.

The subsequent orbital payload stage completes the same planner with an
incendiary curtain, gas seeding and a cutting beam. docs/ORBITAL_STRIKES.md records
their provisional values and supersedes the payload deferral above. Preserve
land-only fire/gas footprints, shared hazard reservations, finite gas capacity,
saved payload profiles and remaining fire lifetimes. Orbital hazard fields have
one canonical copy in logistics, excluded from the combat checkpoint to prevent
duplicates. Beam damage follows its moving ground contact and can conquer hostile
facilities; the sky ray and bounded scars are cosmetic. All payloads share ORB,
the one-order slot, recovery and friendly immunity. Local tests do not establish
Fly performance; orbital ship delivery/resupply remains separate future work.

The 17 October bridge correction in docs/BRIDGE_BUILDER.md permits mixed clear
land/water deck spans so anchors can sit inland of uneven shores. Require some
water, clear full-width land anchors and approaches, and retain obstacle/unit
checks. The 24-row limit, GND price and construction timer count every interior
deck row, including land. Preserve existing bridge saves, traffic reservations
and cable/roller animation; no terrain rewrite or diagonal bridges.

The next bridge refinement defaults to Find shore ahead: cardinal facing/menu
direction, bounded nearby corridor search, full preview and explicit confirmation.
Manual endpoints remain optional. Survey at most three tiles laterally, keep the
near anchor within four tiles, and stop at the first suitable opposite shore.
Send exact preview endpoints through existing server admission; do not silently
replace an invalidated route or spend before confirmation. See docs/BRIDGE_BUILDER.md.

The author clarified orbital cargo in docs/ORBITAL_CARGO_PRESENTATION.md: finished
equipment arrives in a metal crate, unfolds, then deploys in one second. New
compact cargo timers are 3.6 seconds; preserve saved countdowns and native pod
geometry/timing. Never draw construction drones for orbital cargo. Local builds
and repairs retain workers and their existing timers. Bridge funding remains
shared GND only; show both balances, shortfall and core/outpost unloading advice
instead of implying ORB or onboard carrier stores can pay for a crossing.

### Planet terrain and overview, 18 October 2026

The approved first stage is implemented locally in docs/PLANET_EXPANSION.md:
512 by 384 saved terrain with a camera-only campaign globe (N), plus the existing
flat tactical overview (M). Preserve all old coordinates and back up the complete
DB before atomically remapping terrain and flattened logistics floor indices.
No spherical travel or extra enemy/facility caps. New regions are expansion space,
not a claim of a populated planet or validated Fly capacity. First orbital strike
reference remains stable; strike planning uses a readable regional camera.
