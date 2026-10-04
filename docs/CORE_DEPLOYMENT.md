# First playable orbital core

Implemented 2026-10-01 after the user confirmed the 3-by-3 core and four outward
3-by-4 panels, and requested a heavy landing with distinct panel ground strikes.

## Try it

Open Ground forces, choose Orbital core, inspect the orbital survey and confirm a
landing site. A nearby legal site is preselected when one is available. Mouse or
touch can change the site; Site controls also support coordinate entry. Existing
players opt into deployment rather than having their saved positions reset on entry.

The camera descends toward the core. Its hot descent trail and tightening shadow
end in a ground impact, dust ring and restrained shake. The four hinged metal
panels unfold with staggered timing and separate dust/impact beats. The hatch
opens, a provisional top-down robot exits on the right, and controls unlock.
The complete sequence takes 4.5 simulation seconds. A small integrated APCR sentry
becomes active at the upper-right core cell.

The robot now uses fuel/laser weapons described in ROBOT_COMBAT_DESIGN.md.
Personal health/death and shared revival-core selection are implemented in
SURVIVAL.md; resource costs remain a later stage.
Each scout gets one saved core deployment in this field test; this
temporary allowance is not the planned resource economy. Up to eight cores are
allowed in the current world. Returning or retrying does not create another core.

## Terrain and authority

The footprint is the agreed cross: seven core machinery cells, one sentry, one
robot exit and 48 panel cells. Its 11-by-11 bounding square has untouched corners.
All 57 affected cells must fit on land. Natural rocks are convertible, but the
footprint cannot overlap existing facilities, another core, units or the original
landing pad. Water deployment is not implemented. The server reserves the entire
cross while it is incoming; movement, construction and enemy spawning respect it.

After completion, the panels and exit are walkable, including covered rock cells.
Machinery/sentry cells remain blocked. Flooring is derived from saved core records
over the original unchanged terrain; rendering, pathfinding and collision read that
same state. The core cannot currently be dismantled or destroyed. Consequently,
floor survival after a future core destruction remains a design requirement for
that later feature, not a claim about an implemented destruction mechanic.

The additive SQLite cores table stores owner, position and simulation progress.
The initial reservation and robot transfer are committed together before success.
Progress is checkpointed every half second and completed deployment/exit placement
are committed together. Interrupted deployments resume; completed ones do not replay.
Progress pauses when no player streams are connected. Multiple browsers animate
from shared progress, with at most one tick of local extrapolation. The server
blocks movement/fire during arrival and controls the robot's exit position.

## Effects and sound preparation

No new downloaded assets or audio are required. A cached metal-panel texture and
cached soft dust sprite are drawn on the existing canvas. Dust/shards are bounded,
deterministic local presentation, not networked entities. Reduced-effects mode
removes shake and most particles while preserving arrival, hinges and hatch timing.

Sound is not playing yet. In `public/core.js`, the explicit impact timings are
1.35 seconds for pod contact and 2.60, 2.82, 3.04 and 3.26 seconds for the four
panel strikes. These provide separate synchronization points for future approved
landing and metal-impact clips. Adding sound should deduplicate cues and avoid
replaying past impacts when a client joins or reconnects.

## Validation

- TypeScript and 19 tests cover geometry, untouched corners, blocked reservations,
  rock-to-floor traversal, exit path, occupied/water rejection, idempotent retries,
  restart during descent, empty-world pause, saved completion and existing behavior.
- Nine browser checks cover two independently owned cores, desktop and native
  phone deployment, shared completion, walking over a formerly blocked rock,
  reload without redeployment, and the earlier firing/building/persistence checks.
- Reviewed captures: [survey](previews/core-survey-desktop.png),
  [contact](previews/core-impact.png), [panels](previews/core-panels.png),
  [phone survey](previews/core-survey-mobile.png), and
  [phone base](previews/core-deployed-mobile.png).
- All automated deployment tests use isolated saves. The live user's existing
  terrain, guest identities and sentries are preserved.

The broader design remains in [ROBOT_DEPLOYMENT_DESIGN.md](ROBOT_DEPLOYMENT_DESIGN.md).

## Bounded resource check

`scripts/check-core-runtime.mjs` ran against an isolated Node 24.21.0 container
with 256 MiB memory, no additional swap, and CPU quota 5000/80000 microseconds.
Four observers received two completed deployments, then 160 machine-gun shots
and a small crawler drill over 16.00 seconds. All observers saw both completions;
retrying deployment returned the original saved core.

Cgroup memory.peak was 29,401,088 bytes (28.04 MiB), OOMKilled=false. The run
received 650 snapshots / 2,383,878 bytes across four clients; the largest snapshot
was 6,960 bytes. Local action median was 67.99 ms and p95 81.26 ms. CPU counters
including startup/inspection reported 531,189 microseconds usage and 37 throttled
periods. This is a short, bounded check, not an eight-core battle benchmark or a
measurement of phone frame rate, browser graphics memory or Fly internet latency.
The disposable container used no user-save mount and was stopped afterwards.
