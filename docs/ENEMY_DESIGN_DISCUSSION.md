# Enemy and planet design discussion

## 31 October 2026: siege centipede implemented locally

The author approved the first giant as a long, slow, armored ground nursery
that prioritizes facilities. It emerges only from a living Blight Root, produces
bounded existing land enemies and shares all population/pressure limits. Its
eight parts form one hittable enemy; the tail is not merely decorative. Root
destruction ends its production and replacements while survivors remain.
The [centipede stage](BROOD_CENTIPEDE.md) records initial stats, saved behavior,
geometry, source lifecycle and local checks. Burrowing and universal armor
changes remain outside this implementation; author balance refinement follows.

## 31 October 2026: air domain and mobile AA implemented

The paired roster extension is now implemented locally: a winged skimmer and a
tracked twin-35 mm AA. The author's revised AA fires on the move and uses a
separate assisted turret solution without moving the cursor. The skimmer threatens
robots and ground vehicles, with a fixed visible warning and no facility damage.
It shares city production and enemy budgets; oceans and air-to-air combat remain
later scope. Details and checks: [Mobile AA and skimmer](MOBILE_AA_AND_SKIMMER.md).

## 30 October 2026: sustained assaults and a peaceful end state

The author's new direction is intense close-range fighting in hostile territory,
with dense alien cities continually producing defenders until their hostile
facilities are destroyed. Cleared ground has sparse roaming threats centered on
active players, with weaker attraction to nearby friendly facilities. Defeat and
recovery should encourage stronger equipment and coordinated assaults. Ships and
aircraft retain their distinct advantages. The author explicitly selected:
**after every hostile facility is destroyed, stop new spawns and clear remaining
survivors**. The first behavior/ending stage below is implemented locally; the
pressure changes remain design work; the new layout stage is recorded below.

### Four starting clearings and dense layouts: subsequent implemented stage

The author next requested four empty areas to choose from on every planet, with
dense enemy facilities elsewhere to suit the powerful weapons. New named Caldera
and Vesper campaigns now save four shared recommended starting areas. Each has a
12-tile-radius clear land reserve and a legal core anchor; hostile facility
centers stay at least 42 tiles from its center. These are initial clearings, not
permanent protection: later enemies can approach and warned events still apply.
Teammates may share a region and choose adjacent clear ground, or land separately.
The ordinary global placement rules still validate each drop.

The orbital placement panel now lists the four choices and keeps an explicit
Confirm orbital drop action. Browsing only moves the camera and preview. Planet
overview also lists the clearings and marks them with numbered green rings.
The phone sheet keeps its confirmation button visible. Existing saves lacking
the new metadata retain their prior placement interface.

New cities use seeded groups of three to five existing structures: sensory
crowns, bile mortars, blight roots, lance towers, spore flak and contaminators.
The generator aims for at most 48 new compounds across usable land, with
26-tile spacing between group centers and at least eight tiles between facility
positions. Clear two-tile collars preserve movement around each structure.
Terrain constraints can reduce the count, especially on Vesper. Its lakes,
rivers, mountain passes and aquatic hive remain; no terrain is flattened for
cities. Only sparse rocks inside the four new reserves are cleared at creation.

Each new compound starts with one finite four-enemy roster shared by its members.
The existing director replenishes surviving hostile compounds and still shares
the 24-active/reserved-enemy limit. This stage changes layout density, not spawn
cadence, enemy HP or damage. Island scaling and the sparse roaming arrival layer
remain the next functional stage. Full planetary conquest still requires every
saved objective and then stops new spawns permanently.

The saved `frontier-layout-v1` manifest and combat checkpoint commit together.
Legacy density migration markers are marked superseded for new layouts. Missing
compatibility markers are restored from the saved manifest without adding cities.
Existing campaigns never receive this layout on reopen; old migrations retain
their own tests. Automated checks cover both planet geometries, deterministic
layouts, clear core anchors, separation, objective membership, shared choices,
explicit deployment, restart and untouched legacy saves. Test worlds are disposable.

The local density probe generated three actual authored-plus-seeded layouts per
planet: Caldera had 43-48 new compounds and 175-195 total facilities; Vesper had
32-37 compounds and 131-147 facilities, including its aquatic hive. With 24 ground
enemies and four players across four compounds, 100 warmup and 300 measured ticks,
mean combat time was 1.706-2.170 ms on Caldera and 1.149-1.360 ms on Vesper. The
highest p95 was 3.555 ms and the worst tick 7.282 ms. Combat JSON was 92-135 KB.
These local i9 measurements include active hostile facilities but exclude full
server/network/rendering and player weapon load; they do not establish Fly
capacity. Raw scripts/results are in ignored `.local/frontier-density-probe*`.

Validation for this stage: `pnpm check` passed typechecking and all 927 tests
across 118 files. Eight distinct desktop/phone browser cases passed across the
landing-area, legacy orbital-entry, planet-overview and seeded-front suites.
The legacy orbital-entry test now checks the intended Escape-close/Recenter-open
flow; its desktop case hit one deployment timing timeout and passed unchanged
on rerun. Screenshots were inspected for phone placement and desktop overview.
Localhost serves the updated build; this stage has not been deployed to Fly.

### First behavior and ending stage details

- Existing ground defenders choose seeded patrol destinations within five tiles
  of their home/rally point, pause between legs and move at 55% patrol speed.
  Routes stay within six tiles; blocked routes back off. Patrol state survives
  checkpoint/restart, without replacing or healing enemies.
- Ordinary ground acquisition needs a clear ray to the target surface. Rocks,
  Vesper mountains and solid structures block sight. New contacts are checked
  every 250 ms, with at most 12 candidates; held contacts lose sight immediately.
  Enemies acquire players within ten tiles, retain visible contacts within 14,
  then investigate their last observed position for four seconds. Existing fresh
  scanner reports, fire avoidance, lure rules and warned attacks are retained.
- Robots and occupied ground vehicles are preferred. Nearby infrastructure has
  six-tile acquisition/eight-tile retention, with up to one quarter of ordinary
  ground enemies selected from heavy units to prioritize siege targets. Others
  can still attack nearby equipment when no visible player is available. This is
  a priority quota, not a hard cap on all enemies attacking a facility.
- Natural/manual raid dispatch supplies a fixed investigation destination, not
  an unseen player's continuously updated position. Local detection still works
  during the event. The shared navigator keeps its 1,024-expansion tick budget.
- A saved additive objective roster includes standalone and compound members.
  Every required record must exist and be conquered; empty/missing lists never
  declare victory. Final conquest blocks site production, natural events, aquatic
  production and manual drill/contact spawning. Unborn arrivals are cancelled;
  living/sleeping survivors keep their identity/HP, and committed attacks resolve.
  Ruined scanner cleanup and survivor combat continue after production stops.
  Losing a previously active test-drill beacon after conquest does not erase
  its surviving units; ordinary pre-conquest drill cleanup is unchanged.
- The server publishes one authoritative completion state and a one-time
  `planet.conquered` event. A narrow gold striped **CONQUERED** ribbon appears
  above the HUD, counts survivors and changes to **All threats cleared** at zero.
  It persists across reload/restart and leaves normal play available.

This applies through the shared combat implementation on both planets. It does
not yet add the new sparse roaming population, increase spawn rates, implement
the per-island multiplier, relocate saved cities or introduce a flying enemy.

Validation covers visibility and lost contact, occupied utility vehicles,
bounded/reproducible patrols, unreachable paths, final-facility destruction during
queued arrivals, aquatic production, living/sleeping survivor persistence and
already-accepted projectiles. Desktop/phone browser checks exercise shared
completion, reload and actual server restart using isolated saves.

Recorded checks: the full `pnpm check` passed 918 tests in 116 files. Final review
then added the post-conquest drill-loss regression; all 33 focused conquest,
combat, scanner, survival, robot and checkpoint checks passed, and typecheck was
rerun successfully. Nine distinct browser cases passed across the final runs:
planet conquest, alert-station conquest, settlement and frenzy on desktop/phone,
plus natural encounters. The older conquest/checklist fixtures now isolate
structure damage from live defender pressure and use current navigation;
production enemy strength was not weakened to make those tests pass.

A local timing probe used 24 existing enemies on synthetic 512-by-384 open,
water-barrier and dense-rock fields with one/four players, 100 warmup ticks and
300 measured ticks across three repeats. On an i9-14900K/Node 26.5.1, the slowest
case averaged 0.696-0.749 ms/tick (p95 1.234-1.254 ms, worst tick 2.146 ms).
Post-GC heap change ranged from -1.047 to +0.227 MiB; temporary pre-GC growth
reached 53.714 MiB. These short isolated combat measurements exclude networking,
rendering and weapon load; they establish neither Fly capacity nor leak freedom.
Probe artifacts remain in ignored `.local/ai-stage-timing*`.

The intended loop is: scout a defended area, meet resistance, bring suitable
firepower and support, disable its production/defenses, then keep the conquered
ground as durable progress. A robot can scout, evade and support an assault;
heavy weapons make taking a defended city substantially more effective. Repeated
unavoidable deaths or attacks on the recovery point are not the intended lesson.

### Pressure and targeting

The pressure slice is now implemented locally. The current numbers, warning
rules, shared admission budget and evidence superseding the proposals below are
in [Island pressure stage](ISLAND_PRESSURE_STAGE.md). Existing worlds retain
their saved geometry and facility roster.

| Context | Proposed experience | What reduces or ends it |
| --- | --- | --- |
| Hostile city approach/interior | Patrols, a defended perimeter and sustained warned reinforcements. Existing hunters, breakers and Bulwarks fill different roles. | Destroying production and defense facilities progressively weakens that city. All required structures must be destroyed to finish its objective. |
| Cleared land while the planet remains contested | Small, infrequent roaming groups around active player groups, with genuine quiet intervals for construction and travel. Strong warned raid events remain a separate, occasional escalation. | Permanent local conquest reduces ordinary pressure; planet-wide conquest ends new arrivals completely. |
| No eligible players nearby | No new ambient population for an empty island and no banked spawn backlog. | Existing survivors and already-fired attacks retain their state. |
| All hostile facilities destroyed | No further production, ambient arrivals or natural raid spawns. Existing enemies can still fight and be cleared. | Clearing surviving enemies, including sleeping survivors, leaves peaceful play. |

Spawn focus and enemy knowledge are separate. The director uses active players
to choose where a playable encounter belongs. Individual enemies still need
local detection or a valid observed report to pursue; they do not receive an
unlimited live player position through walls. Patrol -> detect -> pursue ->
investigate last contact -> return/patrol gives the player a readable way to
evade or disengage. Keep existing attack warnings, fire avoidance and lure rules.

Most ordinary enemies should choose detected robots or occupied ground vehicles.
Facilities have weaker, local attraction: a limited siege group can threaten a
nearby base, rather than every enemy abandoning the player to cross the map.
Breakers/Bulwarks may retain that siege role within an explicit quota. Groups of
cheap structures must not multiply attraction or enemy production. Protected
recovery cores remain ineligible targets. Invalid/unreachable targets expire;
mountains, water, vehicles and armor eligibility still matter.

Ships and aircraft should reward preparation and positioning. Ordinary land
melee units do not gain the ability to hit flying aircraft or submerged boats.
Existing AA/aquatic threats keep their explicit eligibility; the later flying
enemy plus AA vehicle stage can extend those battles. Do not turn aircraft
passengers into phantom ground targets or spawn land attackers in inland water.

### Density, multiplayer and completion

Build intensity through sustained arrivals, coordinated approaches and useful
enemy roles before raising population or every enemy's HP/damage. The current
shared active-plus-reserved limit of 24 is the first implementation budget, not
a claim that it already delivers the desired city battle. Measure active
combat before proposing a higher limit. Hostile defense, ambient roaming,
natural raids and aquatic arrivals must compete fairly for the same capacity;
adding independent full quotas for each would bypass the budget.

Apply the previously approved island arrival-rate multiplier once:
`1 + 0.7 * (eligible connected players - 1)` (1 / 1.7 / 2.4 / 3.1).
Deduplicate accounts/tabs and group nearby players for spawn focus. Two separated
groups on one landmass share that island's budget; four players do not multiply
every nest, wave size, event frequency and HP independently. No new ambient
arrivals when an island has no eligible players. Keep geographic identity stable
across bridge construction and Vesper's rivers/mountain chains.

City production must be readable and tied to surviving hostile sources. Destroying
a source stops its production, and conquered sites never become sources for the
new roaming layer. For planetary completion, check the complete saved objective
roster and each required member; an empty array or missing structure is not a
victory. On confirmed completion, cancel not-yet-created enemy arrivals and
release their reservations, close future raid scheduling and stop every spawn
path, including aquatic production. Existing living/sleeping enemies retain
identity and HP; already-fired projectiles and accepted player attacks resolve.
Reload/restart must preserve this terminal spawning state. Survivor cleanup
does not undo the permanent conquest result.

Denser city layouts should be introduced in new campaigns or deliberately
authored future sectors, without moving existing saved facilities or regenerating
terrain. Use several connected production/defense clusters with usable approaches
and gaps, not one packed rectangle: the existing large bombs would erase that
with a single blast. Every destroyed component should provide noticeable relief.

### Proposed playable sequence

1. **Behavior and ending:** bounded patrols, visibility/detection, pursuit,
   investigation and return; player-focused priorities with limited local siege;
   the final-conquest spawn gate. Keep current terrain and the existing roster.
2. **Pressure director:** separate hostile-city pressure and sparse cleared-land
   roaming, integrate warned events and the per-island multiplayer rate, then
   tune against solo and cooperative assaults. Reuse the same AI on Caldera and
   Vesper; do not create a second independent Vesper simulation.
3. **City layout and resistance:** denser new-world compounds with separated
   production clusters; playtest robot/tank approaches and ship/air support before
   raising the measured population budget.
4. **Aerial attacker and AA vehicle:** the paired next roster extension from the
   readiness plan. Giant enemies and another planet remain later proposals.

Acceptance should demonstrate quiet cleared-ground travel, dangerous but escapable
hostile approaches, progressively weaker production as structures fall, recoverable
death, two players together/apart, four-player budget fairness, no duplicate-tab
scaling, Vesper mountain/water constraints, and restart during a warning. Destroy
the final required facility during each arrival path and verify no new enemy is
created, while survivors and accepted projectiles remain. Document actual tick,
memory and client propagation costs; local checks alone do not prove Fly capacity.

Pre-implementation review: `public/land-ai.js` had distance-based acquisition/retention
and short contact memory, but no ordinary wandering patrol or general visibility
acquisition. `public/encounter-director.js` already replenishes hostile compounds
(six defenders per compound, two replacements roughly every 20–35 seconds after
the opening roster) and schedules player-context natural raids. Those natural
raids are not yet stopped by full planetary conquest. Ordinary heavy enemies
prefer vehicles/facilities; the existing frenzy has a limited facility-raider
quota. The proposed island multiplier and sparse ambient patrol layer are not
implemented. Both named planets already share the combat/director code.

The dated sections below retain their earlier context; this direction supersedes
older conflicting recommendations about pressure sources and post-conquest arrivals.

9 October 2026. Based on the author's first four answers in
[the worksheet](../GAME_DESIGN_WORKSHEET.md). These are design inputs and
recommendations; the first alert station is now implemented as recorded in
[CONQUEST_STAGE.md](CONQUEST_STAGE.md). The 11 October
[mortar outpost](MORTAR_OUTPOST.md) and
[environment modifier](ENVIRONMENT_MODIFIER.md) are also implemented locally.
A first [small settlement](ALIEN_SETTLEMENT.md) now groups those three structures
into a permanent 3/3 objective. Larger cities and the remaining mobile roster
are future work.
Permanent conquest and global
deployment remain the agreed boundaries in [GAME_DESIGN.md](../GAME_DESIGN.md).

10 October follow-up: [DETECTION_AND_ALARMS.md](DETECTION_AND_ALARMS.md) records
the author's search pulse, focused tracking fan, detected status, burrowing
reinforcements and nearby sensing/noise proposals. These refine the discussion
below. The first scanner/mark/investigation stage is implemented locally; general
neighbor sharing and noise remain future work. The author confirmed that tracking stops
circular search, marks fade after lost lock, and solid obstacles block the tracking
beam. Noise propagation limits and detailed tuning remain proposed.

## The requested experience

Choose a landing location using orbital intelligence, approach hostile regions,
fight guards, bring HE artillery to destroy alien structures, and permanently
clear their contribution to the map. Sparse patrols create pressure between
objectives. Alert stations alone call repeated reinforcements.

| Requested site | Function | Still to decide |
| --- | --- | --- |
| Environment modifier | Biological structure with a fixed patch of alien terrain | First version implemented: HE destruction clears the cosmetic coating over six simulation seconds; movement is unchanged. |
| Outpost | Biological mortar firing corrosive shells | First 3×3 version implemented; see MORTAR_OUTPOST.md for warnings, damage and remaining scope |
| Alert station | Detects players and calls reinforcements at intervals while active | Implemented with fading contact memory; see DETECTION_AND_ALARMS.md |
| Air contaminator | Conceals units and attack warnings beneath a large cloud | First HE-only version implemented locally; see AIR_CONTAMINATOR.md. Long-range aiming remains visible. |
| Lance tower | Punishes sustained beam exposure; slow traverse and cover allow escape | First ground-only version implemented locally; see LASER_TOWER.md for charge, cooldown, damage and retained tracking. |
| City | Large settlement containing living areas and small outposts | First small compound implemented: crown + mortar + root, all required. Larger cities and living-area art remain future work. |

11 October follow-up: Blight roots could supply visible hatching vents for
crown-requested reinforcements; this remains a proposal. After the contaminator,
the author authorized the separate lance tower: eight-tile acquisition,
40-tile retained tracking, two-second beams and five-second cooldown. Damage
depends on actual beam exposure; solid cover blocks it. This does not change
current spawning or enable anti-air weapons.

Initial guards and occasional patrols are distinct from alarm reinforcements.
The earlier generic spawning-nest recommendation needs revision to respect this
distinction; do not let every site call reinforcements by default. Patrol sources
and behavior after nearby conquest are still open. They must not recreate
conquered sites or restore their hostile overlays.

The author requests HE cannons to destroy hostile facilities, excluding the
robot's weapons. Decide which HE delivery platforms qualify and how a solo
player obtains one before the first objective; avoid a progression deadlock.
This is a weapon eligibility rule, distinct from enemy penetration against
friendly armor. It does not yet settle incendiary/gas damage to structures.

## Proposed behavior: a small shared framework

`patrol/guard -> detect -> pursue -> wind up -> attack -> pursue`

Lose the target beyond a bounded pursuit distance or timeout, then return to an
unconquered home site. Without a valid home, patrol a bounded local area. Use
different acquisition and disengagement thresholds to avoid constant switching
at the boundary. Reacquisition must not circumvent the home/pursuit limit.

- Hunter: fast robot pressure, short readable melee windup, low durability.
- Breaker: slower approach, clear heavy strike, penetration sufficient to threaten
  selected vehicles/facilities. Exact targets and values wait for armor decisions.
- Spitter: ranged projectile with a visible travel/impact warning. Direct damage
  and splash can have separate profiles; explicitly decide whether the primary
  target receives both rather than accidentally applying damage twice.

These are role proposals, not three mandatory additions to the next stage.
Use bounded target searches and shared encounter populations. A second player
should not duplicate a site's defenders. Disengaging does not heal enemies,
reset objective damage, undo conquest or erase an accepted distant strike.

**Behavior question:** "attack without fear" can mean no ordinary morale retreat,
while retaining current fire avoidance and burning panic. That is the recommended
interpretation, but replacing either existing response requires a decision.
Keep gas attraction and fire avoidance priorities explicit.

**Armor question:** the new worksheet asks for mitigated damage across robots,
tanks, ships and facilities. The earlier agreed plan is a facility-only binary
penetration threshold. Those differ. Retain the earlier plan pending discussion;
do not silently install a damage-reduction formula or extend it to every unit.

## Spawning and the orbital map

Use world-space distances for detection, encounter activation and pursuit.
Screen resolution and zoom affect presentation, not spawn rate, damage or enemy
awareness. Avoid enemies appearing immediately beside players: choose bounded
spawn zones/routes, check all nearby players and use readable arrival cues.
"Outside the view" cannot be literal for an orbital overview that sees the whole
region; it should mean outside the local combat observation area or an explicit
reinforcement arrival. A camera zoom must not suppress all reinforcements.

Generate or activate a site's guards once through shared server state, rather
than independently each time someone lands. Landing safety, partial encounter
persistence and patrol replacement rules still need a small stage specification.

A draggable globe can be a later overview presentation of the same planet data;
it does not require spherical local combat physics. First demonstrate a flat
territory overview. Before a true wrapped planet, settle coordinate seams and
travel boundaries. Keep local battles in the agreed overhead 2D projection.

The author suggests red area size for occupied extent and darkness for enemy
numbers. Recommend darkness mean **estimated resistance**, derived from site
configuration, so dormant regions do not require a live population simulation.
If actual live counts are wanted, label when intelligence was observed and keep
live unit markers separate from permanent conquest. Overlapping site overlays
must not hide an unconquered site when its neighbor is destroyed.

## Proposed art direction for discussion

Use a shared biological family: red/rust chitin, dark joints, purple hit effects,
and distinct silhouettes. Hunters are low and narrow; breakers broad and plated;
spitters carry a visible projectile sac. Living structures can share those shapes
while staying rooted in place. Two heads remain an optional motif, not a rule for
every unit. Keep blood stylized and combat readable at the usual zoom.

Make the environment modifier a rooted growth, the mortar an arched launcher,
the alert station a tall sensory crown, and the city a cluster of related forms.
Alarm pulses, attack windups and impact shapes communicate roles beyond color.
Use temporary silhouettes first; approve one moving enemy and one structure at
game scale before producing the whole sprite set. No asset generation is required
to settle the rules, and no new final art is selected by this document.

## Recommended first encounter

[CONQUEST_STAGE.md](CONQUEST_STAGE.md) now records the locally implemented first
alert-station encounter, biological art pass, persistence and bounded calls.
It supersedes the earlier recommendations below for that one encounter; the
remaining enemy/facility roster and final artwork are still proposals.

One alert station with initial hunters, one bounded reinforcement group and an
existing HE platform. Destroying the station stops its calls permanently. Proposed
first-site completion is station destruction; decide what surviving guards do.
Verify shared completion and saved return before adding cities. The separate
facility-durability stage can then introduce one breaker/sentry pair once the
armor rule is settled. Account work can proceed as its own stage while these
enemy and art questions remain open.
