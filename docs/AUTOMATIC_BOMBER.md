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

## Departed-pilot recovery — 16 October 2026

Manual aircraft previously kept flying after their pilot left, retaining the seat
and airbase slot. Automatic strike recall did not cover these flights.

- Explicit departure now starts a return without dropping bombs. A disconnected
  pilot gets 30 seconds of active room time to reconnect; paused/offline rooms do
  not advance this grace period. Existing unoccupied flights recover immediately.
- Reconnecting during the return restores manual control. Otherwise landing clears
  the absent pilot's seat and saves their robot at a clear apron location. A blocked
  apron uses normal robot revival instead of trapping the saved player.
- H / Recall aircraft also recovers manually flown bombers and attack jets whose
  pilot is offline. Another connected pilot cannot have their aircraft taken over.
- Recovery uses the existing bounded return and emergency-wreck rules. Aircraft
  loss and the absent pilot's disabled state checkpoint together. Existing saved
  flights recover without a reset, another base, or a new deployment charge.

Validation: typecheck and the full 56-file suite passed (365 tests). After a final
checkpoint-order correction, both focused multiplayer tests passed, including the
additional emergency-wreck persistence regression, and typecheck passed again.
All three browser cases passed: desktop and phone automatic strikes, plus phone
recall and boarding of an offline pilot's aircraft without spending orbital SUP.
The browser runner was stopped after case completion because teardown lingered.
The release uses the normal main-branch deployment workflow. Saved-flight
recovery begins when the campaign resumes active simulation after deployment.

## Payloads and dive approach - 16 October 2026

The author requested heavy HE, incendiary and gas bombs on the existing aircraft,
with a dive before release, and withdrew the proposed bomber strafing mode.
This stage supersedes the HE-only restriction above. Existing attack jets keep
their autocannon; no new airframe, streaming attack or economic branch is added.

H / Air support offers a payload selector. The accepted payload, target and
direction lock together and survive refresh/restart. The manual bomber HUD also
offers the four payloads for LMB drops; manual flight remains pilot-controlled.

| Payload | Drop | Gameplay | Bay charges |
| --- | --- | --- | --- |
| HE carpet | Six bombs | Existing 2-tile blast radius per bomb | 1 |
| Heavy HE | One bomb | 5-tile blast radius; 300 centre damage, falling to 40 at the edge | 2 |
| Incendiary | Six bombs | Six 1.8-tile fire patches; each lasts 18 seconds | 1 |
| Gas | Six bombs | Six 1.8-tile gas patches sharing nine kills; no expiry timer | 1 |

These are initial tuning values. Heavy HE leaves a 12-tile cosmetic crater; carpet
impacts retain 4-tile crater artwork. Aiming rings show damage/field radius, not
crater size. Fire and gas make minor fragmentation impacts and use the existing
visible flames/clouds, avoidance/lure rules and friendly immunity. Only HE damages
hostile facilities. A gas carpet cannot refill its shared pool as later bombs land.

Automatic missions enter a dive over the final six tiles before release, then pull
out after dropping. Foreshortening, tightening shadow and wing trails express pitch
in overhead 2D. Reduced effects retain mission status without pitch animation or
trails. Dive/release are still vulnerable to flak, recall and base loss. Actual
impact coordinates use the existing flight momentum and fall time. This is not a
new altitude/ballistics simulation; manual drops do not force a dive or steer the
pilot. No extra particle entities or per-frame messages run on the server.

Two bay charges still rearm together at the airbase. A heavy drop needs both, and
cannot follow a carpet without rearming. Hazard carpets reserve one field and their
full bounding area at release, sharing existing field/area and two-volley caps. If
capacity is unavailable, the automatic bomber returns with its load retained.
Old aircraft and accepted missions without payload data continue using HE.
Named campaigns checkpoint bombs, hazard reservations and the spent load together;
accepted bombs survive recall or aircraft loss and never release twice on restart.

Validation: typecheck and the full suite passed (57 files, 377 tests), including
multiplayer order races and restart persistence for all four payloads. New domain
tests cover heavy damage versus crater size, friendly immunity, finite gas capacity,
fire expiry, field limits, ammunition rejection, dive/recall and once-only release.
Desktop heavy-HE and phone fire/gas browser missions passed through refresh,
release and rearming. The first recovery browser case hit a Playwright file-stream
error; its focused rerun passed, extended to board the recovered aircraft and fire
heavy HE manually on a phone. Runners were stopped after case completion because
Windows teardown lingered. Screenshot review confirmed the single heavy-bomb ring
and active fire/gas fields. Process-evidence and whitespace checks also passed.

The author approved release for online playtesting. This stage uses the normal
main-branch checks and Fly deployment workflow; balancing remains provisional.

The subsequent [shared-airfield stage](AIR_TRAFFIC.md) adds intentional cruise and
cross-base recovery. Parked automatic sorties retain return/rearm behavior;
strikes assigned from cruise resume cruise, including when empty or unable to
release. Recall explicitly chooses a free runway. This supersedes fixed-home
parking without changing payloads or manual flight physics.
