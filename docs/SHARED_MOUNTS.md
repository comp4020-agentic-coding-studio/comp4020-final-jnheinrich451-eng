# Shared mount rotation and automatic sentries

2026-10-01. The user asked to reuse player traverse for facilities and future
ship turrets. This stage implements automatic APCR sentries and a configurable
shared turn function; ships and heavy artillery are not implemented.

## Rules

- `turnTurret(current, target, seconds, speed)` in `public/turret.js` supplies
  shortest-path, speed-limited world-space rotation. Speed is radians/second.
  The existing player default remains 180 degrees/second.
- Current APCR sentries use 270 degrees/second and a 2-degree firing tolerance.
  They retain a living target within seven tiles, acquire the nearest enemy when
  that target is lost, and fire only when aligned. Bullets follow the actual
  barrel angle. They can still miss a moving enemy; predictive leading is deferred.
- Target acquisition does not teleport a mount. With no target, it holds its
  last bearing. A new/restarted mount begins at the existing 36-degree rest angle.
  Target IDs and angles are transient; saved building ownership/position is intact.
- Server snapshots include actual angle, desired angle and current target ID.
  Client rendering uses the same speed and at most one tick of extrapolation.
  Dismantling removes both simulation and render state. No per-mount timer or
  separate network stream is needed; current building count remains capped at 60.

## Future reuse

Use one small state record per rotating mount rather than a deep class hierarchy.
A ship can own several mounts, each with its own position offset, current/desired
bearing, target, turn speed, cooldown and weapon. Its hull translates the mounting
points; stabilized gun bearings stay independent of hull yaw. Restricted firing
arcs, deck obstruction and predictive aim require separate rules before ship work.

For game feel, the interpretation used here is light mounts faster, heavy mounts
slower. Caliber alone does not calculate the speed: set each mount's configuration.
Illustrative future tuning: light sentry 270 degrees/second (implemented), player
test turret 180 (implemented), heavy artillery/ship guns 30-60 (proposal only).

## Checks

TypeScript and 16 tests pass, including configurable rates, wraparound, firing
alignment, target retention, cleanup, immutable snapshots and the earlier
server-authoritative player firing checks. Eight browser checks pass, including two-client
agreement on sentry angle/target/shot data and desktop/phone captures, as well as
existing movement, firing, deployment and persistence behavior. The user save is
not used for tests. This adds bounded per-sentry state, but no new representative
load benchmark is claimed.

Reviewed captures: [desktop](previews/sentry-traverse-desktop.png) and
[phone](previews/sentry-traverse-mobile.png).

See [ROBOT_DEPLOYMENT_DESIGN.md](ROBOT_DEPLOYMENT_DESIGN.md) for the proposed next
robot, pod-arrival and starter-base stage.
