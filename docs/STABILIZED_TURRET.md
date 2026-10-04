# Stabilized player turret

2026-10-01. The user accepted independent hull/turret rotation and a limited
turret traverse as the next playable step, before personal survival.

## Behavior

- Gold cursor crosshair: desired target, with no rotation delay. Pale-blue
  diamond: current turret bearing at the cursor's distance. Its dashed ring
  previews the HE blast if the shot reaches that distance unobstructed. Rocks
  and enemies may cause earlier impacts. Out-of-range cursor targets remain
  rejected, with the existing orange warning; the diamond is capped at 14 tiles.
- The player turret turns through the shortest arc at 180 degrees per simulation
  second. A half-turn takes one second of simulation time. The server's existing
  capped 100 ms tick remains; overloaded simulation can run slower than real time.
- The hull retains WASD's eight movement headings and smooth visual rotation.
  Its rotation never contributes to the turret's world-space angle. Both weapons
  share the turret, with their existing independent cooldowns.
- HE and APCR follow the actual server turret angle, even when fired mid-turn.
  HE keeps the cursor's distance along that bearing; APCR retains its full range.
  A firing request can change desired aim, but cannot set the actual turret angle.
- Touch tap-to-aim and keyboard coordinate aim use the same rules. Existing
  firing controls, held-fire cancellation and friendly protection remain.
- This initial stage changed player turrets. The later [shared mount step](SHARED_MOUNTS.md)
  also gives automatic sentries limited traverse and firing alignment.

## State and rendering

The server stores desired aim and actual turret angle separately and publishes
both on the existing shared stream. Each active player adds one angle and a
constant amount of work per tick. No separate network stream or particle system
is introduced. Disconnected players do not traverse. After a server restart or
guest eviction, transient turret state initializes from the saved hull angle;
there is no save migration, world reset or promise to save aim orientation.

Browsers render with the same turn-rate cap and at most 100 ms of extrapolation
toward the last server target. Hull rotation cannot affect that calculation.
The cursor responds immediately; the barrel can show input/network delay and
small corrections. Server shot events supply the actual muzzle/trajectory angle.
The blue marker is a visual aiming aid, not an exact latency or collision solver.

## Verification

- TypeScript and 14 tests pass: turn speed, wraparound, no overshoot, both weapons
  following the actual turret, HTTP rejection of forged turret control, hull
  independence, and existing combat/persistence rules.
- Seven browser checks pass, covering cursor reversal and firing during traverse, agreement
  between two browsers, desktop/phone rendering, and existing controls/saves.
  Screenshots: [desktop](previews/stabilized-turret-desktop.png) and
  [phone](previews/stabilized-turret-mobile.png).
- Tests use isolated saves. The earlier direct-fire resource measurements remain
  historical evidence; this stage does not claim a new large-battle benchmark.

Next: player health, alien attack cues and a recoverable death/return loop.
