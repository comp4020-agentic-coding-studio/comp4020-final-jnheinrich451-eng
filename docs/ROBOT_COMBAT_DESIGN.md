# Robot weapons, burning and aim-facing movement

Design record, 2026-10-01; first playable implementation, 2026-10-02.

## Implemented slice

Robot: hold LMB / Space for fuel, hold RMB / J for laser; labelled touch buttons
repeat while held. Rover equipment remains HE/APCR. The server derives equipment
from the player's deployed body and rejects unequipped weapons. Shared definitions
in `public/weapons.js` drive damage, cooldowns, range and blast previews. HE shells
retain their blast parameters on launch; nonexplosive robot weapons have no ring.

The laser presentation is now red with a pale core and red hit sparks. Its damage
and burning rules are unchanged. Automatic hold-position defence now runs while
the player operates a railway cannon, using the same fuel/laser weapon state.
See [guarding and handoff rules](GUARD_CURVES_EXPANSION.md).

First tuning values (play-test values, not a realism claim):

| Weapon | Range | Server cadence | Outcome |
| --- | --- | --- | --- |
| Fuel | 5 tiles, travels 10 tiles/s | 100 ms | Lethal swept contact, width 0.16 tile beyond enemy radius |
| Laser | 32 tiles, immediate ray | 300 ms | 24 direct damage + 10/s burn for 2.4 s |

The client adds a small cadence margin for request timing. Laser survivors flee
at 1.5 tiles/s, stop pad attacks, and reacquire the pad after burning expires.
One burn refreshes without stacking; simulation time pauses with an empty world.
Escape path searches run at most every 750 ms while unobstructed. Both weapons
stop at rocks, map edges, sentries and core machinery, without friendly damage.
Fuel packets retain their original velocity; the client joins them into ribbons
and adds local droplets. Fuel contact and burn deaths leave charred remains.

Robot facing turns at 540 degrees/s; its independent world-direction movement is
projected into forward/backward/strafe foot placement. Actual velocity, including
the final zero velocity, is shared. Blocked and stationary robots stop stepping.

Bounds: 96 fuel packets globally / 12 per owner, 64 recent shot records, 64 impact
records, 48 ground marks. A packet lasts at most 0.5 s. Laser spark/beam and burn
effects reuse bounded client lists; no fluid simulation or networked droplets.
This does not add deposited fuel, persistent fire areas, fringe burns, ammunition,
sound or incendiary/gas shells. Personal health, death and revival at friendly
cores were added in the next stage, documented in [SURVIVAL.md](SURVIVAL.md).

The sections below preserve the design rationale; proposals beyond this slice
remain future work.

### Validation of this slice

`pnpm check`: 25 tests passed across seven files, including exact ray occlusion,
nearest hit, world bounds, fuel travel and lethal contact, burn refresh/expiry,
single kill accounting, entity expiry/caps, loadout enforcement, aim-facing
movement, deployment and persistence. Nine browser scenarios passed at desktop
and phone sizes, including shared fuel/laser events, held touch fire/release and
menu cancellation. The Windows Playwright test server needed manual termination
after the scenarios completed to finish teardown. Screenshots were inspected;
the brief laser pulse was also captured in a separate isolated browser session.

A short local Docker check used four observers, two completed cores, the
three-crawler drill and 160 mixed robot/rover shots over 16.49 seconds. Limits:
256 MiB, no extra swap, CPU quota 5000/80000 microseconds. Cgroup memory peak:
28,897,280 bytes (27.56 MiB), no OOM. Maximum snapshot 7,411 bytes; client-measured
API median 64.59 ms, p95 80.06 ms. Workload: `scripts/check-core-runtime.mjs`,
which now chooses body-appropriate weapons. These measurements support this
small slice only, not sustained large battles or public-network latency. The
short workload is not a renderer performance benchmark.

## Current baseline and blast previews

The rover's dotted circle reads the shared equipped weapon's radius: currently
HE at 2.1 tiles. The same profile bounds server blast damage. Its centre
follows the actual barrel bearing at the cursor's distance, and previews an
unobstructed detonation; an earlier collision can move the actual blast centre.

User direction: different cannon/shell combinations need different blast radii,
with larger artillery having larger blasts than small cannons. The preview must
match the actual explosion, not merely scale with the gun sprite.

Implementation proposal: shared weapon definitions supply blast radius, damage,
range, cadence and effects. The server owns the equipped weapon and validates
fire; clients read its definition to render the preview. A fired shell retains
the definition/parameters it launched with even if its operator changes equipment.
Tank HE keeps a circle. A nonexplosive laser or jet gets a line/stream-width cue,
not the inherited cannon circle. Exact future cannon radii are not selected yet.

## Confirmed robot direction

- The robot's default weapon should be a flamethrower; its second weapon should
  be a laser rifle. It should no longer inherit the tank's cannon loadout.
- The flamethrower looks like a travelling liquid fuel pillar/ribbon. It should
  not look like a gaseous cloud or a static cone attached to the weapon.
- Laser fire is a full line toward the target, ending at an obstacle or the first
  enemy, rather than a short travelling bullet. It deals direct damage and can
  ignite an enemy. Its fire damage is weaker than an incendiary bomb's fire.
- Burning enemies lose track of their attack target and flee until they die or
  the fire ends. Exact ignition/damage/duration values are still to be chosen.
- The robot faces its aim while movement remains independent. Facing east and
  moving south means strafing to the robot's right.

## Proposed weapon controls and beam rules

Preserve familiar separate mouse actions: hold LMB for the liquid jet, RMB for
the laser rifle, with corresponding labelled touch controls. These are proposed
bindings were selected for the first approved implementation; equipment switching
remains a possible later alternative. Tanks keep LMB cannon / RMB machine gun.

Start the rifle with short visible beam pulses that repeat while RMB is held.
Each pulse appears along its entire resolved path immediately (hitscan), with a
bright narrow core, restrained glow and a spark at the impact point. A pulse is
not a moving tracer. A continuous sustained beam remains an alternative; the
user's message does not settle pulse duration or trigger behavior.

The server resolves the first collision along the actual weapon bearing and sends
the start/end points and outcome. The client only draws the line. Give the weapon
a fixed world-space maximum range, clipped at the world edge, rather than using
the browser's screen edge as its damage limit. A desktop and phone must hit the
same target even though their views crop the beam differently. An enemy takes
direct damage once per accepted pulse, not once per rendered frame.

Proposed blockers: rocks and solid structures, including core machinery. Walkable
floor panels do not block the ray. Friendly damage stays forbidden; an obstacle
can stop a shot without receiving damage. Friendly robots need not absorb shots.
This requires a deliberate shared shot-obstruction rule: current ordinary
projectiles stop at rock terrain/enemies, and not all structures block them yet.

## Burning and panic

Proposed enemy states: attacking -> burning/fleeing -> dead, or back to target
acquisition once extinguished. While fleeing, stop attack damage, clear the old
target and seek walkable ground away from the recent heat source. Do not move
through rock/core machinery or route deliberately through lethal fire. If boxed
in, the enemy remains panicked rather than moving through obstacles. Reconsider
escape paths at a bounded cadence and after relevant terrain changes.

Use one burn state per enemy with remaining duration, damage rate and heat source.
Repeated ignition refreshes a capped duration rather than creating unlimited
stacked timers. Where sources overlap, the strongest active burn can take priority;
exact source attribution and stacking rules remain proposals. A laser hit that
kills immediately must not create a second death when its burn is processed.

Interpretation to play-test: 'until the fire ends' means until the enemy's burning
expires, not necessarily the instant the player releases the trigger. A briefly
ignited survivor can keep burning/fleeing after the beam is gone, then reacquire
a valid target. Exact duration and whether ignition requires one or several hits
remain tuning choices. Expiry should use simulation time and pause with the world.

Preserve the earlier lethal-contact concept for incendiary bomb cores. Proposal
for the robot jet: lethal central fuel contact, with weaker fringe/residual burns
if needed. These robot damage regions are not newly confirmed just by the user's
request for a liquid appearance. Only surviving targets can exhibit panic; do not
silently weaken a lethal core simply to show a longer fleeing animation.

## Liquid jet presentation

Emit connected short segments from the nozzle over time. Each advances along its
original direction, so turning creates a trailing curved ribbon instead of
rotating the whole existing stream. Use a bright uneven centre, burning edges,
a few detached droplets, and a surface impact flare. Keep the stream readable
before layering smoke. Rocks/solid obstacles stop the jet; whether deposited
fuel creates persistent ground fire needs its own bounded field/lifetime rule.

Use capped segment lifetimes/counts and coarse swept collision on the server.
Do not model every visible droplet as a network entity or a separate damage hit.
Animation, collision and the shared burn/panic state must agree on when contact
happens; literal fluid simulation is not required for this visual style.

## Aim-facing locomotion

Keep WASD in world/screen directions. It must not suddenly become tank steering
or make movement rotate when the player moves the mouse. Head, torso and weapon
face aim, with a responsive configurable turn rate; the tank's 180-degree/second
heavy turret setting is not automatically the robot's body-turn setting.

Classify the actual movement relative to the body's current facing to animate
forward steps, backward steps, left/right strafing and their diagonal blends.
Facing east: east is forward, west backward, north left, south right. When blocked
or stationary, stop the stepping motion even if a movement key remains pressed.
The upper body can turn while the feet adjust. Collision remains the existing
small body footprint, independent of the temporary artwork or gait animation.

## Suggested playable sequence and checks

1. Separate robot/tank equipment definitions and their aim previews; implement
   aim-facing robot movement and forward/backward/sideways gait first.
2. Build the bounded burn/panic state and one complete liquid jet. Verify timing,
   collision, lethal contact versus surviving burn, and friendly protection.
3. Add the laser rifle using the same ignition state; verify first-hit-only ray
   damage, world-space range and identical outcomes across phone/desktop views.
4. Connect personal health, alien attack cues and recovery at a selected friendly
   core. Do not let weapon effects replace the previously requested survival loop.

Review each playable step. Check expiry/re-ignition, one death per enemy, walls,
blocked escape routes, held-fire cancellation and representative resource use.
The tuning values above need playtesting; sound and wider battle scales remain unvalidated.
