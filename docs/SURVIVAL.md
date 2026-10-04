# Robot survival and shared recovery

Playable stage, 2026-10-02. Robots now have persistent health and body states:
active → disabled → replacement incoming → active. The temporary entry rover
remains outside this survival loop; deploy an orbital core to enter a robot.

## Enemy attacks

Robots start with 100 health. Crawlers acquire a nearby active robot within six
tiles, retain it within eight, and otherwise advance on the landing pad. They
wind up a melee strike for 650 ms when within 1.15 tiles. The orange ground
circle stays at the targeted position: leaving its 0.85-tile radius dodges the
hit. A hit deals 25 damage, followed by a 1.4-second recovery. Walls and solid
facilities block damage; burning panic cancels a pending strike. Weapon damage
still cannot harm friendly entities. Enemy/player outcomes belong to the server.

## Disabled bodies and replacement

Zero health disables movement, weapons and construction. The dimmed body stays
visible until replacement. Bases, terrain and guest identity remain intact.
After three seconds of preparation, choose any completed friendly core in the
recovery panel. Selecting it highlights its six-tile recovery circle and centers
the camera. The server chooses a walkable point within that circle, preferring
the exit and keeping 1.5 tiles clear of living units and incoming replacements.

Replacement takes 1.8 seconds, shown as a descending pod and impact ring. The
same destination is revalidated on landing; if blocked, the player returns to
the recovery panel with a clear retry message. Successful landing restores 100
health and provides a visible two-second shield. Selecting a teammate's core
does not change ownership or grant another core/sentry. Repeated requests for an
incoming pod are idempotent; active players cannot request a replacement.

All existing cores are friendly in the current single shared world. Core
destruction is not implemented, so an established robot always retains a core
option. If all nearby points are occupied, wait for space or choose another core.
Costs, repairs, reviving a teammate in place, destructible cores, private rooms,
audio and a resource economy remain later work. Values above are tuning choices.

## Persistence and timing

An additive `robot_states` SQLite table stores health, body state, remaining
recovery/shield time, selected core and hit sequence. Existing saves adopt full
health without regenerating terrain, scouts, buildings or cores. Damage and
state transitions are saved with position before broadcasting. Reloading or
restarting does not repair a robot, skip death or duplicate a replacement.

Personal timers advance while that guest has an active stream; an empty world
pauses all combat. Enemies/drills remain transient and reset on server restart.
Shield protection does not turn the entire core circle into a safe zone. Client
effects use the shared states and simulation time, with no networked particles.

## Checks

Domain tests cover wind-up/dodge, one-hit accounting, burn interruption, obstacle
and shield protection, disabled controls/state, shared-core choice, duplicate
requests, occupied landing points and arrival revalidation. Isolated browser
tests cover desktop and touch recovery, reconnect/restart persistence, a second
observer, restored health and unchanged core/facility counts. See screenshots
under `docs/previews/survival-*`.

Validation: `pnpm check` passed 30 tests across eight files; all 11 Playwright
scenarios passed. The two survival browser scenarios include restarting while
disabled, and the desktop scenario also restarts during pod descent. The Windows
Playwright server needed manual termination after tests to finish teardown.

`scripts/check-survival-runtime.mjs` exercised four observers, two cores, actual
enemy pursuit, four hits, death and recovery at a teammate's core. The local Docker
run took 19.25 seconds with 256 MiB memory, no extra swap and CPU quota 5000/80000
microseconds. Peak cgroup memory was 28,274,688 bytes (26.97 MiB), with zero OOM
events; the largest snapshot was 4,282 bytes. This checks the small survival
slice only, not large battles, long-session stability or browser frame rate.
