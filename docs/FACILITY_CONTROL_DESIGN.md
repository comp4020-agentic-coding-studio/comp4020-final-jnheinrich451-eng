# Facility control, orbital artillery and unattended defence

User direction, 2026-10-02. Keep pure overhead 2D, persistent construction and
playable stages. Controls, robot guarding and map expansion are implemented;
vehicle and aircraft autonomy remain proposals. See [current stage](GUARD_CURVES_EXPANSION.md).

## Current control stage

Mouse target, two aim markers, automatic high-arc elevation, WASD rail travel,
numbered shell selection and the bottom facility manual now supersede the
original controls below. See [the current guide](CANNON_CONTROLS.md).

## Original control-stage record

The railway cannon uses A/D for bearing, W/S for barrel elevation and Shift to
toggle an orbital overview. LMB or Space with the map focused fires once. Held
direction buttons and explicit Fire/Orbital buttons provide phone controls.
Rail relocation retains separate buttons, so aiming cannot accidentally move
the carriage. Escape returns to body control. The mouse may pan the view but
does not steer the gun. The existing single-operator lock applies in both views.

Bearing and elevation are server-owned. Commands contain directional intent;
they cannot set a landing coordinate, instantaneous bearing, pitch or flight
time. Input expires after 350 ms without renewal. Focus loss releases the gun.
The actual elevation persists, but pending input and operator locks do not.

The ballistic model uses flat ground, fixed muzzle speed and no drag. Gravity
and speed use game units. Maximum theoretical range is 60 tiles at 45 degrees;
the allowed elevation is 10–87 degrees. Raising beyond 45 degrees shortens the
range while increasing flight time and descent angle. The ring shows the predicted
landing point and the existing three-tile blast radius. Bearing, elevation,
range and flight time are displayed. A shell keeps its launch trajectory when
the operator changes aim or relocates. Its top-down rendering uses a compressed
height offset and shadow to convey ascent/descent; this is not a 3D camera.

The saved battlefield now spans 128 by 96 tiles, preserving the original terrain
and construction through a versioned migration. A causeway connects the original
island to the eastern mainland. Off-map impacts are still rejected. The drill
selector offers remote objectives for long-range artillery. See
[expansion and save rules](GUARD_CURVES_EXPANSION.md).

Robot lasers now have a red glow, pale hot center and red impact sparks. This
changes presentation only; damage, range, burn and collision are unchanged.

## Implemented robot defensive autopilot

When a player operates a remote facility, their deployed robot holds position
and defends itself. Prefer the fuel jet against a visible enemy within its
five-tile reach; use the laser against a visible enemy farther away within its
32-tile reach. Use real weapon cooldowns, travel, turret alignment and obstacle
collision. Switching weapons must not bypass cooldowns or grant extra shots.
Recheck blockers and distance when firing; do not shoot through a friendly
facility to reach a target. Targets can escape or kill the unattended body.

Start with no roaming or pursuit. Select a nearby visible threat, retain it
while valid, and avoid rapidly switching weapons at the five-tile boundary.
Manual return immediately cancels AI fire and transfers the same body/weapon
state back to the player. Disable autopilot on death, recovery, disconnect and
loss of the facility lease. A visible "Robot guarding" status confirms defence.
There is no roaming or pursuit; automatic fire uses the normal weapon state.

Ground vehicles can later implement the same hold-position defensive interface
using their own loadout. Whether an occupied vehicle guards instead of the robot
depends on the future possession/embarkation rules; do not silently run both.
Jets are excluded until loiter routes, turning radius, fuel, air threats and
handoff are designed. Constant movement must not imply invulnerability.

## Consistent controls for many facilities

Keep three explicit contexts: body control, construction and selected-facility
control. WASD belongs to the current context; Escape always returns to the body.
The selected facility opens its default observation view; pan and zoom do not
change its operator. One player directly controls one body or facility at a time.

A later facility roster can filter by ground/air/naval/orbital role and display
owner, operator, readiness and damage. Selection should show an overview before
taking control, with optional numbered favorites. Automation belongs to an
explicit stance such as Hold/Guard, rather than making every weapon automatic.
The heavy railway cannon remains manually fired even after robot guarding exists.

## CPU and progression

Shell arcs require only launch data and an impact timer on the server; clients
draw the flight and particles. Larger maps and many inactive structures are a
different cost from many moving enemies and frequent pathfinding. A distant
sector containing an in-flight shell or ongoing battle must remain simulated.
Camera visibility is not a condition for shared damage or persistence.

For the guard stage, stagger target searches, retain valid targets, use nearby
candidate lists and avoid per-robot full-map path searches. Scale tests should
vary active guards, enemies, facilities and connected players independently.
The earlier four-client memory benchmark does not establish a safe facility
count or prove CPU/latency feasibility for large battles.

The approved sequence is complete: manual artillery/orbital view, robot
hold-position defence, curved rails with reservation, then the expanded saved
map and a bounded resource workload. Incendiary and gas are now implemented in
[the shell stage](ARTILLERY_FIELDS.md). Further tuning follows play feedback.

## Earlier control-stage verification

These measurements predate guarding and expansion. Current checks and resource
results are in [the implemented stage](GUARD_CURVES_EXPANSION.md).

`pnpm check` passed 37 domain/HTTP tests across nine files. Coverage includes
elevation limits, stale-input stopping, high/low trajectories with matching
range, off-map rejection, immutable flight after changing the gun's aim, and
reopening a legacy cannon twice without resetting its position or movement/reload.
The 13 browser scenarios passed across the full run and the corrected ownership
check rerun. The full run initially counted a friendly sentry's shots in a
player-release assertion; that check now filters by player ID. Railway cases
cover keyboard and held on-screen elevation controls, orbital view, cursor
independence, shared flight and restart preserving elevation. Red laser and
orbital screenshots were visually inspected. Windows test-server teardown still
requires stopping the isolated server after the cases finish.

The updated isolated four-observer workload completed in 19.94 seconds, with
five rail tiles, one core, one carriage, two ballistic shots, relocation, operator
death and teammate takeover. At 256 MiB, no extra swap and CPU quota 5000/80000,
peak cgroup memory was 27,115,520 bytes (25.86 MiB), with zero OOM events. Largest
snapshot: 4,717 bytes; slowest measured POST: 102.67 ms. These are measurements of
this short local workload, not guarantees for many guards, facilities or enemies.

The local preview was refreshed without resetting its saved world. Terrain,
11 scouts, two sentries, one core, robot state and 10 rails remained byte-identical
in their stored records. The existing cannon received the new elevation/control
fields through the additive load path; it remains at tile 21:13 on EW track.
