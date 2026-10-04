# Cannon controls: point, fire and drive

**Rail update:** [compact one-tile connections](COMPACT_RAILS.md) now let WASD
choose any connected exit at a junction or corner. Perpendicular keys still do
nothing on ordinary straight track. The broad-curve notes below describe saved
legacy track; compact junctions need no switch menu.

The cannon now shares the tank's separation between desired aim and actual aim.
Taking control opens the orbital overview automatically. The camera then pans
and zooms normally; there is no separate close-up cannon view to toggle.

| Input | Cannon action |
| --- | --- |
| Mouse movement / tap ground | Set desired target, shown by the gold crosshair |
| LMB click / Space / Fire button | Fire one shell along the actual barrel solution |
| A / D | Drive west / east along EW rails |
| W / S | Drive north / south along NS rails |
| 1 / 2 / 3 | HE / Incendiary / Gas |
| Wheel or + / - | Zoom the map |
| Middle drag / touch drag | Pan the map |
| C | Center on the cannon |
| Escape / Exit | Return to the robot or rover |

The blue diamond and shell-sized ring show where a shot fired **now** would land.
The desired marker moves immediately. Bearing traverses at 45 degrees/second,
while elevation changes at eight degrees/second. The server chooses the higher
ballistic arc for the requested distance. It keeps the existing fixed muzzle
speed, gravity and limits: approximately 6.27 to 60 tiles with automatic elevation
between 87 and 45 degrees. An out-of-range target turns the desired crosshair red;
the actual solution clamps to the reachable range. Off-map actual impacts remain
rejected. Clicking while the cannon is still tracking fires at the blue marker;
it does not instantly snap to the cursor or queue an aligned shot.

All shell types share reload, movement blocks firing, and the carriage braces
after stopping. A held valid direction repeats one reserved movement segment at
a time. Releasing it stops after the current segment. A bend is one indivisible
segment: the carriage completes the quarter circle, then accepts keys along its
new track axis. Perpendicular keys on a straight do nothing. Dead ends, blocked
footprints and units in a curve apron prevent further movement.

The NE/SE/SW/NW curves already rotate the carriage along their arcs; turret aim
remains independent. [Junction switches](RAIL_SWITCHES.md) now add a saved route
choice and lock until the whole carriage clears the turning apron. Open
**Switches** in the cannon manual to operate them. Ordinary connected curves
still take priority over a straight continuation until upgraded to a switch.

While controlling artillery, the bottom action dock becomes the cannon manual:
movement instructions, numbered shell buttons, fire, readiness, trajectory and
robot-guard status. The body/ground-force controls return on exit. The facility
dock is kept separate from body controls so future vehicles and facilities can
supply their own action set without overloading robot weapon labels. Touch users
keep the directional pad and separate tap-to-aim/fire actions.

Directional commands and target coordinates are validated by the server. Input
expires after 350 ms without renewal; operator leases and disconnect/death
handoff remain in force. Aim, motion and shell selection remain authoritative.
Saved movement resumes after restart, with operator/input ownership cleared.
The prior directional-aim API remains only for compatibility with earlier
isolated workload scripts; the game sends pointer-target/rail-drive commands.

## Verification

Domain checks cover automatic high arcs, range clamping, slow convergence,
stale-input stopping, firing during tracking, invalid travel axes, dead ends,
indivisible movement and forward/reverse driving through all four curves.
The 59 domain/HTTP tests across 12 files pass. Browser checks exercise real mouse
and touch aiming, immediate LMB fire during tracking, numbered shell selection,
perpendicular-key no-ops, stale drive input, the context dock, robot guarding,
curve movement/restart and the previous combat/landing/recovery features.
Desktop 1920x1080 and phone 390x844 screenshots were visually inspected.

The first phone long-range fixture tapped the map-tool overlay rather than the
canvas. The aiming helper now verifies the hit element, and that scenario uses
an unobstructed target. Two older checks were also made robust to elapsed time:
the brief ground-contact label is observed through its DOM changes, and a fresh
reload begins before checking restart preservation. These are fixture changes,
not changes to the landing or reload mechanics. Final browser/save results follow.


All 19 browser scenarios passed across the full run and the three corrected
scenario reruns. The local preview was refreshed after a complete SQLite backup.
Both metadata rows, 11 scouts, two sentries, one core, one robot state, 10 rails
and one cannon remained byte-identical in stored records. The new facility
manual is served successfully. Refresh existing tabs to load the controls.
No Fly deployment was performed.
