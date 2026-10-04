# Guarding, railway curves and the expanded battlefield

New rail construction now uses [one-tile connections](COMPACT_RAILS.md).
The broad curves described here remain supported in existing saves.

Implemented in the approved order, 2026-10-02. This supersedes the earlier
proposal-only status for these three features.

## Robot guarding

Operating a railway cannon puts a deployed, living robot into hold-position
defence. "Robot guarding" appears in the facility panel and robot health label.
The robot chooses visible enemies within 32 tiles, turns its existing body at
the normal rate and waits for alignment before firing. New targets within five
tiles receive fuel; distant targets receive laser fire. A laser target must
come within 4.5 tiles to switch to fuel, avoiding chatter at the boundary.
An approaching close threat can replace a distant target at the next search.

Searches run at most twice per second per robot with staggered initial offsets.
The current small drill uses a distance-filtered enemy list, not a large spatial
index. It adds no guard pathfinding: the robot never pursues. Existing cooldowns,
collision, fuel travel, laser burning and friendly-damage rules all apply.
Visibility and actual muzzle bearing are checked again before a shot. The guard
can still take damage or die. Leaving facility control, death, disconnection,
recovery or lease loss stops new automatic shots; already launched fuel continues.

This applies to deployed robots only. The temporary rover, future occupied
vehicles and jets have no defensive autopilot yet. The railway cannon remains
manually fired. No automatic guarding runs for disconnected guests.

## Broad rail curves

Ground forces → Rail track now offers EW/NS straight pieces and NE/SE/SW/NW
quarter-circle assemblies. The chosen tile is the circle's center; the curve
occupies the named quadrant. Radius is three tiles. Placement previews a clear
8×8 turning apron. This conservative area covers the entire rotating 3×3 body.

The placement message gives the two endpoint coordinates and the required
straight-track axes. Lay at least three straight tiles centered on each endpoint.
Deploy on a straight approach, reach the endpoint, then use WASD along the track
axis. The matching curve takes priority over a straight continuation. The current
[control guide](CANNON_CONTROLS.md) supersedes the earlier Advance/Reverse buttons.

For a clear eastern example: place an NE curve centered at **68:22**, EW straight
track centered at **68:19**, and NS straight track centered at **71:22**. Deploy
the cannon at 68:19; D follows the curve to 71:22. W returns through the curve.
The preview and server still check current objects/units; the example is not a
promise that another player has left those tiles clear.

The turn takes approximately 5.65 simulation seconds, followed by 1.2 seconds
of bracing. The chassis rotates along the arc; turret bearing remains independent.
The whole apron is reserved until arrival. Units, machinery, rocks or another
carriage prevent entry, and track inside the reservation cannot be removed.
Movement saves the curve, elapsed time, direction and reservation, so a restart
resumes the turn and releases its operator. Overlapping curve aprons are rejected;
route switching is now implemented in [junction switches](RAIL_SWITCHES.md).
Multi-car trains remain a later stage.

## Larger battlefield and saving

Caldera now covers **128×96 tiles**. The original 48×36 terrain is copied to the
same coordinates without changing any cell, including existing modifications.
A three-wide causeway crosses the old eastern water to the new mainland. The
deck is a walkable overlay in the old region; its underlying terrain is retained.
The expansion adds broad eastern land and a southern offshore island.

The server performs a versioned, transactional migration once. The complete old
world JSON is retained under SQLite meta key `world-before-expansion-v2`. Scout,
robot, core, building, rail and cannon records are not regenerated or repositioned.
Unsupported legacy map dimensions fail with the save left unchanged. This is
one shared expanded map, not private campaigns or infinite terrain streaming.

Select **Eastern plain** or **Southern reach** in the drill selector for remote
combat; Caldera landing remains the default. All players see the same active
sector, enemies and objective health. The selected remote objective is marked
on the map. Starting a remote drill inspects that sector, or opens orbital view
when operating artillery. Cannon reach remains 60 tiles; observation does not
increase weapon range, and off-camera shells/enemies still resolve on the server.

Close-up terrain renders through a cache of at most 32 visible/recent 16×16-tile
sections. At wide zoom the client uses a small overview image. Full-map path
searches still exist for movement, but enemy spawn candidate scans are restricted
to the selected objective's neighborhood. Construction and active-entity caps
remain unchanged; the larger map is not evidence that arbitrary army sizes fit.

## Verification

Domain tests cover guard range/visibility/handoff/shared cooldowns, all four
curve orientations in both directions, chassis interpolation and independent
turret bearing, turn reservation, retained old terrain, causeway reachability,
remote enemy placement and idempotent database migration with old-world backup.

Verification passed: 46 domain/HTTP tests in ten files, plus 15 browser scenarios
(the existing 13 and two new integration scenarios). Desktop 1920x1080 and phone
390x844 checks cover both guard weapons, shared guard status, curve travel and
restart, ownership/reservation checks, remote objectives and long-range fire.
No page overflow or browser script errors were reported. Screenshots in
`docs/previews/` were visually inspected. Windows Playwright webserver teardown
required stopping its isolated server after the test cases completed.

The disposable Docker workload used four connected clients, one active guard,
one core, 11 track pieces and one cannon. It completed a drill, a curve, a
43.17-tile shot and a player's causeway crossing in 47.88 seconds. With 256 MiB,
no extra swap and CPU quota 5000/80000, peak cgroup memory was 31,174,656 bytes
(29.73 MiB), with zero OOM events. It transferred 1,934 snapshots / 6,934,732 bytes;
the largest snapshot was 5,683 bytes and slowest measured POST was 78.12 ms.
CPU usage was 728,988 microseconds; 37 of 796 periods were throttled.

Run `scripts/check-expansion-runtime.mjs` only against a disposable server with
`ISOLATED_TEST=1`. These measurements cover a short, small battle and do not
establish sustained capacity for many guards or armies.


The local preview was refreshed after taking a complete SQLite backup. All 1,728
original terrain cells retained their coordinates and values, and the retained
old-world JSON matched exactly. Stored records remained byte-identical for
11 scouts, two sentries, one core, one robot state, 10 rails and one cannon.
The running preview serves the expanded map and new modules. Reload an existing
browser tab to receive the expanded world dimensions. This was a local preview
refresh, not a Fly deployment.
