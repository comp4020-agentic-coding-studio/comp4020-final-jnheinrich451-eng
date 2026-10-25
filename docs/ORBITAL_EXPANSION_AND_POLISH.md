# Orbital expansion and remaining polish

23 October 2026. The author requested a large orbital bomb, a 15-second area
barrage, a longer cutting laser and three widely spaced cluster shells. The
laser was explicitly confirmed as both a 72-tile maximum cut and 18 seconds of
firing. The numbers below are initial playtest tuning, not final balance.

## Orbital roster additions

| Strike | First playable behavior | ORB | Recovery after last impact |
| --- | --- | --- | --- |
| Heavy orbital bomb | One impact, 12-tile damage radius; 1,200 central damage within four tiles, falling to 100 at the edge; large cosmetic crater | 300 | 60 s |
| Sustained barrage | 31 shells over 15 seconds after first arrival, one every 0.5 s; centers spread within ten tiles of the selected point; each shell radius 3, central damage 220 | 240 | 60 s |
| Cutting beam | Two endpoints, up to 72 tiles apart, swept in 18 seconds; existing narrow contact damage and 0.15 s sampling retained | 180 | 45 s |
| Cluster line | Three parent HE shells, twelve tiles apart, 1.6 s apart; each hits the ground then sends six smaller explosives outward | 200 | 50 s |

Cluster parent shells use radius 2.6 and 220 central damage. Their six smaller
explosives land 0.45–0.8 seconds later, spread up to four tiles from the parent,
with radius 2.3 and 120 central damage each. The complete line has 21 damaging
impacts. A shell's small explosions can reach enemies beyond its own impact ring.
They are not independently simulated physics objects.

The heavy bomb is intended to clear a concentrated enemy area, but damage falls
off with distance; it does not promise to erase every structure inside the outer
ring. Existing friendly immunity and permanent conquest remain in force.

## Controls, patterns and presentation

- New cards live in the existing Orbital deployment tab. Aim and left-click/tap
  to call. R rotates the cluster line. The heavy bomb and circular barrage need
  no rotation. The laser keeps its two-click start/end controls.
- The barrage uses a seeded, jittered disk pattern, with its impact order
  shuffled. This spreads shells across the area throughout the 15 seconds.
  It is not fifteen seconds of damage applied continuously to every point.
- Preview rings and actual impacts use the same committed coordinates, timings
  and damage radii. Cluster previews include the smaller impact rings; their
  brief outward arcs show the split following each parent impact.
- Large bomb descent, blast ring and crater scale follow the heavy profile.
  Barrage craters use the existing bounded cosmetic history. Craters do not
  alter terrain or block travel; they do not create supply crates.
- Seeded coordinates determine damage; decorative particles remain client-only.
  No server simulation of rubble or explosion debris is added.
- Selecting an orbital card closes the deployment catalogue. Only transparent
  aiming hints and compact rotate/reselect/cancel controls remain over the map.
  B (or Deploy / B on touch) reopens the catalogue without spending supplies.
  Chat controls move above the open deployment tray on phones so they do not
  intercept card/tab taps.

## Shared state and persistence

One shared orbital order at a time, with no queue. Supplies are charged once at
acceptance; retry IDs, sequence checks and shared cooldowns still apply. The
existing orbital arrival delay precedes the attack. Closing the panel does not
cancel it. Pause, empty rooms and offline time do not advance it.

Accepted orders save every impact, landed flag and payload profile. Restart
resumes only unfinished impacts, including the small cluster explosions. Older
accepted beam orders keep their saved shorter profile and point list. New orders
use 18 seconds and 121 contact samples. Existing worlds are not regenerated.

## Following polish stages — not implemented by this change

1. Collect replacement weapon audio using [the asset checklist](SOUND_ASSET_CHECKLIST.md).
   Keep the approved laser sound. Tune replacements before adding engine loops,
   creature calls and hive ambience.
2. Refine existing weapons, vehicle appearances and visual effects through play.
   Add further weapon types in small stages when they have distinct roles.
3. Large presentation images/key art: choose intended screens and visual direction
   before creating assets; these do not replace the overhead battlefield style.
4. Improve planet terrain textures and environmental variety. Define any new
   obstacle collision and navigation rules before introducing them.
5. Add two further planets. Their names, palettes, terrain rules and encounter
   differences remain to be designed. Use separate campaign generation; preserve
   existing saved worlds. Seamless travel around globe edges remains separate work.

These stages extend [the vehicle/world roadmap](VEHICLE_POLISH_ROADMAP.md).
Commit/push and deployment remain separate release steps.

## Local validation

- 24 orbital, catalogue and supplied invariant tests passed. Checks cover seeded
  repeatability, exact cadence, cluster stages/radii, map edges, costs/retries,
  friendly immunity, conquest, saved future impacts and legacy beam timing.
- Six named-campaign HTTP persistence cases passed: existing fire/gas plus the
  extended beam and all three new strikes. They verify pause/idle timing, restart,
  saved points and fields, completed progress, and no repeat charge.
- Eight browser cases passed across desktop 1920 x 1080 and phone 390 x 844:
  cards, map calling, cluster rotation, two-click beam, accepted-order locking,
  refresh restoration, completion and cooldown. Preview/impact screenshots were
  inspected. TypeScript, syntax and scoped whitespace checks passed.
- Tests use disposable worlds. The author's save was not reset. These checks
  establish local behavior, not deployed capacity or final balance.
