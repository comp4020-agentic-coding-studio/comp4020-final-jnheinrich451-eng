# Railway artillery and heavy shells

Current rail construction uses [one-tile corners and junctions](COMPACT_RAILS.md).
The large curves and their switches below remain compatible with saved worlds.

Playable railway stage, 2026-10-02. Broad curves and map expansion are now
implemented in [the current stage](GUARD_CURVES_EXPANSION.md). The original discussion and later
shell proposals follow the implementation notes. Layout polish can wait.

## Implemented weapon and control rules

The [unified controls](CANNON_CONTROLS.md) supersede the original directional
aiming below: mouse target, WASD rail travel and default orbital overview.
The remaining weapon, collision, ownership and saving rules still apply.

- Lay one or five centered EW/NS rail tiles through Ground forces. Matching
  segments can overlap to extend a line. A three-tile-wide clear land corridor
  excludes uncovered rocks, water, solid core machinery, unfolding panels and
  sentries. Rails may cross the landing-pad surface and completed metal flooring. Rails remain
  walkable but reserve that corridor against later construction.
- Deploy a 3×3 carriage on the middle of three connected rails. Its complete
  footprint must be clear of facilities and units. One cannon per guest, eight
  per world; at most 256 track pieces (a curve is one assembly). These are prototype limits, not an economy.
- Click/tap a carriage, or choose Ground forces → Operate a railway cannon.
  Any active teammate can take control of an unoccupied gun. One operator at a
  time; your body holds position and a deployed robot defends itself. It remains vulnerable.
- **A/D** rotates, **W/S** changes barrel elevation, and **Shift** toggles an
  orbital overview. Press **Fire HE**, **LMB on the map**, or **Space with the
  canvas focused** for exactly one shot. Held direction buttons support phones.
  No automatic target selection, queued shot or repeating fire. The mouse does
  not steer the gun; the landing ring follows its actual bearing and elevation.
  Escape, Combat, closing the panel, focus loss, disconnect or robot death
  releases control; a five-second input lease also prevents abandoned locks.
- Turret traverse: 45 degrees/second, independent of track orientation, full
  360-degree aim. Elevation moves at eight degrees/second, limited to 10–87 degrees.
  Input stops after 350 ms without renewal. Stabilizers take
  1.2 seconds; relocation takes 1.2 seconds per tile and then requires bracing.
  Forward/backward buttons move along the track axis. Both old and new 3×3
  footprints block movement while relocating. No pushing or crushing units.
- Heavy HE: up to 60 tiles at 45-degree elevation, six-second reload. Fixed
  muzzle speed and gravity determine flight time and landing position; above
  45 degrees, raising the barrel shortens range and steepens descent. Off-map
  shots are rejected. The map now spans 128 by 96 tiles. See
  [orbital controls and robot defence](FACILITY_CONTROL_DESIGN.md).
  The lob passes over intervening obstacles and
  resolves once at the chosen ground point. The blast ignores intervening cover.
  Radius is three tiles (shown by the aiming ring), with a 1.1-tile lethal center,
  140 center damage, and falloff toward 20 at the edge. Only enemies take damage.
- The irregular crater artwork fits an **8×8 tile** box. It changes no terrain,
  movement or friendly structure. Browser particles remain bounded; artillery
  shares the existing 48-mark cap and has at most eight in-flight shells.
- Additive SQLite tables save rails and carriages. Accepted construction,
  relocation and fire/reload changes are saved before acknowledgement. Elevation
  and bearing are persisted each changing simulation tick. Timed
  carriage movement, brace and reload resume after restart; operator locks are
  released. Simulation pauses without observers. In-flight shells, combat damage
  and cosmetic marks remain transient, like the existing drill.
- Only the placing guest can remove a rail tile, and no rail under a carriage
  or its swept footprint can be removed. Cannon dismantling is not yet included.

## Implemented turns

EW/NS straights connect to NE/SE/SW/NW quarter-circle assemblies with a three-tile
radius. Each curve reserves an eight-tile-square turning apron and needs three
straight support tiles at both endpoints. Advance/Reverse follows a matching
curve before a straight continuation. The chassis turns along the arc; turret
bearing stays independent. The full apron blocks entry/removal during movement,
and a saved turn resumes after restart. Overlapping aprons are rejected.
See [placement example and rules](GUARD_CURVES_EXPANSION.md).

Switches are now implemented in [junction routing](RAIL_SWITCHES.md). Crossings
and multi-car trains remain future work. The discussion below
is the original proposal; current implemented status is defined above.

Incendiary and gas are now playable. [Current shell rules](ARTILLERY_FIELDS.md)
supersede the earlier tuning proposals below.

## User direction

- A large cannon carried on rails that players can lay, with one cannon deployed
  as an individual unit. This is railway-mounted artillery.
- Consider a 3×3 unit with 360-degree traverse, or a 3×4 unit with a 90-degree
  firing sector and rail direction contributing to its aim.
- Manual aiming and firing; no automatic target search. This supersedes the
  older GAME_IDEAS.md proposal for artillery repeatedly firing at its last spot.
- Three eventual ammunition choices: HE, incendiary and gas.
- Confirmed clarification: the crater artwork is approximately 8×8 tiles;
  damage size is tuned separately.

## Original configuration discussion

Start with a 3×3 platform and slow full-circle traverse. Rails control relocation;
the turret controls aim. Require it to stop and deploy stabilizers before firing,
with a visible readiness state and substantial reload/recoil. Exact speed,
deployment time, reload and ammunition supply are still tuning decisions.

A 3×4 limited-traverse gun is an interesting later variant: the firing sector
would be 90 degrees total (45 degrees each side of the carriage's forward axis).
Targets outside that sector require another carriage orientation. A straight
track alone cannot provide every orientation; curves, junctions or a turntable
need explicit game rules. The tile footprint is a gameplay abstraction, not a
validated real-world dimension or a reason by itself to choose a traverse angle.

Player construction order: lay a valid rail segment, then deploy the carriage on
it. Begin with straight horizontal/vertical segments and connected forward/back
movement; add curves and switches as a later playable stage. A track tile and a
carriage are different objects: validate the entire platform's swept clearance,
not only the tile under its center. Do not allow a large carriage to clip through
cores, sentries or rocks because the centerline fits. Track occupied by a carriage
cannot be removed. Track persistence must preserve existing terrain and saves.

## Original manual-operation proposal

Select the cannon, enter artillery control, choose ammunition, aim, then issue
one fire command per shot. Show actual bearing, legal range, reload and the
selected shell's real affected area. An out-of-sector or unready shot must have
a clear reason. Exit returns to robot control. Use an explicit shared operator
lock so two players cannot steer/fire the same carriage independently; ownership
and teammate access still need a deliberate rule.

Proposed first operation is remote control by a living robot's operator: the
robot stays where it was and remains vulnerable. Death, disconnect or leaving
control releases the gun. Facility control while disabled remains a separate
extension of the earlier orbital-operator idea; it is not silently included here.

Treat heavy artillery separately from the rover's direct-fire HE. A proposed
lobbed shell has a visible travel delay and resolves at the selected ground point;
its rules for intervening cover and minimum/maximum range must be explicit.
Do not copy a direct projectile that explodes on the first nearby rock and call
it indirect artillery. Keep damage server-owned and particle animation local.

## Crater and blast

An 8×8 visual footprint means an irregular circular mark roughly eight tiles in
diameter, bounded by an eight-tile square. It does not mean radius eight. If the
blast is also eight tiles across, its radius is four tiles and the targeting
circle must use that same value. Do not infer the damage radius from a texture's
dimensions. Lethal center, falloff and cosmetic dust may occupy different areas.

Start with cosmetic ground damage: no holes, changed traversal or destroyed rails
and friendly bases. Use a bounded decal list and check visibility at this scale;
the current island is only 48×36 tiles. A large crater need not add server physics.
The user confirmed the eight-tile size applies to crater artwork only. Blast
radius, lethal center and damage falloff remain independent tuning decisions.

## Shell identities already recorded

See COMBAT_DESIGN.md for the earlier user-approved direction. Robot fuel and
laser burning exist; persistent incendiary/gas shell areas do not.

| Shell | Role | Proposed first resolution |
| --- | --- | --- |
| HE | Immediate blast | One radial damage event; cosmetic crater, debris and dust |
| Incendiary | Deny terrain temporarily | Monsters inside the burning core die; approaching monsters avoid it; fixed simulation-time expiry and charred remains |
| Gas | Attract and consume a finite number of enemies | Monsters seek a reachable cloud; each killed monster spends one capacity unit; remove it at zero |

Incendiary slowing, if included, belongs to a separate outer heat band. A monster
cannot both survive being slowed inside the lethal core and die immediately on
the same contact. Fire avoidance takes priority over gas attraction. One monster
can consume capacity from only one gas field, and the last capacity unit cannot
kill multiple simultaneous entrants. Do not add a gas timeout without deciding
it explicitly; bounded active-field limits can prevent unlimited unused clouds.

Exact fire radius/lifetime, gas radius/capacity/lure distance, overlapping-field
rules and reload/cost values remain to be chosen. All three shell types preserve
the established prohibition on damaging friendly units or structures.

## Playable sequence

1. **Implemented:** straight rails and valid 3×3 carriage deployment; shared manual control.
2. **Implemented:** slow turret traverse, stop/brace readiness, one complete heavy HE shot and
   the 8×8 crater artwork and independently tuned damage/aim-circle scale. Then
   relocation on connected straight rails.
3. One incendiary shell with a bounded field, avoidance and expiry.
4. One gas shell with bounded attraction and exact capacity accounting.
5. Compare the three in play, then consider curves, junctions and limited-traverse
   heavy variants. Measure hazard/pathfinding cost before increasing battle size.

The original proposals above are superseded by the implemented values at the
top of this document. Switched rail routing has its own tests and rules in
[the junction stage](RAIL_SWITCHES.md); a straight-track benchmark cannot validate it.

## Validation of the straight-track stage

`pnpm check`: 34 tests across nine files passed, including footprint/swept
collision, rail support, traverse, bracing, lease expiry and delayed blast rules.
All 13 Playwright cases passed, including desktop/touch railway placement,
exclusive shared operation, protected rail removal, body-input rejection,
restart during movement, reload persistence and disconnect releasing control.
Screenshots are under `docs/previews/rail-*`. The Windows test server required
manual termination after the cases passed to complete Playwright teardown.

`scripts/check-rail-runtime.mjs` runs only against disposable saves. Four live
observers shared five rails, one cannon, one completed core, two heavy HE shots,
carriage relocation, four enemy hits disabling the parked operator, and teammate
takeover. The 18.77-second Docker run used a 256 MiB limit, no extra swap and CPU
quota 5000/80000 microseconds. Peak cgroup memory was 26,738,688 bytes (25.5 MiB),
with no OOM events. The largest streamed snapshot was 4,612 bytes. The slowest
measured POST took 516 ms under that CPU cap; this is not a latency guarantee.
This small workload does not establish large-battle capacity, curved-routing
cost, long-session stability or browser frame rate. Fly has not been deployed.
