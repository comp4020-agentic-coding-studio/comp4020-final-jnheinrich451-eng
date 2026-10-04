# Fullscreen battlefield and first combat drill

Date: 2026-10-01. User feedback: the phone layout felt like a webpage, with too
much interface outside the map. Requested a fullscreen game and collapsible
force menus with horizontally arranged deployment cards. Accepted the first
cooperative combat step. This is implementation evidence, not a personal reflection.

This records the first drill. The subsequent HE/crawler effects and bounded
combat resource measurement are recorded in [HE_EFFECTS.md](HE_EFFECTS.md).

## Implemented

- A viewport-filling canvas with no page scrolling, compact status, minimap,
  map tools, movement controls and firing controls. Optional native fullscreen
  is offered when the browser supports it. Portrait and landscape use overlays.
- Ground forces expands a horizontal tray with one deployable sentry card.
  Select it, tap a site, and confirm. On phones the camera keeps that tile above
  the confirmation sheet. Coordinates remain available for keyboard placement.
  Air, navy and orbital categories are explicitly unavailable future options.
- Server-owned shells, cooldowns, three hostile robots, health, impacts,
  automatic sentries and a landing-pad defense objective. Drill start is opt-in;
  clearing or failing it allows retry. Existing foundations become working sentries.
- Shell collision uses short substeps. Only enemy entities can receive weapon
  damage; friendly players and structures are excluded by the simulation rules.
  Rocks intercept shells. Cannon range: 14 tiles; sentry range: seven tiles.
- Combat state is transient and pauses without connected players. World terrain,
  scout identity/position and sentries continue to use the existing SQLite save.
  No save reset or schema replacement is required.

## Verification

- `pnpm check`: seven tests in four files plus TypeScript passed. The existing
  persistence/ownership tests remain; new combat tests cover invalid fire,
  cooldowns, enemy damage/removal, autonomous defense, failure and retry.
- `pnpm test:browser`: three Chrome tests passed. Two browsers observed the same
  shell ID and hostile damage. Checks also cover keyboard movement, live shared
  building changes, reload, phone touch selection/deployment/removal, and no
  page overflow. Canvas bounds are exactly 390 by 844 at the phone viewport.
- Inspected screenshots at desktop 1920 by 1080, portrait 390 by 844 and landscape
  844 by 390, including deployment and combat. Screenshots use isolated test saves
  under `.local/browser-*`; regular user saves are preserved.

## Boundaries

There is no new combat capacity claim for the 256 MB hosting contract. The earlier
22.54 MiB sample measured exploration only. Enemy pathfinding and combat snapshots
add load. This drill has three enemies and a 64-shell cap; a sustained combat
benchmark remains necessary before raising those limits or adding more forces.
This stage adds no public deployment, rooms, accounts, economy or missiles.

## Next play review

Assess phone visibility, aiming, deployment confirmation, and whether cooperating
to defend the pad feels worthwhile. Use that feedback to tune the loop before
expanding the arsenal or implementing the first aircraft.
