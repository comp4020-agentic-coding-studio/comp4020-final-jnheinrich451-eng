# Automatic HE bomber missions

Implemented locally on 14 October 2026, after the shared economy/support stage.
The author confirmed: abort and return after home-base loss; if the runway is
still unavailable on arrival, emergency-land and retain a wreck for replacement.

## Playable loop

Press H or the HE air-support button in Map controls. Choose a shared ready bomber,
click/tap a target or enter coordinates, and select its cardinal attack direction.
The map previews the six HE impacts and the approach. Dispatch reserves the
existing aircraft; the caller keeps their current robot, vehicle or facility.
Any connected active teammate can dispatch or recall a free shared bomber.

The bomber takes off, approaches, releases one existing six-bomb carpet, returns,
lands and rearms. Hull repairs continue to use the existing ground SUP rule.
Closing the planner does not cancel the mission. A refresh restores its status,
accepted target and direction. Manual piloting remains available when it is free.

No extra dispatch fee or new aircraft type. Ammunition and rearming follow the
existing bomber; this stage adds neither a heavy bomb nor incendiary/gas payloads.

## Flight and failure rules

- Positive speed and turn limits reuse manual flight. No teleporting to a target,
  homing bombs, new pilot body or immunity to enemy flak.
- One mission per aircraft, no queue. Reject occupied, assembling, destroyed,
  servicing or assigned aircraft. Concurrent orders have one winner. Retrying the
  currently recorded order identifier returns its saved mission.
- The accepted target is fixed. A bounded dry-run of the same controller checks
  approach and recovery before admission. The full approach and impact strip must
  fit inside the battlefield. Change direction for targets near map boundaries.
  It is a flight-feasibility check, not a promise that enemies stay under the bombs.
- Recall before release preserves bombs. Recall after release leaves accepted
  bombs in flight. If the existing two-bombardment capacity is busy on arrival,
  abort and return with the bombs. A missed approach also returns without firing.
- Home-base destruction aborts the strike. Rebuilding before arrival permits a
  normal landing. Otherwise a two-second emergency landing ends in a destroyed
  aircraft and a persistent cosmetic wreck. Rebuild the base, wait for the normal
  replacement preparation timer, then request the paid replacement.
- A 120-second approach limit and a separate 120-second return limit prevent
  indefinite circling. An unrecoverable return also emergency-lands. These are
  provisional bounds for the current battlefield, not fuel simulation.
- At most four existing aircraft slots can fly missions. Keep up to eight cosmetic
  mission wrecks per airbase. Wrecks are not salvage rewards in this stage.

## State, persistence and multiplayer

Saved phases: takeoff -> outbound -> approach -> release -> return -> landing ->
service -> complete, with emergency/lost branches. Save order identity, requesting
actor, target, bearing, pose, ammo and phase. Crew sees the shared mission status.
Manual boarding is locked while assigned. Released bombs and mission advancement
checkpoint together for named campaigns. Actor attribution survives delayed
release and restart. Room pause, owner reconnect grace and offline saves retain
simulation time; they do not progress sorties.

The legacy sandbox retains its existing transient-combat restart policy; it does
not replay spent bombs after restart. Named campaigns retain accepted projectiles.
No new save version or world reset is required; old aircraft have no mission field.

## Validation

- Typecheck and the full 56-file suite passed: 362 tests.
- New domain coverage exercises successful flight/recovery, four cardinal
  approaches, map boundaries, boarding reservation, recall, flak loss, home-base
  loss/rebuild, capacity denial and once-only release after restoring a checkpoint.
- Named-campaign HTTP coverage races two teammates for one bomber, verifies unchanged
  caller bodies, denies boarding, preserves pause/offline flight pose, restores a
  pending barrage exactly once, and checks original caller attribution.
- Desktop and phone browser runs exercise dispatch, refresh, actual bomb release,
  landing/rearming, rejection of invalid edge targets, keyboard access and layout.
  Screenshots caught a default-target preview after refresh; the planner now displays
  the accepted mission and locks its target fields while active. Both reruns passed.
  The Windows Playwright runner lingered after case completion and was stopped
  during teardown; this is not a claim of a clean runner exit.
- Local steering-only microbenchmark (100 preflights, Node on this Windows machine):
  median 0.136 ms, p95 0.262 ms; four controllers over 30 simulated seconds took
  about 3.15 ms. This excludes combat, networking, storage and rendering and is not
  evidence of Fly capacity.

No commit, push or production deployment is part of this local implementation.
