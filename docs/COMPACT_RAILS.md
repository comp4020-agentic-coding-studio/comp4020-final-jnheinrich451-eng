# One-tile railway connections

2026-10-02: this corrects the broad-curve interpretation. New corners and junctions
occupy **one tile**, connect directly to neighboring rail tiles and need no separate
switch installation or route-selection menu.

## Build and drive

- Ground forces > Rail track offers EW/NS straight runs, a one-tile junction and
  four one-tile corners. Corner names describe their open edges: North + East,
  South + East, South + West, North + West.
- Lay NS track over your EW track (or vice versa) to create a junction in the
  shared tile. Adding track preserves existing exits. Only the tile owner can
  change its connections, and a cannon must be clear before rebuilding it.
- At a junction or corner, WASD chooses a connected neighboring tile: W north,
  S south, A west, D east. A straight can continue through the junction. Press
  the branch direction to turn. On phones, use the same directions on the pad.
- A held perpendicular direction can select the branch when the cannon arrives.
  With two directions held, the direction perpendicular to the current axis has
  priority at a compact tile. Started movements finish before accepting another.
- Adjacent tiles must expose matching edges. Unconnected exits stop the carriage
  instead of jumping a gap. Junctions can serve L, T or four-way layouts according
  to which neighboring tracks are connected. Adjacent compact corners also work.

Example: cross EW track centered at **68:22** with NS track centered at **68:22**.
Extend either run as needed. The shared tile becomes a junction. Drive east onto
68:22, then W turns north, S turns south or D continues east.

## Track size and cannon clearance

The corner/junction artwork and permanent construction reservation fit one tile.
The cannon remains a 3-by-3 vehicle. Its chassis rotates during a 1.2-second
step into the chosen branch; turret bearing remains independent. Collision checks
still reject rocks, structures, bodies and other carriages in its path.

A rotating square needs more clearance than a stationary square. During a turn,
the server conservatively reserves the source/destination bounding rectangle
padded by two tiles (5 by 6, or 6 by 5) for static obstacles and other carriages.
Units use the translating, rotating 3-by-3 body instead of this outer rectangle;
nearby scouts in empty rectangle corners do not obstruct the turn or get relocated.
The unit test samples the full turn with bounded between-sample padding and uses
the same geometry in walking, pathfinding and session position validation.
This is temporary vehicle clearance, not a permanent rail apron.
No movement can overlap another carriage reservation;
track changes/removal beneath the moving carriage are rejected. Straight-run
construction retains its existing three-wide corridor. Deploy the cannon on a
straight section with three connected supporting tiles before driving to a corner.

Rails and carriages can cross the original H landing-pad surface and completed
core flooring, including rocks covered by those panels. The previous blanket
pad/panel exclusion was a placement restriction, not physical collision, and has
been removed. Solid core machinery, sentries and panels still unfolding remain
blocked. A five-tile run checks every tile in its corridor, including tiles beyond
the highlighted center. Core blockers now identify the blocking tile.

If a parked cannon occupies the original guest spawn, arrival and invalid-position
recovery choose nearby walkable ground. Guests never spawn inside that carriage.

## Saves and compatibility

Compact shapes use the existing `rails` table: `J`, `CNE`, `CSE`, `CSW`, `CNW`.
Adding connections updates shape transactionally without changing the owner or
duplicating a tile. Accepted construction is saved before success is returned.
Movement saves its source orientation and swept reservation; restart resumes the
step and releases operator control. There is no new persistent compact-switch state.

Existing large curves and their saved switches retain their geometry and behavior.
They are no longer offered for new construction in the game menu. Their legacy
switch controls appear only in worlds that contain them. Remove unused old curves
and rebuild where desired; saves are never automatically rearranged.

## Validation

Domain cases exercise every compact orientation in both directions, reciprocal
connections, adjacent corners, merging and ownership, one-tile construction,
blocked swept movement, independent turret bearing and serialized interpolation.
Browser scenarios cover real placement controls, two-player visibility,
directional branching, reconnect/restart persistence and phone controls.

`pnpm check`: 73 tests across 14 files passed. Eight targeted browser scenarios
passed across compact rails, cannon controls, existing rails and legacy switches
on desktop and phone. The new fixture initially tried to close Site controls
after Escape had already closed it; correcting that redundant action allowed
both scenarios to complete. Desktop track and phone placement/driving screenshots
were visually inspected in `docs/previews/compact-*.png`.

Floor-placement correction: 76 domain/HTTP tests across 15 files pass. Dedicated
desktop and phone browser scenarios reproduce the pictured NS run at 25:16,
build over completed panels covering rocks, reject solid machinery, and verify a
new guest arrives clear of a cannon parked over the pad. The fixture deploys the
core before adding rails over its flooring; dropping a new core onto existing
rail infrastructure remains rejected.
Core panels render beneath rails so accepted track stays visible on metal floors.
Pad and floor screenshots are recorded in `docs/previews/rail-pad-*.png` and
`docs/previews/rail-floor-*.png`.

Turn-clearance correction: the reported cannon at 25:13 turning south wrongly
rejected Scout 02 at 27.827:16.5. The old test expanded every cell of the coarse
reservation into a unit blocker. The new swept-body test allows that exact layout
while rejecting a scout hit only by the rotating corner, outside both endpoint
footprints. A genuine turning blocker is named and located in the error message.
Saved turns retain enough orientation data for the same collision checks on reload.
Validation: 82 domain/HTTP tests across 15 files and four targeted browser scenarios
pass. Desktop and phone reproduce the saved positions in isolated databases, press
S or the down pad, and verify that the nearby scout is unchanged during the turn
and after reload. Existing compact branching/restart cases also pass.
