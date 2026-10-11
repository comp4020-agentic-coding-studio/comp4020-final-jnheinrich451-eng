# First conquest: alien alert station

9 October 2026. **First alert station implemented locally.** The author requested
building the suggested station with mildly unpleasant biological visuals. This
stage uses the recommended completion, alarm and HE rules described below;
those implementation defaults were stated before work began. Other facilities
remain proposed. No Fly deployment was made in this stage.

## Current playable version

10 October follow-up: the original presence-radius alarm below is superseded by
the [scanner stage](DETECTION_AND_ALARMS.md): pulse search, focused tracking,
fading marks and bounded defender investigation. HE/conquest and population
rules remain; this document records the first objective milestone.

Open a named campaign and use the map controls' flag button, **Locate alert
station**, to inspect the Sensory crown on the eastern continent. Legacy shared
field tests remain separate and do not gain this encounter. A new participant
still lands their own core; the station does not grant equipment or resources.

- One 3×3 hostile station, 420 HP, with an 11-tile red objective region.
- Initial guards activate once within 18 tiles (or when attacked), with visible
  2.2-second arrival warnings. Three initial defenders share one site record.
- Detection within 12 tiles, or an impact on the station, starts a 4-second alert
  grace. Calls occur at 12-second intervals while alerted, two defenders per call,
  capped at eight living site defenders and 24 total enemies. Initial values are
  tuning defaults, not final balance. Guard arrival can retry without duplicating
  already spawned guards. Calls defer when no safe arrival point is available.
- Destroy the station using HE from tanks, artillery, missiles (including naval
  missiles), ship main guns or bomber bombs. Other weapons stop against its solid
  core without structural damage; **USE HE** feedback explains ineffective hits.
- Destruction conquers immediately and permanently cancels calls. Surviving
  defenders remain, retain ordinary fire/gas responses, and cannot recapture.
  Site defenders return toward their local home position beyond their 20-tile
  pursuit bound. They never damage the unrelated drill beacon.
- Movement and all ground deployment footprints respect the intact core. Ruins
  are walkable/buildable. Conquest removes this site's red contribution and keeps
  a labelled marker on the world and minimap; no resource reward is introduced.

The client draws chitin plates, swollen purple sacs, a central slit, small pores,
and slowly twitching tendrils. Alarm pulses, cracks and the flattened ruin identify
states. This is a first procedural art pass; animation respects reduced motion
and room pause. There is no graphic gore or new sound asset.

Named-campaign combat checkpoints now include `sites` as an additive field.
Existing saves get a `before-conquest-*.sqlite` backup before a clear-site search;
terrain and equipment remain intact. If no valid site exists, retain an empty
site list rather than overwriting a base. That unusual crowded-save case needs
operator/design follow-up, not an automatic world reset. Station damage and
conquest checkpoint before broadcast; other encounter state follows the existing
500 ms checkpoint window and explicit room closure. No offline wave catch-up.

## Experience and scope

See a hostile region from orbit, land and prepare equipment, approach its alert
station, fight defenders, bombard the station and retain a visible victory after
leaving and returning. Solo players can deploy the necessary equipment using
today's free deployment. Teammates can divide defense and bombardment tasks.

Build one station first on the existing Caldera map. One enemy facility and a
small group of existing ground enemies are enough to test the complete loop.
Do not add a whole city, new enemy roster or larger map in this first stage.
Economy stays deferred under [ECONOMY_DESIGN.md](ECONOMY_DESIGN.md).

## Proposed visual vocabulary

Keep the existing pure overhead 2D projection, square footprints and readable
unit scale. Aim for a grounded military scene using simplified, strongly separated
shapes: human metal panels and geometric machines versus rooted alien biology.
Match outline weight, shadow direction and texture detail to the current game.

Alien structures share rust-red chitin, dark joints, muted purple inner tissue
and restrained purple damage effects. Avoid making the entire structure glow;
reserve a bright pulse for an active alarm or an attack warning. Shape and motion
must distinguish roles without depending on red/green recognition.

| Facility from the worksheet | Distinct overhead shape | Purpose | Stage |
| --- | --- | --- | --- |
| Alert station | Radial sensory crown, spreading roots, central pulsing organ | Detect intrusion and call reinforcements | First |
| Corrosive-mortar outpost | Curved launcher with a pronounced firing opening and swollen reservoir | Force movement with warned indirect attacks | Later |
| Environment modifier | Rooted central growth with branching veins | Visibly alter nearby terrain appearance | Later; restoration rule open |
| City | A cluster of related structures with recognizable defenses and paths | Combine objectives into a larger assault | Later; completion rule open |

The station uses a 3×3 tile solid core with non-colliding decorative roots.
Prepare intact, alarm-active, damaged and ruined appearances using the same base
shape. Destruction leaves a flattened remnant and a clear conquered marker.
The region overlay is larger than the footprint; it is neither collision nor
weapon radius. A labelled station icon remains readable in orbital view.

Use the first code-drawn silhouette to test scale, combat and state feedback.
Review one station and one moving defender in the actual battlefield before
producing a larger sprite set. Final textures and sound can follow the playable
encounter. Other facilities' art remains proposed; this is not final artwork.

## Rules used for this first version

1. **Completion and survivors.** Destruction of the station completes
   its objective immediately. Surviving defenders remain dangerous, with their
   own markers; they cannot restore the station or its hostile overlay.
2. **Alarm persistence.** Periodic calls only while a player remains
   within the detection area or the station is under attack, with a short bounded
   alert grace period, population caps and readable arrival warnings.
3. **Eligible weapons.** All HE delivery platforms: tank, rail artillery,
   missiles, gunship and bomber. Robot weapons handle defenders. Incendiary/gas structure
   damage is not implicitly added; settle any exception explicitly.

Starting HP, guard count, reinforcement interval, detection distance and population
cap are tunable implementation values listed above. Only alert
stations call reinforcements; other future sites do not inherit that ability.

## Shared state and saved outcome

Keep permanent objective state separate from temporary alarm state. Current
objective transition: `hostile -> conquered`, with no reverse transition.
Alarm/detection and reinforcement timing stop permanently when the station is
destroyed. Defenders are separate entities, not recreated for each visiting player.

The server owns station HP, eligible impacts, alarm state, defenders and conquest.
Save partial station damage, surviving defenders and reinforcement
progress in simulation time alongside existing campaign combat checkpoints.
Leaving or zooming out must not heal the station, refill guards, cancel an accepted
strike or turn a completed site hostile. Closed rooms do not simulate offline waves.
An exact population cap must bound both the site and the combined active encounter.

Each site has a stable identity and its own overlay contribution. Conquering it
fades that red contribution and leaves a labelled completion marker; it must not
erase another site's overlapping hostile region. Conquest is progress, not an
unlock for construction. No currency reward is introduced.

Deployment and movement use the station's footprint, not its sprite extent.
Reinforcement positions need terrain, player-distance and occupancy checks; camera
zoom and browser size do not control spawning. If a valid arrival cannot be found,
defer it without stacking an unlimited pending wave.

Existing saves need an additive, versioned introduction of the site, with a backup
and collision checks against deployed equipment and players. Never regenerate the
terrain or silently place a hostile structure through an existing base. Decide a
safe fallback or explicit opt-in if no valid site remains in a modified save.

## Completion checks before expanding the stage

- A solo player can reach the station, obtain an eligible weapon and win.
- Two players share HP, guards, alarms and completion; their joining cannot
  duplicate defenders or complete the same objective twice.
- UI feedback distinguishes an ineffective hit, ordinary damage, active calls and
  permanent destruction. Minimap/overview and local views agree.
- Pausing, reconnecting, owner closure and server restart preserve partial progress
  and conquest. Existing core recovery remains the failure/retry path.
- Long-range HE still resolves off-camera; zoom does not change enemy detection.
- Defender/reinforcement limits remain bounded during a prolonged encounter.
- Existing terrain, construction, saves and friendly immunity survive the addition.

See [ENEMY_DESIGN_DISCUSSION.md](ENEMY_DESIGN_DISCUSSION.md) for the source ideas,
including unresolved armor and later facility-destruction rules. Those are separate
from this first hostile-objective stage.

## Validation

9 October local checks: typecheck and **194 tests across 35 files passed**.
Coverage includes immutable terrain, blocked placement/rays, safe migration with
backup, one-time guards, capped/cancelled calls, distant pursuit, non-HE rejection,
HE damage across delivery paths, partial checkpoint restore and permanent conquest.

Four distinct desktop/phone browser checks passed: the campaign create/invite/
saved-return flow and the new conquest flow. The latter uses a temporary campaign
with a seeded ready tank, real desktop LMB/phone cannon-button input, two players
observing shared damage/completion, and a server restart retaining the ruined site.
Desktop and phone screenshots were reviewed. The browser fixture seeds equipment;
it does not claim a measured full solo playthrough from landing through tank travel.
Existing deployment has separate regression coverage. Port 8080 serves the new
renderer. No production deployment or sustained Fly capacity measurement was made.
