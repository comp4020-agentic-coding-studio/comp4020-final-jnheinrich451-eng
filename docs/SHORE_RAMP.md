# Gunship shore ramp

Implemented 2026-10-04. The gunship can now carry its operator to another
shoreline, land the robot, and take it aboard again without a constructed dock.
The built-in ramp is available on existing ships; there is no purchase or
resource cost in this stage. The ship still has one shared operator seat.
Passenger seats and vehicle cargo are future additions.

## Playing

Sail close to clear land. A dashed ramp and shore marker preview an available
landing, and the manual shows **SHORE IN REACH**. Press **G / Shore ramp** to
anchor at the current position and deploy the ramp. Press **E / Disembark**
to land at its endpoint. Return to that marker and press **E / Board ship**.
Press **G / Retract ramp** before sailing. Phone players have the same buttons.

The hull may approach at any angle. Reach is at most two tiles from the closest
hull edge to the center of a clear shore tile. If there is no valid crossing,
move closer or try another beach. The nearest valid tile is chosen by the
server; submitted coordinates cannot create a distant landing. A deployed
ramp locks both hull translation and steering; the guns remain available.

The original delivery dock remains available and Show dock still points to it.
An empty ship can be boarded by another active friendly robot through its ramp,
using the existing exclusive-seat rules.

## Collision and persistence

The short crossing is sampled across its width. Intermediate cells must be
water, and the endpoint must support a robot. Rocks, intervening land, solid
structures and other hulls reject the route. Deployment also rejects occupied
endpoints, reserved dock/ramp tiles, the original landing pad and rail corridors.
No terrain is rewritten and the ramp is not a general walkable ocean bridge.
Boarding/disembarkation is an explicit transition, like the original gangway.

Deployment reserves the shore tile against sentries, cores, tanks, rails and
missile batteries. Exit rechecks live unit occupancy and the crossing; boarding
rechecks the crossing and proximity. Blocking the endpoint never teleports the
robot elsewhere. The anchor pose must still match the ship's position/heading.
Destroyed ships release their ramp reservation, and replacement clears the old
ramp. Retracting also releases the temporary reservation.

`ships/ramp` requires a connected operator aboard an operational ship and an
explicit boolean deployment state. Repeated deploy/retract commands are
idempotent. Accepted changes save before acknowledgement, in the existing
ship JSON with no schema migration. Ramp and anchor pose survive restart;
old saves with no ramp preserve their previous behavior. Hull/seat/robot
handoffs retain existing atomic persistence.

The server searches only on a deployment request, over a bounded neighborhood.
The client renders the ramp and preview; no new simulation timers, particles,
pathfinding agents or synchronized bridge physics are added.

## Validation

`spec/ship-ramp.test.ts` covers reach, rotated hulls, crossing obstructions,
occupied shore selection, construction reservations, movement locking, stale
poses, destruction and unchanged terrain. `spec/ship.test.ts` covers HTTP
authorization, malformed requests, ignored forged coordinates, idempotency,
saved anchoring, disembarkation, restart, reboarding and resumed sailing.

The full type/domain/HTTP check passed with 135 tests, followed by a passing
five-case ramp suite including one additional rotated-hull case (136 total).
Six browser cases passed across 1920x1080 and 390x844: shore landing/return,
main/secondary weapons, and the original navy deployment/docking flow. The
shore tests include a second viewer, keyboard and phone buttons, an attempted
move while anchored, restart while ashore, resize, and no overflow or page errors.
Ramp screenshots are in `docs/previews/ship-ramp-*` and `ship-shore-*`.
These checks do not establish passenger transport, final balance or large-battle
capacity.
