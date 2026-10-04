# Direct firing and ordinary bullet sentries

Date: 2026-10-01. User confirmed LMB cannon, RMB machine gun, WASD movement, a
passive weapon display, and the previously suggested order of playable stages.

## Behavior

- Desktop movement and aiming are independent. WASD/arrows move the chassis;
  the mouse turns the turret. LMB fires one HE shell; held RMB repeats APCR fire.
  Pressing LMB while RMB is held can fire the cannon without releasing the gun.
  Middle-drag pans; C recenters. Click-to-move is removed from the play interface.
- The previous HE mode button is replaced with non-focusable, non-interactive
  LMB Cannon / RMB Machine gun readouts. An accepted shot highlights its row for
  110 ms. No continuous UI animation runs while idle.
- Phone users tap to aim and use a cannon button or hold the MG button. Touch
  aiming does not synthesize a mouse shot. Direction-pad controls remain. Space
  fires HE and held J fires the machine gun when the map has keyboard focus;
  coordinate selection offers a keyboard aiming alternative.
- Deployment retains its select/confirm workflow and suppresses weapon actions.
  Held fire clears on release, pointer cancellation, leaving the firing canvas,
  focus loss, menus, hidden tabs and disconnection. Restored connections do not
  resume held fire. Browser offline/online events refresh the SSE subscription.
- The server validates weapon names, independent cooldowns, aim and outcomes.
  First-pass APCR tuning: 18 direct-hit damage, 28 tiles/second, 120 ms minimum
  simulation-time cooldown, 14-tile projectile range. The client requests held
  fire at intervals of at least 150 ms; the 100 ms server tick affects actual cadence.
- APCR projectiles continue along the aimed direction, stop at rocks or the first
  enemy, and create small impact flecks. They have no area damage or craters.
  HE keeps its existing range/blast rules and separate 650 ms cooldown. No armor
  model or penetration mechanics are implied by the APCR name in this stage.
- Existing ordinary sentries now fire APCR through the same weapon simulation.
  Their saved IDs, owners and positions are unchanged. No database migration or
  reset is needed. Future flame/gas sentry modes remain in COMBAT_DESIGN.md.

## Validation

- `pnpm check`: eleven tests in four files and TypeScript pass. New checks cover
  direct-hit-only APCR damage, independent weapon cooldowns, rejected weapon
  names, rock impacts, misses and sentries that defend without HE craters.
- Six Chrome browser tests pass, covering prior persistence/deployment behavior,
  shared combat, simultaneous mouse weapons, passive readouts, keyboard movement,
  release/blur/menu/offline cancellation, reconnection without resumed fire,
  and native touch aim/cannon/held-MG interactions. Tests use isolated saves.
- Desktop and phone screenshots: [desktop](previews/dual-weapons-desktop.png),
  [phone](previews/dual-weapons-mobile.png). Existing landscape coverage remains.

## Resource check

The mixed-fire option of `scripts/check-he-runtime.mjs` exercises four guests
moving and using both weapons. It is only for an isolated container with
`ISOLATED_TEST=1`, `MIXED_FIRE=1` and its APP_URL. Weapon cadence rejection is
counted separately from accepted shots.

Both local runs used 256 MiB RAM with no extra swap and a CPU quota of
5000/80000 microseconds. The first run revealed that broadcasting the full state
on every accepted bullet generated unnecessary traffic. Combat/drill actions now
mark state dirty for the existing 100 ms simulation tick; their HTTP responses
remain immediate. Presence and durable construction changes still broadcast
immediately. Brief muzzle flashes are retained when first seen in a batched update.

The final 60.01-second run made 2,774 action requests, with 296 HE shots, 1,076
APCR rounds accepted and 128 requests rejected by weapon cooldowns. It restarted
74 small drills and observed all 296 HE blasts during the capture window.
Median local HTTP response was 1.57 ms; p95 was 79.89 ms. Marks remained capped at
48. Received snapshots across four guests fell from 7,958 to 2,386, and SSE bytes
from 83,637,104 to 25,799,006 (about 69% less), under the same scripted workload.
The largest final snapshot was 13,371 bytes. This still sends full snapshots;
larger-scale networking and delta updates remain future considerations.

Final container cgroup memory.peak was 34,164,736 bytes (32.58 MiB), against
memory.max=268,435,456; OOMKilled=false. The CPU counters read after the run
included 57 throttled periods and 3,595,867 microseconds throttled, including
startup/inspection time. The initial run peaked at 34,725,888 bytes.

These are bounded local-container results. They do not measure browser graphics
memory, phone frame rate, Fly internet latency, VM OS overhead, a large sentry
population or future fire/gas hazards. Test containers were stopped afterwards;
no user-save directory was mounted.

The simulation retains a 64-projectile cap. Bullet effects use at most 24 recent
hit effects (ten in reduced mode), each with at most five tiny flecks. Bullet
hits do not allocate HE particle bursts or add crater marks. These are bounded
local effects, not per-particle network entities.

## Next accepted stage

Follow-up: the user inserted a bounded stabilized-turret step before personal
survival. See [STABILIZED_TURRET.md](STABILIZED_TURRET.md) for that implementation.

Personal health, alien attack cues and a recoverable robot death/return loop.
Fuel jets and gas clouds follow that stage, with their own behavior and resource
checks. This record does not claim those features are implemented.
