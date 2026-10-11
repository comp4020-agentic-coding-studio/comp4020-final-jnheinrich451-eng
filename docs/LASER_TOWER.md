# Lance tower

11 October 2026. Separate playable stage after the air contaminator, authorized
by the author. Anti-air, attack jets, economy and facility durability remain later
work. This stage also fixes distant missile aiming (see below).

## Combat purpose and counterplay

The lance punishes remaining in its beam. Move sideways across its bearing, break contact
behind solid cover, attack during cooldown, or destroy it with long-range HE.
Click **L / Locate laser tower** in the map controls to inspect it. This is a map
button, not a keyboard binding. The objective panel reports its current phase.

- One 3×3 organ with 600 HP and two initial guards, sharing existing population
  caps. No scanner marks or reinforcement waves of its own.
- Acquisition is omnidirectional within eight tiles, with line of sight.
- Once acquired, a visible ground contact can be retained out to 40 tiles.
  Camera zoom does not change either distance. Behind cover it aims at the last
  seen position for up to two seconds, then drops that contact.
- Acquisition traverse is 30 degrees/second. Once aligned, a one-second visible charge and
  dashed aiming line precede a two-second damaging beam and five-second cooldown.
  Each new burst charges again. Losing a target during charge/fire cancels the
  attack into cooldown; reacquiring cannot reset cooldown early.
- Author's latest follow-up supersedes the variable-radius chase: the beam
  projects to the full 40-tile range, clipped by hits and cover. Only its angle
  pursues the last visible contact, at a fixed four degrees/second while firing.
  The warning bearing stays fixed during charge, giving sideways movement a head
  start. Even at 40 tiles, the angular sweep is about 2.8 tiles/second versus 3
  for robots/tanks. Moving sideways can evade it; standing still or retreating
  straight along the beam can be hit. No advancing radial endpoint is simulated.
- The actual barrel ray hits the first eligible body or solid obstacle. It does
  not automatically damage the selected target. Rocks, cores, solid machinery,
  hangars and intact hostile structures provide cover; walkable panels do not.
- Robot damage is 100/3 HP/s; tank damage is 200/9 HP/s. Thus the requested three
  and nine seconds mean cumulative beam exposure, excluding charge, cooldown and
  misses. These are first-pass balance values, not a new armor system.
- Ground robots and operational tanks (including parked tanks) are eligible.
  Embarked crew are not damaged again. Orbital/deploying/protected robots,
  incoming pods, ships and aircraft are excluded. Existing recovery rules apply.

The red beam has a pale core, a restrained halo and a rooted armored emitter.
Reduced effects retains the charge warning and beam. Both are below contamination
fog. The first tower is deliberately placed away from the fog encounter; this
stage does not deliberately combine invisible attack warnings with the lance.

## Persistence and resource boundaries

HE uses existing structure damage and permanently conquers the tower. Destruction
immediately cancels its charge/beam; surviving guards remain. Controller angle,
phase, timers and last-known contact are saved with the combat checkpoint. Time
advances only with simulation; reopening a save does not reset cooldown or heal it.
Old variable-radius endpoints are discarded while retaining existing barrel
bearings and phase timers. No migration marker or reset is needed.

Existing named campaigns receive one additive `laser-tower-v1` migration after a
SQLite backup. Placement preserves terrain, construction, occupants and previous
conquests. No safe location means no placement, recorded once; no forced clearing.
The legacy root world is not migrated. Refresh and re-enter a named campaign to
load the stage. No world reset is needed.

The server simulates one controller and bounded ray queries, not beam particles.
Launches and first damage per victim per burst use the existing audit events;
there is no per-frame log stream. Rendering uses canvas geometry. Local checks do
not establish Fly performance or a larger planet's capacity.

## Distant missile aiming

Fixed batteries and submarine missile tubes now move a distant rectangular strike
inward along the cursor bearing. All corners must fit within the weapon's maximum
range and the map. Preview and server use the same calculation; the committed
barrage and hazard footprints use the resolved rectangle for all three warheads.
Rotation retains the same full-footprint safety check. Close-range exclusion,
reload, surfacing and simultaneous-volley/hazard budgets remain enforced. If
there is no legal rectangle on that bearing, firing still gives a reason.

## Verification

`spec/laser-tower.test.ts` covers warning/cycle/exposure, traverse and escape,
cover and contact memory, target eligibility, crew immunity, saved burst state,
permanent destruction and safe placement. `spec/strike-aim.test.ts` covers range
corners, rotation, bearing, invalid/near aim and committed preview geometry.
Campaign tests include backed-up addition and permanent conquest after restart.
`tests/browser/laser-missiles.spec.js` exercises desktop/phone rendering, peer
updates, tank damage and firing a distant battery target through the UI.

Local validation on 11 October: typecheck and 253 tests across 44 files passed;
desktop/phone laser-missile checks and desktop/phone contaminator regressions
passed (four browser checks). Beam and corrected-area screenshots were reviewed.
The local server returned HTTP 200. Fly deployment and capacity were not tested.

Chase refinement validation: typecheck and 256 tests across 44 files passed.
Movement checks cover robots/tanks fleeing radially and sideways at near/far
range, stationary catch-up and old/new saved endpoints. Both desktop and phone
browser checks passed: a tank takes damage when parked, then outruns the next
burst without further damage, with a second player receiving the beam state.
The endpoint/escape screenshots were reviewed; the local server returned HTTP 200.

Subsequent angle-only refinement: typecheck and 257 tests passed, including full
missed-beam range, solid-cover clipping, radial-runner damage, sideways escape at
near/far range and removal of obsolete endpoint state without resetting timers.
Both desktop/phone browser checks passed, including a long beam observed by a
second player while the tank escapes sideways. Screenshot review confirms the
beam extends beyond the missed target. Local HTTP 200; no Fly deployment.
