# Enemy and planet design discussion

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
